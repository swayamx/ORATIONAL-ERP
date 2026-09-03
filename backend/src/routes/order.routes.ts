import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export const orderRouter = Router();

orderRouter.use(authenticate);

// Sales User and Admin can create customer orders and reserve stock
orderRouter.post(
  '/',
  requireRole(['ADMIN', 'SALES']),
  OrderController.createOrder
);

orderRouter.get('/', OrderController.listOrders);

// Cancel order and release reserved stock
orderRouter.post(
  '/:id/cancel',
  requireRole(['ADMIN', 'SALES']),
  OrderController.cancelOrder
);
