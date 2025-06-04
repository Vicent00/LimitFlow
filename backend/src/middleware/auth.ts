import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import { authenticateUser } from '../utils/auth';
import { RateLimiter } from '../utils/rateLimit';
import { UserReputation } from '../utils/userReputation';
import { NextApiRequest } from 'next';
import { prisma } from '../db';

interface User {
  id: string;
  address: string;
  isAdmin: boolean;
}

interface AuthenticatedUser extends User {
  nonce: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Context {
  req: NextApiRequest & { 
    ip?: string;
    headers: {
      'x-wallet-address'?: string | string[];
      'x-wallet-signature'?: string | string[];
      'x-wallet-nonce'?: string | string[];
    };
  };
  user: AuthenticatedUser | null;
  prisma: typeof prisma;
}

const rateLimiter = new RateLimiter();
const userReputation = new UserReputation();

export const authMiddleware = middleware(async ({ ctx, next, path }) => {
  try {
    // 1. Verificar autenticación por wallet
    const address = Array.isArray(ctx.req.headers['x-wallet-address']) 
      ? ctx.req.headers['x-wallet-address'][0] 
      : ctx.req.headers['x-wallet-address'];
    
    const signature = Array.isArray(ctx.req.headers['x-wallet-signature'])
      ? ctx.req.headers['x-wallet-signature'][0]
      : ctx.req.headers['x-wallet-signature'];
    
    const nonce = Array.isArray(ctx.req.headers['x-wallet-nonce'])
      ? ctx.req.headers['x-wallet-nonce'][0]
      : ctx.req.headers['x-wallet-nonce'];

    if (!address || !signature || !nonce) {
      throw new TRPCError({ 
        code: 'UNAUTHORIZED',
        message: 'Missing wallet authentication'
      });
    }

    // Asegurar que la firma tiene el formato correcto
    if (!signature.startsWith('0x')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid signature format'
      });
    }

    const user = await authenticateUser(address, signature as `0x${string}`, nonce);
    if (!user) {
      throw new TRPCError({ 
        code: 'UNAUTHORIZED',
        message: 'Invalid wallet signature'
      });
    }

    // 2. Verificar rate limit
    const ip = ctx.req.socket.remoteAddress || 'unknown';
    const rateLimitResult = await rateLimiter.check({
      ip,
      userId: user.id,
      action: path
    });

    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds`
      });
    }

    // 3. Verificar reputación del usuario
    const canProceed = await userReputation.canProceed(user.id);
    if (!canProceed) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account temporarily restricted due to suspicious activity'
      });
    }

    // 4. Obtener usuario completo de la base de datos
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!fullUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'User not found after authentication'
      });
    }

    // 5. Añadir usuario al contexto
    ctx.user = fullUser;

    return next();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication failed',
      cause: error
    });
  }
}); 