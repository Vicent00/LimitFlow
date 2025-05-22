import { prisma } from '../db';
import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';

export const createContext = ({ req, res }: CreateExpressContextOptions) => ({
  prisma,
  req,
  res,
});

export type Context = inferAsyncReturnType<typeof createContext>; 