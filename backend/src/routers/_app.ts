import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { authRouter } from './auth.js';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  contextUtils: publicProcedure.query(({ ctx }) => ctx),
});

export type AppRouter = typeof appRouter; 