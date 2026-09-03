import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes/index.js';
import { swaggerDocument } from './docs/swagger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ENV } from './config/env.js';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(express.json());

// Request logging in development
if (ENV.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Swagger Documentation UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount REST API
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
