import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { InventoryService } from '../services/inventory.service.js';

const CreateTransferSchema = z.object({
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive('Transfer quantity must be positive'),
  batchNumber: z.string().optional()
}).refine(
  (data) => data.sourceLocationId !== data.destinationLocationId,
  {
    message: 'Source and Destination locations must be different',
    path: ['destinationLocationId']
  }
);

export class TransferController {
  static async createTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateTransferSchema.parse(req.body);
      const userId = req.user!.id;

      // Check available stock at source location
      const sourceSummary = await InventoryService.getStockSummary(
        data.itemId,
        data.sourceLocationId
      );

      if (sourceSummary.availableQuantity < data.quantity) {
        return res.status(400).json({
          success: false,
          error: `Cannot transfer more than available inventory. Available at source: ${sourceSummary.availableQuantity}, Requested: ${data.quantity}`
        });
      }

      const count = await prisma.internalTransfer.count();
      const transferNumber = `TR-${2000 + count + 1}`;

      const transfer = await prisma.internalTransfer.create({
        data: {
          transferNumber,
          sourceLocationId: data.sourceLocationId,
          destinationLocationId: data.destinationLocationId,
          itemId: data.itemId,
          quantity: data.quantity,
          batchNumber: data.batchNumber || 'BATCH-MAIN',
          status: 'REQUESTED',
          createdById: userId
        },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return res.status(201).json({ success: true, data: transfer });
    } catch (err) {
      return next(err);
    }
  }

  static async listTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, sourceLocationId, destinationLocationId } = req.query;
      const where: any = {};
      if (status) where.status = String(status);
      if (sourceLocationId) where.sourceLocationId = String(sourceLocationId);
      if (destinationLocationId) where.destinationLocationId = String(destinationLocationId);

      const transfers = await prisma.internalTransfer.findMany({
        where,
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, data: transfers });
    } catch (err) {
      return next(err);
    }
  }

  static async dispatchTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const updated = await InventoryService.dispatchTransfer(id, userId);

      return res.json({
        success: true,
        message: 'Transfer dispatched successfully. Source stock has been reduced.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  }

  static async receiveTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const updated = await InventoryService.receiveTransfer(id, userId);

      return res.json({
        success: true,
        message: 'Transfer received successfully. Destination stock has been incremented.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  }
}
