import { createPublicClient, http, recoverMessageAddress, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { prisma } from '../db';

interface User {
  id: string;
  address: string;
  isAdmin: boolean;
}

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  address: string
): Promise<boolean> {
  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature
    });

    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function authenticateUser(
  address: string,
  signature: `0x${string}`,
  nonce: string
): Promise<User | null> {
  try {
    // Verificar la firma del nonce
    const message = `Welcome to LimitFlow!\n\nClick to sign in and accept the LimitFlow Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${address}\n\nNonce:\n${nonce}`;
    
    const isValid = await verifySignature(message, signature, address);
    if (!isValid) {
      return null;
    }

    // Buscar o crear usuario
    const user = await prisma.user.upsert({
      where: { address },
      create: {
        address,
        isAdmin: false,
        nonce: generateNonce()
      },
      update: {
        // Actualizar el nonce para la próxima autenticación
        nonce: generateNonce()
      }
    });

    return {
      id: user.id,
      address: user.address,
      isAdmin: user.isAdmin
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export async function getNonce(address: string): Promise<string> {
  const user = await prisma.user.upsert({
    where: { address },
    create: {
      address,
      nonce: generateNonce()
    },
    update: {
      nonce: generateNonce()
    }
  });

  return user.nonce || generateNonce();
} 