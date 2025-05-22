import { router } from './trpc';
import { ordersRouter } from '../routers/orders';
import { pricesRouter } from '../routers/prices';
import { usersRouter } from '../routers/users';
import { authRouter } from '../routers/auth';

export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  prices: pricesRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter; 