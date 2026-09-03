import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get('/', InventoryController.listInventory);
inventoryRouter.get('/stats', InventoryController.getInventoryStats);
inventoryRouter.get('/locations', InventoryController.listLocations);
inventoryRouter.get('/items', InventoryController.listItems);
inventoryRouter.get('/transactions', InventoryController.listTransactions);

// Only Operations and Admin can adjust inventory
inventoryRouter.post(
  '/adjust',
  requireRole(['ADMIN', 'OPERATIONS']),
  InventoryController.adjustStock
);
