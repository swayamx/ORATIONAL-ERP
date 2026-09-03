import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

let adminToken: string;
let opsToken: string;
let salesToken: string;

let locationAustinId: string;
let locationDallasId: string;
let itemSteelId: string;
let itemBearingId: string;

describe('Mini Operations ERP - Mandatory Case Study Test Suite', () => {
  beforeAll(async () => {
    // 1. Log in with all three roles to retrieve JWT tokens
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.com', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    const opsRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ops@erp.com', password: 'Ops@123' });
    expect(opsRes.status).toBe(200);
    opsToken = opsRes.body.data.token;

    const salesRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sales@erp.com', password: 'Sales@123' });
    expect(salesRes.status).toBe(200);
    salesToken = salesRes.body.data.token;

    // 2. Fetch locations and items
    const locRes = await request(app)
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    const austin = locRes.body.data.find((l: any) => l.code === 'LOC-AUSTIN');
    const dallas = locRes.body.data.find((l: any) => l.code === 'LOC-DALLAS');
    locationAustinId = austin.id;
    locationDallasId = dallas.id;

    const itemRes = await request(app)
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${adminToken}`);
    const steel = itemRes.body.data.find((i: any) => i.sku === 'ITEM-STEEL');
    const bearing = itemRes.body.data.find((i: any) => i.sku === 'ITEM-BEARING');
    itemSteelId = steel.id;
    itemBearingId = bearing.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // Test 1: Cannot reserve more than available inventory.
  // =========================================================================
  it('Test 1: Cannot reserve more than available inventory', async () => {
    // Check initial inventory of ball bearing at Austin
    const invResBefore = await request(app)
      .get(`/api/inventory?locationId=${locationAustinId}`)
      .set('Authorization', `Bearer ${salesToken}`);
    
    const bearingInv = invResBefore.body.data.find(
      (inv: any) => inv.itemId === itemBearingId
    );
    expect(bearingInv).toBeDefined();
    const available = bearingInv.availableQuantity;

    // Attempt to reserve available + 50 units (exceeding stock)
    const excessQuantity = available + 50;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerName: 'Over-Allocation Test Corp',
        locationId: locationAustinId,
        items: [
          {
            itemId: itemBearingId,
            quantity: excessQuantity
          }
        ]
      });

    // Must be rejected with 409 Conflict
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Cannot reserve more than available inventory/i);

    // Verify inventory reserved quantity was NOT altered
    const invResAfter = await request(app)
      .get(`/api/inventory?locationId=${locationAustinId}`)
      .set('Authorization', `Bearer ${salesToken}`);
    const bearingInvAfter = invResAfter.body.data.find(
      (inv: any) => inv.itemId === itemBearingId
    );
    expect(bearingInvAfter.reservedQuantity).toBe(bearingInv.reservedQuantity);
  });

  // =========================================================================
  // Concurrency Check (Specification: User A reserves 80, User B reserves 50 when available = 100)
  // =========================================================================
  it('Test 1b: Concurrency race condition - two users cannot reserve more stock than exists', async () => {
    // Create a fresh item with exactly 100 available units
    const testItem = await prisma.item.create({
      data: {
        sku: `CONCURRENT-ITEM-${Date.now()}`,
        name: 'Concurrent Test Widget',
        category: 'COMPONENT',
        uom: 'UNITS'
      }
    });

    await prisma.inventory.create({
      data: {
        itemId: testItem.id,
        locationId: locationAustinId,
        batchNumber: 'BATCH-CONCURRENT',
        physicalQuantity: 100,
        reservedQuantity: 0,
        damagedQuantity: 0
      }
    });

    // Execute two simultaneous reservation requests: User A wants 80, User B wants 50 (Total 130 > 100)
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Concurrent Buyer A',
          locationId: locationAustinId,
          items: [{ itemId: testItem.id, quantity: 80 }]
        }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Concurrent Buyer B',
          locationId: locationAustinId,
          items: [{ itemId: testItem.id, quantity: 50 }]
        })
    ]);

    // Both requests must NOT succeed! Exactly one succeeds and one fails.
    const successes = [resA, resB].filter((r) => r.status === 201);
    const conflicts = [resA, resB].filter((r) => r.status === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    // Verify final database state: reserved quantity equals the winner's quantity
    const finalInv = await prisma.inventory.findFirst({
      where: { itemId: testItem.id, locationId: locationAustinId }
    });
    expect(finalInv?.reservedQuantity).toBe(successes[0].body.data.items[0].quantity);
    expect(finalInv?.physicalQuantity).toBe(100);
  });

  // =========================================================================
  // Test 2: Cannot transfer more than available inventory.
  // =========================================================================
  it('Test 2: Cannot transfer more than available inventory', async () => {
    // Check available steel at Dallas
    const invRes = await request(app)
      .get(`/api/inventory?locationId=${locationDallasId}`)
      .set('Authorization', `Bearer ${opsToken}`);
    const steelInv = invRes.body.data.find(
      (inv: any) => inv.itemId === itemSteelId
    );
    expect(steelInv).toBeDefined();

    const excessiveTransferQty = steelInv.availableQuantity + 999;

    // Attempt to create transfer exceeding available quantity
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locationDallasId,
        destinationLocationId: locationAustinId,
        itemId: itemSteelId,
        quantity: excessiveTransferQty
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Cannot transfer more than available inventory/i);
  });

  // =========================================================================
  // Test 3: Destination stock increases only after transfer receipt.
  // =========================================================================
  it('Test 3: Destination stock increases only after transfer receipt', async () => {
    const transferQty = 20;

    // Check inventory levels before transfer
    const austinBefore = await prisma.inventory.findFirst({
      where: { itemId: itemSteelId, locationId: locationAustinId }
    });
    const dallasBefore = await prisma.inventory.findFirst({
      where: { itemId: itemSteelId, locationId: locationDallasId }
    });
    const austinPhysicalBefore = austinBefore?.physicalQuantity || 0;
    const dallasPhysicalBefore = dallasBefore?.physicalQuantity || 0;

    // 1. Create transfer request
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locationDallasId,
        destinationLocationId: locationAustinId,
        itemId: itemSteelId,
        quantity: transferQty
      });
    expect(createRes.status).toBe(201);
    const transferId = createRes.body.data.id;

    // 2. Dispatch the transfer
    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(dispatchRes.status).toBe(200);

    // Verify Rule: On Dispatch, source inventory reduces
    const dallasAfterDispatch = await prisma.inventory.findFirst({
      where: { itemId: itemSteelId, locationId: locationDallasId }
    });
    expect(dallasAfterDispatch?.physicalQuantity).toBe(dallasPhysicalBefore - transferQty);

    // Verify Rule: Before Receipt, destination inventory must NOT increase
    const austinAfterDispatch = await prisma.inventory.findFirst({
      where: { itemId: itemSteelId, locationId: locationAustinId }
    });
    expect(austinAfterDispatch?.physicalQuantity).toBe(austinPhysicalBefore);

    // 3. Receive the transfer
    const receiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(receiveRes.status).toBe(200);

    // Verify Rule: On Receipt, destination inventory increases
    const austinAfterReceipt = await prisma.inventory.findFirst({
      where: { itemId: itemSteelId, locationId: locationAustinId }
    });
    expect(austinAfterReceipt?.physicalQuantity).toBe(austinPhysicalBefore + transferQty);
  });

  // =========================================================================
  // Test 4: Same transfer cannot be received twice.
  // =========================================================================
  it('Test 4: Same transfer cannot be received twice', async () => {
    // 1. Create and dispatch a new transfer
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locationDallasId,
        destinationLocationId: locationAustinId,
        itemId: itemSteelId,
        quantity: 10
      });
    const transferId = createRes.body.data.id;

    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${opsToken}`);

    // 2. First receipt: Must succeed
    const firstReceiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(firstReceiveRes.status).toBe(200);

    // 3. Duplicate receipt attempt: Must FAIL!
    const duplicateReceiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(duplicateReceiveRes.status).toBe(400);
    expect(duplicateReceiveRes.body.success).toBe(false);
    expect(duplicateReceiveRes.body.error).toMatch(/Same transfer cannot be received twice/i);
  });

  // =========================================================================
  // Test 5: Unauthorized user cannot perform restricted operation.
  // =========================================================================
  it('Test 5: Unauthorized user cannot perform restricted operation', async () => {
    // Subtest 5a: Sales User attempting to create a Work Order (Admin only)
    const salesCreateWoRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        locationId: locationAustinId,
        itemId: itemSteelId,
        requiredQuantity: 50,
        assignedUserId: locationAustinId
      });
    expect(salesCreateWoRes.status).toBe(403);
    expect(salesCreateWoRes.body.error).toMatch(/Access denied/i);

    // Subtest 5b: Operations User attempting to create a Customer Order (Sales/Admin only)
    const opsCreateOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        customerName: 'Unauthorized Corp',
        locationId: locationAustinId,
        items: [{ itemId: itemSteelId, quantity: 5 }]
      });
    expect(opsCreateOrderRes.status).toBe(403);
    expect(opsCreateOrderRes.body.error).toMatch(/Access denied/i);

    // Subtest 5c: Sales User attempting to dispatch a transfer (Operations/Admin only)
    const salesDispatchRes = await request(app)
      .post('/api/transfers/some-uuid/dispatch')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesDispatchRes.status).toBe(403);
    expect(salesDispatchRes.body.error).toMatch(/Access denied/i);
  });

  // =========================================================================
  // Automatic Shortage Calculation Verification
  // =========================================================================
  it('Work Order: Automatically calculates shortage correctly', async () => {
    // Case study example: Required Material = 100, Available at Location = 60 => Shortage = 40
    // Query work orders list
    const woListRes = await request(app)
      .get('/api/work-orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(woListRes.status).toBe(200);
    const initialWo = woListRes.body.data.find(
      (wo: any) => wo.workOrderNumber === 'WO-1001'
    );
    expect(initialWo).toBeDefined();
    expect(initialWo.requiredQuantity).toBe(100);
    expect(initialWo.shortage).toBe(
      Math.max(0, 100 - initialWo.availableAtLocation)
    );
  });
});
