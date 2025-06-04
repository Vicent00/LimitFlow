import { router } from './trpc';
import { ordersRouter } from '../routers/orders';
import { pricesRouter } from '../routers/prices';
import { usersRouter } from '../routers/users';
import { authRouter } from '../routers/auth';
import { tokensRouter } from '../routers/tokens';

export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  prices: pricesRouter,
  users: usersRouter,
  tokens: tokensRouter,
});

export type AppRouter = typeof appRouter; 