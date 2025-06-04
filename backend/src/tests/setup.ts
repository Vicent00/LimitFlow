import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Obtener el directorio actual en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde el archivo .env
config({ path: resolve(__dirname, '../../.env') });

// Verificar variables de entorno requeridas
const requiredEnvVars = [
  'ORDER_CONTRACT_ADDRESS',
  'WALLET_PRIVATE_KEY',
  'WALLET_ADDRESS',
  'ARBITRUM_RPC_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
} 