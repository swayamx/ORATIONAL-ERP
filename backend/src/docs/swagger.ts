export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Mini Operations ERP API',
    version: '1.0.0',
    description: `
**Mini Operations ERP Backend API Specification**
Evaluated workflow:
$$\\\\text{Inventory} \\\\longrightarrow \\\\text{Work Order} \\\\longrightarrow \\\\text{Stock Check} \\\\longrightarrow \\\\text{Internal Transfer / Shortage} \\\\longrightarrow \\\\text{Customer Reservation}$$

### Pre-seeded User Accounts
- **Admin**: \`admin@erp.com\` / \`Admin@123\` (Full access, creates Work Orders)
- **Operations**: \`ops@erp.com\` / \`Ops@123\` (Manages inventory adjustments and transfers)
- **Sales**: \`sales@erp.com\` / \`Sales@123\` (Creates customer orders and reserves stock)
    `
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'admin@erp.com' },
          password: { type: 'string', example: 'Admin@123' }
        }
      },
      CreateWorkOrderRequest: {
        type: 'object',
        required: ['locationId', 'itemId', 'requiredQuantity', 'assignedUserId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          itemId: { type: 'string', format: 'uuid' },
          requiredQuantity: { type: 'integer', minimum: 1, example: 100 },
          assignedUserId: { type: 'string', format: 'uuid' }
        }
      },
      CreateTransferRequest: {
        type: 'object',
        required: ['sourceLocationId', 'destinationLocationId', 'itemId', 'quantity'],
        properties: {
          sourceLocationId: { type: 'string', format: 'uuid' },
          destinationLocationId: { type: 'string', format: 'uuid' },
          itemId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1, example: 40 },
          batchNumber: { type: 'string', example: 'BATCH-2026-003' }
        }
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['customerName', 'locationId', 'items'],
        properties: {
          customerName: { type: 'string', example: 'Apex Robotics LLC' },
          locationId: { type: 'string', format: 'uuid' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['itemId', 'quantity'],
              properties: {
                itemId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', minimum: 1, example: 30 },
                batchNumber: { type: 'string', example: 'BATCH-2026-002' }
              }
            }
          }
        }
      },
      AdjustStockRequest: {
        type: 'object',
        required: ['inventoryId', 'reason'],
        properties: {
          inventoryId: { type: 'string', format: 'uuid' },
          physicalDelta: { type: 'integer', example: 10 },
          damagedDelta: { type: 'integer', example: 5 },
          reason: { type: 'string', example: 'Damaged in transit inspection' }
        }
      }
    }
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and obtain JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated user profile' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/api/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List inventory with calculated available quantities',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'locationId', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of inventory batches with physical, reserved, damaged, available' }
        }
      }
    },
    '/api/inventory/stats': {
      get: {
        tags: ['Inventory'],
        summary: 'Get aggregate inventory totals',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Aggregate inventory statistics' }
        }
      }
    },
    '/api/inventory/adjust': {
      post: {
        tags: ['Inventory'],
        summary: 'Adjust physical or damaged stock (Operations / Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdjustStockRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Stock adjusted successfully' },
          400: { description: 'Invalid adjustment' }
        }
      }
    },
    '/api/work-orders': {
      get: {
        tags: ['Work Orders'],
        summary: 'List work orders with automated shortage calculations',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Work orders with required quantity, available at location, and shortage' }
        }
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create a Work Order (Admin Only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkOrderRequest' }
            }
          }
        },
        responses: {
          201: { description: 'Work Order created with shortage calculated' },
          403: { description: 'Forbidden (Non-admin)' }
        }
      }
    },
    '/api/transfers': {
      get: {
        tags: ['Internal Transfers'],
        summary: 'List internal stock transfers',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of transfers' }
        }
      },
      post: {
        tags: ['Internal Transfers'],
        summary: 'Request an internal stock transfer (Operations / Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransferRequest' }
            }
          }
        },
        responses: {
          201: { description: 'Transfer requested' },
          400: { description: 'Invalid transfer (insufficient stock at source or same location)' }
        }
      }
    },
    '/api/transfers/{id}/dispatch': {
      post: {
        tags: ['Internal Transfers'],
        summary: 'Dispatch transfer (Reduces source stock; destination unchanged)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Transfer dispatched' },
          400: { description: 'Cannot dispatch (insufficient stock or not in REQUESTED status)' }
        }
      }
    },
    '/api/transfers/{id}/receive': {
      post: {
        tags: ['Internal Transfers'],
        summary: 'Receive transfer (Increments destination stock; blocks duplicate receipt)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Transfer received' },
          400: { description: 'Cannot receive twice or transfer not dispatched' }
        }
      }
    },
    '/api/orders': {
      get: {
        tags: ['Customer Orders'],
        summary: 'List customer orders',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of customer orders' }
        }
      },
      post: {
        tags: ['Customer Orders'],
        summary: 'Create customer order and reserve stock (Sales / Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' }
            }
          }
        },
        responses: {
          201: { description: 'Order created and stock reserved' },
          409: { description: 'Conflict: Insufficient available inventory to reserve' }
        }
      }
    },
    '/api/orders/{id}/cancel': {
      post: {
        tags: ['Customer Orders'],
        summary: 'Cancel order and release reserved stock (Sales / Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Order cancelled and reservation released' }
        }
      }
    }
  }
};
