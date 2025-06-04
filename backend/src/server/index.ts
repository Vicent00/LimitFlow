import express from 'express';
import { createContext } from './context.js';
import { appRouter } from './router.js';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { SecurityMiddleware } from '../middleware/security.js';
import { loadSecurityConfig } from '../config/security.js';
import { ValidationService } from '../services/validation.js';
import { eventService } from '../services/eventService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

async function startServer() {
  try {
    // Cargar configuración
    const config = loadSecurityConfig();
    
    // Inicializar servicios
    const securityMiddleware = new SecurityMiddleware(config);
    const validationService = new ValidationService(config);
    
    // Iniciar el servicio de eventos
    await eventService.startListening();
    
    const app = express();

    // Aplicar middlewares de seguridad
    app.use(securityMiddleware.helmetMiddleware);
    app.use(securityMiddleware.corsMiddleware);
    app.use(securityMiddleware.rateLimiter);

    // tRPC middleware
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: async (opts) => {
          const ctx = await createContext(opts);
          return {
            ...ctx,
            validation: validationService
          };
        },
        onError: ({ error }) => {
          const handledError = errorHandler(error);
          logger.error('tRPC Error:', handledError);
        }
      })
    );

    const port = config.PORT;
    app.listen(port, () => {
      logger.info(`Server running in ${config.NODE_ENV} mode on port ${port}`);
    });
  } catch (error) {
    const handledError = errorHandler(error);
    logger.error('Failed to start server:', handledError);
    process.exit(1);
  }
}

startServer(); 