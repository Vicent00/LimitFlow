import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from './db.js';
import { User } from '@prisma/client';
import { NextApiRequest } from 'next';

interface CreateContextOptions {
  req: NextApiRequest;
  res?: any;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    req: opts.req,
    res: opts.res,
    prisma,
    user: null as User | null,
  };
};

export const createTRPCContext = async (opts: CreateContextOptions) => {
  return createInnerTRPCContext(opts);
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

// Export createCaller function
export const createCaller = t.createCallerFactory; 