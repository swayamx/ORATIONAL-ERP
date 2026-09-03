import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { InventoryService } from '../services/inventory.service.js';

const OrderItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be positive'),
  batchNumber: z.string().optional()
});

const CreateOrderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  locationId: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1, 'At least one item is required')
});

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateOrderSchema.parse(req.body);
      const userId = req.user!.id;

      // Execute order creation and stock reservation atomically in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const count = await tx.customerOrder.count();
        const orderNumber = `ORD-${3000 + count + 1}`;

        // Create the order record
        const order = await tx.customerOrder.create({
          data: {
            orderNumber,
            customerName: data.customerName,
            locationId: data.locationId,
            createdById: userId,
            status: 'RESERVED'
          }
        });

        // Reserve stock and create order items
        for (const item of data.items) {
          await InventoryService.reserveStock(
            item.itemId,
            data.locationId,
            item.quantity,
            order.orderNumber,
            userId,
            tx
          );

          await tx.orderItem.create({
            data: {
              customerOrderId: order.id,
              itemId: item.itemId,
              batchNumber: item.batchNumber || 'BATCH-MAIN',
              quantity: item.quantity
            }
          });
        }

        const fullOrder = await tx.customerOrder.findUnique({
          where: { id: order.id },
          include: {
            location: true,
            createdBy: {
              select: { id: true, name: true, email: true, role: true }
            },
            items: {
              include: { item: true }
            }
          }
        });

        return fullOrder;
      });

      return res.status(201).json({
        success: true,
        message: 'Order created and stock reserved successfully',
        data: result
      });
    } catch (err: any) {
      if (err.message && err.message.includes('Cannot reserve more than available inventory')) {
        return res.status(409).json({
          success: false,
          error: err.message
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to create order and reserve stock'
      });
    }
  }

  static async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { locationId, status } = req.query;
      const where: any = {};
      if (locationId) where.locationId = String(locationId);
      if (status) where.status = String(status);

      const orders = await prisma.customerOrder.findMany({
        where,
        include: {
          location: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          },
          items: {
            include: { item: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, data: orders });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Cancel order and release reserved stock (Change 3 bonus)
   */
  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.customerOrder.findUnique({
          where: { id },
          include: { items: true }
        });

        if (!order) {
          throw new Error('Order not found');
        }

        if (order.status === 'CANCELLED') {
          throw new Error('Order is already cancelled');
        }

        if (order.status === 'FULFILLED') {
          throw new Error('Cannot cancel a fulfilled order');
        }

        // Release reserved stock for each item in the order
        for (const item of order.items) {
          await InventoryService.releaseReservation(
            item.itemId,
            order.locationId,
            item.quantity,
            order.orderNumber,
            userId,
            tx
          );
        }

        const updatedOrder = await tx.customerOrder.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
          include: {
            location: true,
            items: { include: { item: true } }
          }
        });

        return updatedOrder;
      });

      return res.json({
        success: true,
        message: 'Order cancelled and reserved stock released successfully',
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  }
}
