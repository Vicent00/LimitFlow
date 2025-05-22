import { z } from 'zod';
import { router, publicProcedure } from '../server/trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const signatureSchema = z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature format');

export const authRouter = router({
  // Obtener nonce para autenticación
  getNonce: publicProcedure
    .input(z.object({ 
      address: addressSchema 
    }))
    .mutation(async ({ input }) => {
      try {
        // Generar nuevo nonce
        const nonce = Math.random().toString(36).substring(2);

        // Crear o actualizar usuario
        const user = await prisma.user.upsert({
          where: { address: input.address.toLowerCase() },
          update: { nonce },
          create: {
            address: input.address.toLowerCase(),
            nonce,
          },
        });

        return { nonce: user.nonce };
      } catch (error) {
        console.error('Error generating nonce:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate nonce',
          cause: error,
        });
      }
    }),

  // Verificar autenticación
  verify: publicProcedure
    .input(z.object({
      address: addressSchema,
      signature: signatureSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { address: input.address.toLowerCase() },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // La verificación real de la firma se hace en el middleware
        // Este endpoint solo verifica que el usuario existe
        return {
          address: user.address,
          isAdmin: user.isAdmin,
        };
      } catch (error) {
        console.error('Error verifying authentication:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify authentication',
          cause: error,
        });
      }
    }),
}); 