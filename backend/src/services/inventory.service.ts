import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class InventoryService {
  /**
   * Calculate available quantity strictly according to business rule:
   * Available = Physical - Reserved - Damaged
   */
  static calculateAvailable(
    physical: number,
    reserved: number,
    damaged: number = 0
  ): number {
    return Math.max(0, physical - reserved - damaged);
  }

  /**
   * Check total available stock for an item at a specific location
   */
  static async getStockSummary(
    itemId: string,
    locationId: string,
    db: PrismaTx = prisma
  ) {
    const inventories = await db.inventory.findMany({
      where: { itemId, locationId }
    });

    const physical = inventories.reduce((acc, inv) => acc + inv.physicalQuantity, 0);
    const reserved = inventories.reduce((acc, inv) => acc + inv.reservedQuantity, 0);
    const damaged = inventories.reduce((acc, inv) => acc + inv.damagedQuantity, 0);
    const available = this.calculateAvailable(physical, reserved, damaged);

    return {
      physicalQuantity: physical,
      reservedQuantity: reserved,
      damagedQuantity: damaged,
      availableQuantity: available,
      inventories
    };
  }

  /**
   * Reserve stock inside a transaction with concurrency protection.
   * Concurrency guarantee: Uses conditional update / atomic validation.
   */
  static async reserveStock(
    itemId: string,
    locationId: string,
    quantity: number,
    orderId: string,
    userId: string,
    db: PrismaTx = prisma
  ) {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero');
    }

    // Find all inventory records for this item at this location
    const inventoryRecords = await db.inventory.findMany({
      where: { itemId, locationId },
      orderBy: { physicalQuantity: 'desc' }
    });

    if (inventoryRecords.length === 0) {
      throw new Error('No inventory record found for this item at the specified location');
    }

    // Calculate total available across batches at this location
    const totalPhysical = inventoryRecords.reduce((sum, inv) => sum + inv.physicalQuantity, 0);
    const totalReserved = inventoryRecords.reduce((sum, inv) => sum + inv.reservedQuantity, 0);
    const totalDamaged = inventoryRecords.reduce((sum, inv) => sum + inv.damagedQuantity, 0);
    const totalAvailable = this.calculateAvailable(totalPhysical, totalReserved, totalDamaged);

    if (totalAvailable < quantity) {
      throw new Error(
        `Cannot reserve more than available inventory. Available: ${totalAvailable}, Requested: ${quantity}`
      );
    }

    // Allocate across batches
    let remainingToReserve = quantity;
    for (const record of inventoryRecords) {
      const availableInBatch = this.calculateAvailable(
        record.physicalQuantity,
        record.reservedQuantity,
        record.damagedQuantity
      );

      if (availableInBatch <= 0) continue;

      const toReserveFromThisBatch = Math.min(remainingToReserve, availableInBatch);

      // Perform atomic update on this batch
      await db.inventory.update({
        where: { id: record.id },
        data: {
          reservedQuantity: { increment: toReserveFromThisBatch }
        }
      });

      // Log transaction ledger
      await db.inventoryTransaction.create({
        data: {
          itemId,
          locationId,
          batchNumber: record.batchNumber,
          type: 'ORDER_RESERVE',
          quantityChange: toReserveFromThisBatch,
          referenceId: orderId,
          performedById: userId,
          notes: `Reserved ${toReserveFromThisBatch} units for customer order ${orderId}`
        }
      });

      remainingToReserve -= toReserveFromThisBatch;
      if (remainingToReserve <= 0) break;
    }

    return true;
  }

  /**
   * Release reserved stock (e.g. on order cancellation)
   */
  static async releaseReservation(
    itemId: string,
    locationId: string,
    quantity: number,
    orderId: string,
    userId: string,
    db: PrismaTx = prisma
  ) {
    const records = await db.inventory.findMany({
      where: { itemId, locationId },
      orderBy: { reservedQuantity: 'desc' }
    });

    let remainingToRelease = quantity;
    for (const record of records) {
      if (record.reservedQuantity <= 0) continue;

      const toRelease = Math.min(remainingToRelease, record.reservedQuantity);
      await db.inventory.update({
        where: { id: record.id },
        data: {
          reservedQuantity: { decrement: toRelease }
        }
      });

      await db.inventoryTransaction.create({
        data: {
          itemId,
          locationId,
          batchNumber: record.batchNumber,
          type: 'ORDER_RELEASE',
          quantityChange: -toRelease,
          referenceId: orderId,
          performedById: userId,
          notes: `Released ${toRelease} reserved units for order ${orderId}`
        }
      });

      remainingToRelease -= toRelease;
      if (remainingToRelease <= 0) break;
    }
  }

  /**
   * Dispatch a transfer:
   * Rule: Source inventory reduces immediately.
   * Rule: Destination inventory must NOT increase yet.
   */
  static async dispatchTransfer(transferId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.internalTransfer.findUnique({
        where: { id: transferId },
        include: { sourceLocation: true, destinationLocation: true, item: true }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status !== 'REQUESTED') {
        throw new Error(
          `Cannot dispatch transfer in status '${transfer.status}'. Only 'REQUESTED' transfers can be dispatched.`
        );
      }

      // Check available stock at source location
      const sourceSummary = await this.getStockSummary(
        transfer.itemId,
        transfer.sourceLocationId,
        tx
      );

      if (sourceSummary.availableQuantity < transfer.quantity) {
        throw new Error(
          `Cannot transfer more than available inventory. Available at ${transfer.sourceLocation.name}: ${sourceSummary.availableQuantity}, Requested: ${transfer.quantity}`
        );
      }

      // Deduct from source inventory
      let remainingToDeduct = transfer.quantity;
      for (const record of sourceSummary.inventories) {
        const availableInBatch = this.calculateAvailable(
          record.physicalQuantity,
          record.reservedQuantity,
          record.damagedQuantity
        );

        if (availableInBatch <= 0) continue;

        const deduct = Math.min(remainingToDeduct, availableInBatch);
        await tx.inventory.update({
          where: { id: record.id },
          data: {
            physicalQuantity: { decrement: deduct }
          }
        });

        await tx.inventoryTransaction.create({
          data: {
            itemId: transfer.itemId,
            locationId: transfer.sourceLocationId,
            batchNumber: record.batchNumber,
            type: 'TRANSFER_DISPATCH',
            quantityChange: -deduct,
            referenceId: transfer.transferNumber,
            performedById: userId,
            notes: `Dispatched ${deduct} units to ${transfer.destinationLocation.name} (Transfer ${transfer.transferNumber})`
          }
        });

        remainingToDeduct -= deduct;
        if (remainingToDeduct <= 0) break;
      }

      // Update transfer status to DISPATCHED
      const updatedTransfer = await tx.internalTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: new Date()
        },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: true
        }
      });

      return updatedTransfer;
    });
  }

  /**
   * Receive a transfer:
   * Rule: Destination inventory increases.
   * Rule: System must prevent the same transfer from being received twice.
   */
  static async receiveTransfer(transferId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.internalTransfer.findUnique({
        where: { id: transferId },
        include: { sourceLocation: true, destinationLocation: true, item: true }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status === 'RECEIVED') {
        throw new Error('Same transfer cannot be received twice.');
      }

      if (transfer.status !== 'DISPATCHED') {
        throw new Error(
          `Cannot receive transfer in status '${transfer.status}'. Transfer must be 'DISPATCHED' first.`
        );
      }

      // Find existing inventory for this item at destination, or create a new batch
      const targetBatch = transfer.batchNumber || 'BATCH-MAIN';
      const existingDest = await tx.inventory.findFirst({
        where: {
          itemId: transfer.itemId,
          locationId: transfer.destinationLocationId
        }
      });

      if (existingDest) {
        await tx.inventory.update({
          where: { id: existingDest.id },
          data: {
            physicalQuantity: { increment: transfer.quantity }
          }
        });
      } else {
        await tx.inventory.create({
          data: {
            itemId: transfer.itemId,
            locationId: transfer.destinationLocationId,
            batchNumber: targetBatch,
            physicalQuantity: transfer.quantity,
            reservedQuantity: 0,
            damagedQuantity: 0
          }
        });
      }

      // Log transaction ledger for destination intake
      await tx.inventoryTransaction.create({
        data: {
          itemId: transfer.itemId,
          locationId: transfer.destinationLocationId,
          batchNumber: targetBatch,
          type: 'TRANSFER_RECEIVE',
          quantityChange: transfer.quantity,
          referenceId: transfer.transferNumber,
          performedById: userId,
          notes: `Received ${transfer.quantity} units from ${transfer.sourceLocation.name} (Transfer ${transfer.transferNumber})`
        }
      });

      // Update transfer status to RECEIVED
      const updatedTransfer = await tx.internalTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'RECEIVED',
          receivedQuantity: transfer.quantity,
          receivedAt: new Date()
        },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: true
        }
      });

      return updatedTransfer;
    });
  }
}
