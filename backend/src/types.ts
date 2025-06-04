import { router } from './trpc';
import { ordersRouter } from './routers/orders';
import { authRouter } from './routers/auth';
import { tokensRouter } from './routers/tokens';
import { pricesRouter } from './routers/prices';
import { monitoringRouter } from './routers/monitoring';
import { usersRouter } from './routers/users';

export const appRouter = router({
  orders: ordersRouter,
  auth: authRouter,
  tokens: tokensRouter,
  prices: pricesRouter,
  monitoring: monitoringRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter; 