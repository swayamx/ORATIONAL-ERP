import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { workOrderRouter } from './workorder.routes.js';
import { transferRouter } from './transfer.routes.js';
import { orderRouter } from './order.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/work-orders', workOrderRouter);
apiRouter.use('/transfers', transferRouter);
apiRouter.use('/orders', orderRouter);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Mini Operations ERP Backend'
  });
});
