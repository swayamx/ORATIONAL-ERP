import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in reverse dependency order
  await prisma.inventoryTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.customerOrder.deleteMany();
  await prisma.internalTransfer.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.item.deleteMany();

  // 2. Create Locations
  const locAustin = await prisma.location.create({
    data: {
      code: 'LOC-AUSTIN',
      name: 'Plant A (Austin)',
      address: '1000 Industrial Blvd, Austin, TX'
    }
  });

  const locDallas = await prisma.location.create({
    data: {
      code: 'LOC-DALLAS',
      name: 'Warehouse B (Dallas)',
      address: '450 Logistics Way, Dallas, TX'
    }
  });

  const locChicago = await prisma.location.create({
    data: {
      code: 'LOC-CHICAGO',
      name: 'Distribution Hub C (Chicago)',
      address: '780 Cargo Road, Chicago, IL'
    }
  });

  console.log('✓ Created 3 Locations');

  // 3. Create Users with hashed passwords
  const passwordHashAdmin = await bcrypt.hash('Admin@123', 10);
  const passwordHashOps = await bcrypt.hash('Ops@123', 10);
  const passwordHashSales = await bcrypt.hash('Sales@123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@erp.com',
      passwordHash: passwordHashAdmin,
      name: 'Swayam',
      role: 'ADMIN',
      assignedLocationId: locAustin.id
    }
  });

  const opsUser = await prisma.user.create({
    data: {
      email: 'ops@erp.com',
      passwordHash: passwordHashOps,
      name: 'Bob Operations',
      role: 'OPERATIONS',
      assignedLocationId: locAustin.id
    }
  });

  const salesUser = await prisma.user.create({
    data: {
      email: 'sales@erp.com',
      passwordHash: passwordHashSales,
      name: 'Charlie Sales',
      role: 'SALES',
      assignedLocationId: locAustin.id
    }
  });

  console.log('✓ Created 3 Users (Admin, Operations, Sales)');

  // 4. Create Items
  const itemSteel = await prisma.item.create({
    data: {
      sku: 'ITEM-STEEL',
      name: 'Cold Rolled Steel Sheet',
      category: 'RAW_MATERIAL',
      uom: 'KG',
      description: 'High tensile steel sheet for fabrication'
    }
  });

  const itemBearing = await prisma.item.create({
    data: {
      sku: 'ITEM-BEARING',
      name: 'Precision Ball Bearing 608RS',
      category: 'COMPONENT',
      uom: 'UNITS',
      description: 'Chrome steel dual rubber sealed ball bearing'
    }
  });

  const itemMotor = await prisma.item.create({
    data: {
      sku: 'ITEM-MOTOR',
      name: 'Brushless DC Servo Motor 24V',
      category: 'COMPONENT',
      uom: 'UNITS',
      description: 'High torque servo motor for automation'
    }
  });

  const itemConveyor = await prisma.item.create({
    data: {
      sku: 'ITEM-CONVEYOR',
      name: 'Modular Belt Conveyor System',
      category: 'FINISHED_GOOD',
      uom: 'UNITS',
      description: 'Heavy duty modular motorized conveyor line'
    }
  });

  console.log('✓ Created 4 Items');

  // 5. Create Initial Inventory
  // Case study setup:
  // Plant A (Austin):
  // - ITEM-STEEL: Physical = 60, Reserved = 0 => Available = 60 (Shortage scenario: WO needs 100)
  // - ITEM-BEARING: Physical = 100, Reserved = 30 => Available = 70 (Matches case study spec Page 2)
  await prisma.inventory.create({
    data: {
      itemId: itemSteel.id,
      locationId: locAustin.id,
      batchNumber: 'BATCH-2026-001',
      physicalQuantity: 60,
      reservedQuantity: 0,
      damagedQuantity: 0
    }
  });

  await prisma.inventoryTransaction.create({
    data: {
      itemId: itemSteel.id,
      locationId: locAustin.id,
      batchNumber: 'BATCH-2026-001',
      type: 'INITIAL',
      quantityChange: 60,
      notes: 'Initial stock intake'
    }
  });

  await prisma.inventory.create({
    data: {
      itemId: itemBearing.id,
      locationId: locAustin.id,
      batchNumber: 'BATCH-2026-002',
      physicalQuantity: 100,
      reservedQuantity: 30,
      damagedQuantity: 0
    }
  });

  await prisma.inventoryTransaction.create({
    data: {
      itemId: itemBearing.id,
      locationId: locAustin.id,
      batchNumber: 'BATCH-2026-002',
      type: 'INITIAL',
      quantityChange: 100,
      notes: 'Initial stock intake'
    }
  });

  // Warehouse B (Dallas):
  // - ITEM-STEEL: Physical = 150, Available = 150 (Available for transfer to Austin!)
  // - ITEM-MOTOR: Physical = 80, Available = 80
  await prisma.inventory.create({
    data: {
      itemId: itemSteel.id,
      locationId: locDallas.id,
      batchNumber: 'BATCH-2026-003',
      physicalQuantity: 150,
      reservedQuantity: 0,
      damagedQuantity: 0
    }
  });

  await prisma.inventory.create({
    data: {
      itemId: itemMotor.id,
      locationId: locDallas.id,
      batchNumber: 'BATCH-2026-004',
      physicalQuantity: 80,
      reservedQuantity: 0,
      damagedQuantity: 0
    }
  });

  // Distribution C (Chicago):
  // - ITEM-CONVEYOR: Physical = 25, Reserved = 5 => Available = 20
  await prisma.inventory.create({
    data: {
      itemId: itemConveyor.id,
      locationId: locChicago.id,
      batchNumber: 'BATCH-2026-005',
      physicalQuantity: 25,
      reservedQuantity: 5,
      damagedQuantity: 0
    }
  });

  console.log('✓ Created Initial Inventory & Ledger Records');

  // 6. Create Initial Work Order
  // Requires 100 ITEM-STEEL at Plant A (where only 60 are available, so Shortage = 40)
  const workOrder1 = await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-1001',
      locationId: locAustin.id,
      itemId: itemSteel.id,
      requiredQuantity: 100,
      assignedUserId: adminUser.id,
      status: 'ASSIGNED'
    }
  });

  console.log('✓ Created Work Order WO-1001 (Shortage demonstration)');

  // 7. Create Initial Customer Order (explaining the 30 reserved ball bearings)
  const order1 = await prisma.customerOrder.create({
    data: {
      orderNumber: 'ORD-3001',
      customerName: 'Apex Robotics LLC',
      locationId: locAustin.id,
      status: 'RESERVED',
      createdById: salesUser.id,
      items: {
        create: [
          {
            itemId: itemBearing.id,
            batchNumber: 'BATCH-2026-002',
            quantity: 30
          }
        ]
      }
    }
  });

  console.log('✓ Created Customer Order ORD-3001 (Active reservation)');

  console.log('🚀 Seed complete successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
