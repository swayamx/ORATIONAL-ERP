import { Router } from 'express';
import { WorkOrderController } from '../controllers/workorder.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export const workOrderRouter = Router();

workOrderRouter.use(authenticate);

// Admin can create Work Orders
workOrderRouter.post(
  '/',
  requireRole(['ADMIN']),
  WorkOrderController.createWorkOrder
);

// All authenticated roles can view Work Orders
workOrderRouter.get('/', WorkOrderController.listWorkOrders);

// Admin and Operations can update status
workOrderRouter.patch(
  '/:id/status',
  requireRole(['ADMIN', 'OPERATIONS']),
  WorkOrderController.updateStatus
);
