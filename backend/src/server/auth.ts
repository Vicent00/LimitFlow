import { TRPCError } from '@trpc/server';
import { middleware, publicProcedure } from './trpc';
import { recoverMessageAddress } from 'viem';
import { prisma } from '../db';

// Extender el contexto para incluir el usuario autenticado
export interface AuthenticatedContext {
  user?: {
    address: string;
    isAdmin: boolean;
  };
}

// Middleware para verificar autenticación
export const isAuthenticated = middleware(async ({ ctx, next }) => {
  const { req } = ctx;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No authentication token provided',
    });
  }

  try {
    // El formato del header será: "Bearer <address>:<signature>"
    const [_, authToken] = authHeader.split(' ');
    if (!authToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization format',
      });
    }

    const [address, signature] = authToken.split(':');
    if (!address || !signature) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token format',
      });
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    try {
      // Verificar la firma
      const message = `Sign this message to authenticate with LimitFlow. Nonce: ${user.nonce}`;
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid signature',
        });
      }
    } catch (error) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid signature format',
      });
    }

    // Generar nuevo nonce para la próxima autenticación
    const newNonce = Math.random().toString(36).substring(2);
    await prisma.user.update({
      where: { address: address.toLowerCase() },
      data: { nonce: newNonce },
    });

    // Añadir usuario al contexto
    return next({
      ctx: {
        ...ctx,
        user: {
          address: user.address,
          isAdmin: user.isAdmin,
        },
      },
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication failed',
      cause: error,
    });
  }
});

// Middleware para verificar admin
export const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next();
});

// Exportar procedimientos
export const protectedProcedure = publicProcedure.use(isAuthenticated);
export const adminProcedure = protectedProcedure.use(isAdmin); 