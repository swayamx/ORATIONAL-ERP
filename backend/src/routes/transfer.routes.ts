import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

export const transferRouter = Router();

transferRouter.use(authenticate);

// Operations and Admin can manage transfers
transferRouter.post(
  '/',
  requireRole(['ADMIN', 'OPERATIONS']),
  TransferController.createTransfer
);

transferRouter.get('/', TransferController.listTransfers);

transferRouter.post(
  '/:id/dispatch',
  requireRole(['ADMIN', 'OPERATIONS']),
  TransferController.dispatchTransfer
);

transferRouter.post(
  '/:id/receive',
  requireRole(['ADMIN', 'OPERATIONS']),
  TransferController.receiveTransfer
);
