import { initTRPC } from '@trpc/server';
import { Context } from './context';
import { AuthenticatedContext } from './auth';

const t = initTRPC.context<Context & AuthenticatedContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Middleware para autenticación
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error('Not authenticated');
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Middleware para admin
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw new Error('Not authorized');
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Exportar procedimientos
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin); 