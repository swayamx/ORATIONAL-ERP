import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { InventoryService } from '../services/inventory.service.js';

const CreateWorkOrderSchema = z.object({
  workOrderNumber: z.string().optional(),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  requiredQuantity: z.number().int().positive('Required quantity must be positive'),
  assignedUserId: z.string().uuid(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']).optional()
});

const UpdateStatusSchema = z.object({
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])
});

export class WorkOrderController {
  static async createWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateWorkOrderSchema.parse(req.body);

      // Generate Work Order Number if not provided
      let woNumber = data.workOrderNumber;
      if (!woNumber) {
        const count = await prisma.workOrder.count();
        woNumber = `WO-${1000 + count + 1}`;
      }

      const workOrder = await prisma.workOrder.create({
        data: {
          workOrderNumber: woNumber,
          locationId: data.locationId,
          itemId: data.itemId,
          requiredQuantity: data.requiredQuantity,
          assignedUserId: data.assignedUserId,
          status: data.status || 'ASSIGNED'
        },
        include: {
          location: true,
          item: true,
          assignedUser: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      // Calculate real-time stock and shortage at work order location
      const stockSummary = await InventoryService.getStockSummary(
        workOrder.itemId,
        workOrder.locationId
      );

      const shortage = Math.max(
        0,
        workOrder.requiredQuantity - stockSummary.availableQuantity
      );

      return res.status(201).json({
        success: true,
        data: {
          ...workOrder,
          availableAtLocation: stockSummary.availableQuantity,
          shortage,
          hasShortage: shortage > 0
        }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'A Work Order with this number already exists'
        });
      }
      return next(err);
    }
  }

  static async listWorkOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { locationId, status } = req.query;
      const where: any = {};
      if (locationId) where.locationId = String(locationId);
      if (status) where.status = String(status);

      const workOrders = await prisma.workOrder.findMany({
        where,
        include: {
          location: true,
          item: true,
          assignedUser: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Enrich all work orders with live stock check & shortage calculation
      const enriched = await Promise.all(
        workOrders.map(async (wo) => {
          const stockSummary = await InventoryService.getStockSummary(
            wo.itemId,
            wo.locationId
          );
          const shortage = Math.max(
            0,
            wo.requiredQuantity - stockSummary.availableQuantity
          );

          // Find alternative locations with stock if there is a shortage
          let alternativeLocations: any[] = [];
          if (shortage > 0) {
            const otherInventories = await prisma.inventory.findMany({
              where: {
                itemId: wo.itemId,
                locationId: { not: wo.locationId }
              },
              include: { location: true }
            });

            alternativeLocations = otherInventories
              .map((inv) => ({
                locationId: inv.locationId,
                locationName: inv.location.name,
                availableQuantity: InventoryService.calculateAvailable(
                  inv.physicalQuantity,
                  inv.reservedQuantity,
                  inv.damagedQuantity
                )
              }))
              .filter((loc) => loc.availableQuantity > 0);
          }

          return {
            ...wo,
            availableAtLocation: stockSummary.availableQuantity,
            shortage,
            hasShortage: shortage > 0,
            alternativeLocations
          };
        })
      );

      return res.json({ success: true, data: enriched });
    } catch (err) {
      return next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = UpdateStatusSchema.parse(req.body);

      const updated = await prisma.workOrder.update({
        where: { id },
        data: { status },
        include: {
          location: true,
          item: true,
          assignedUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return res.json({ success: true, data: updated });
    } catch (err) {
      return next(err);
    }
  }
}
