import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  try {
    // Crear usuario admin por defecto
    const adminAddress = process.env.ADMIN_ADDRESS;
    if (adminAddress) {
      await prisma.user.upsert({
        where: { address: adminAddress },
        update: { isAdmin: true },
        create: {
          address: adminAddress,
          isAdmin: true,
        },
      });
      console.log('✅ Admin user created/updated');
    }

    // Crear índices y configuraciones adicionales si son necesarias
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 