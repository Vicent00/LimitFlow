import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { verifyMessage } from 'viem';
import { addMinutes } from 'date-fns';

// Constantes
const NONCE_EXPIRATION_MINUTES = 5;

// Schemas
const addressSchema = z.string()
  .regex(/^0x[a-f0-9]{40}$/, 'Invalid Ethereum address format')
  .transform(addr => addr.toLowerCase());

// Utilidades
const generateNonce = () => randomBytes(16).toString('hex');

// Tipos
type UserWithNonce = {
  id: string;
  address: string;
  isAdmin: boolean;
  nonce: string;
  nonceExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(z.object({
      address: addressSchema,
      isAdmin: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verificar si el usuario ya existe
      const existingUser = await ctx.prisma.user.findUnique({
        where: { address: input.address }
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User already exists'
        });
      }

      // 2. Generar nonce y fecha de expiración
      const nonce = generateNonce();
      const nonceExpiresAt = addMinutes(new Date(), NONCE_EXPIRATION_MINUTES);

      // 3. Crear usuario
      const user = await ctx.prisma.user.create({
        data: {
          address: input.address,
          isAdmin: input.isAdmin,
          nonce,
          nonceExpiresAt
        } as Prisma.UserCreateInput
      });

      return user as UserWithNonce;
    }),

  login: publicProcedure
    .input(z.object({
      address: addressSchema
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verificar si el usuario existe
      const user = await ctx.prisma.user.findUnique({
        where: { address: input.address }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // 2. Generar nuevo nonce y fecha de expiración
      const newNonce = generateNonce();
      const nonceExpiresAt = addMinutes(new Date(), NONCE_EXPIRATION_MINUTES);
      
      // 3. Actualizar usuario
      const updatedUser = await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          nonce: newNonce,
          nonceExpiresAt
        } as Prisma.UserUpdateInput
      });

      return { user: updatedUser as UserWithNonce };
    }),

  getNonce: publicProcedure
    .input(z.object({
      address: addressSchema
    }))
    .query(async ({ ctx, input }) => {
      // 1. Verificar si el usuario existe
      const user = await ctx.prisma.user.findUnique({
        where: { address: input.address }
      }) as UserWithNonce | null;

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // 2. Verificar si el nonce ha expirado
      if (user.nonceExpiresAt < new Date()) {
        // 2.1 Generar nuevo nonce si ha expirado
        const newNonce = generateNonce();
        const nonceExpiresAt = addMinutes(new Date(), NONCE_EXPIRATION_MINUTES);
        
        await ctx.prisma.user.update({
          where: { id: user.id },
          data: {
            nonce: newNonce,
            nonceExpiresAt
          } as Prisma.UserUpdateInput
        });

        return { nonce: newNonce };
      }

      return { nonce: user.nonce };
    }),

  verifySignature: publicProcedure
    .input(z.object({
      address: addressSchema,
      signature: z.string().min(1, 'Signature is required').transform(sig => sig as `0x${string}`),
      nonce: z.string().min(1, 'Nonce is required')
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verificar si el usuario existe
      const user = await ctx.prisma.user.findUnique({
        where: { address: input.address }
      }) as UserWithNonce | null;

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // 2. Verificar que el nonce coincide y no ha expirado
      if (user.nonce !== input.nonce) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid nonce'
        });
      }

      if (user.nonceExpiresAt < new Date()) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nonce has expired'
        });
      }

      // 3. Crear el mensaje que se espera que esté firmado
      const message = `Sign this message to verify your wallet ownership. Nonce: ${input.nonce}`;

      try {
        // 4. Verificar la firma
        const isValid = await verifyMessage({
          message,
          signature: input.signature,
          address: input.address as `0x${string}`
        });

        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid signature'
          });
        }

        // 5. Generar nuevo nonce para la próxima verificación
        const newNonce = generateNonce();
        const nonceExpiresAt = addMinutes(new Date(), NONCE_EXPIRATION_MINUTES);
        
        const updatedUser = await ctx.prisma.user.update({
          where: { id: user.id },
          data: { 
            nonce: newNonce,
            nonceExpiresAt
          } as Prisma.UserUpdateInput
        });

        return {
          verified: true,
          user: updatedUser as UserWithNonce
        };
      } catch (error) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid signature',
          cause: error
        });
      }
    })
}); 