import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { InventoryService } from '../services/inventory.service.js';

const AdjustStockSchema = z.object({
  inventoryId: z.string().uuid(),
  physicalDelta: z.number().int().optional(),
  damagedDelta: z.number().int().optional(),
  reason: z.string().min(1)
});

export class InventoryController {
  static async listInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const { locationId, category, search } = req.query;

      const where: any = {};
      if (locationId) {
        where.locationId = String(locationId);
      }
      if (category) {
        where.item = { category: String(category) };
      }
      if (search) {
        const searchStr = String(search);
        where.OR = [
          { item: { name: { contains: searchStr } } },
          { item: { sku: { contains: searchStr } } },
          { batchNumber: { contains: searchStr } }
        ];
      }

      const records = await prisma.inventory.findMany({
        where,
        include: {
          item: true,
          location: true
        },
        orderBy: [{ location: { name: 'asc' } }, { item: { name: 'asc' } }]
      });

      const formatted = records.map((inv) => {
        const available = InventoryService.calculateAvailable(
          inv.physicalQuantity,
          inv.reservedQuantity,
          inv.damagedQuantity
        );
        return {
          id: inv.id,
          itemId: inv.itemId,
          item: inv.item,
          locationId: inv.locationId,
          location: inv.location,
          batchNumber: inv.batchNumber,
          physicalQuantity: inv.physicalQuantity,
          reservedQuantity: inv.reservedQuantity,
          damagedQuantity: inv.damagedQuantity,
          availableQuantity: available,
          updatedAt: inv.updatedAt
        };
      });

      return res.json({ success: true, data: formatted });
    } catch (err) {
      return next(err);
    }
  }

  static async getInventoryStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { locationId } = req.query;
      const where = locationId ? { locationId: String(locationId) } : {};

      const records = await prisma.inventory.findMany({ where });

      const totalPhysical = records.reduce((s, r) => s + r.physicalQuantity, 0);
      const totalReserved = records.reduce((s, r) => s + r.reservedQuantity, 0);
      const totalDamaged = records.reduce((s, r) => s + r.damagedQuantity, 0);
      const totalAvailable = InventoryService.calculateAvailable(
        totalPhysical,
        totalReserved,
        totalDamaged
      );

      return res.json({
        success: true,
        data: {
          totalPhysical,
          totalReserved,
          totalDamaged,
          totalAvailable,
          totalBatches: records.length
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventoryId, physicalDelta = 0, damagedDelta = 0, reason } =
        AdjustStockSchema.parse(req.body);

      const userId = req.user?.id;

      const result = await prisma.$transaction(async (tx) => {
        const inv = await tx.inventory.findUnique({
          where: { id: inventoryId },
          include: { item: true, location: true }
        });

        if (!inv) {
          throw new Error('Inventory record not found');
        }

        const newPhysical = inv.physicalQuantity + physicalDelta;
        const newDamaged = inv.damagedQuantity + damagedDelta;

        if (newPhysical < 0) {
          throw new Error('Adjustment would result in negative physical inventory');
        }
        if (newDamaged < 0) {
          throw new Error('Damaged stock cannot be negative');
        }
        if (inv.reservedQuantity + newDamaged > newPhysical) {
          throw new Error(
            'Cannot adjust damaged stock beyond available inventory. Reserved and damaged stock exceed physical stock.'
          );
        }

        const updated = await tx.inventory.update({
          where: { id: inventoryId },
          data: {
            physicalQuantity: newPhysical,
            damagedQuantity: newDamaged
          },
          include: { item: true, location: true }
        });

        if (physicalDelta !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: inv.itemId,
              locationId: inv.locationId,
              batchNumber: inv.batchNumber,
              type: 'STOCK_ADJUST',
              quantityChange: physicalDelta,
              performedById: userId,
              notes: `Manual adjustment: ${reason}`
            }
          });
        }

        if (damagedDelta !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: inv.itemId,
              locationId: inv.locationId,
              batchNumber: inv.batchNumber,
              type: 'DAMAGE_ADJUST',
              quantityChange: damagedDelta,
              performedById: userId,
              notes: `Damaged stock adjusted by ${damagedDelta}: ${reason}`
            }
          });
        }

        return updated;
      });

      return res.json({
        success: true,
        data: {
          ...result,
          availableQuantity: InventoryService.calculateAvailable(
            result.physicalQuantity,
            result.reservedQuantity,
            result.damagedQuantity
          )
        }
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async listLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const locations = await prisma.location.findMany({
        orderBy: { name: 'asc' }
      });
      return res.json({ success: true, data: locations });
    } catch (err) {
      return next(err);
    }
  }

  static async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await prisma.item.findMany({
        orderBy: { name: 'asc' }
      });
      return res.json({ success: true, data: items });
    } catch (err) {
      return next(err);
    }
  }

  static async listTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { locationId, itemId } = req.query;
      const where: any = {};
      if (locationId) where.locationId = String(locationId);
      if (itemId) where.itemId = String(itemId);

      const logs = await prisma.inventoryTransaction.findMany({
        where,
        include: {
          item: true,
          location: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return res.json({ success: true, data: logs });
    } catch (err) {
      return next(err);
    }
  }
}
