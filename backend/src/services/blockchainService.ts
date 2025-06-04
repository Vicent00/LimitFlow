import { createPublicClient, http, PublicClient, WalletClient, createWalletClient } from 'viem';
import { arbitrum } from 'viem/chains';
import { monitoringService } from './monitoring';
import { TRPCError } from '@trpc/server';
import { OrderParams, OrderCreatedEvent, OrderCancelledEvent, OrderExecutedEvent } from '../types/contracts';
import { privateKeyToAccount } from 'viem/accounts';
import { LimitOrderProtocol } from '../contracts/LimitOrderProtocol';

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

/**
 * @title BlockchainService
 * @description Servicio para interactuar con la blockchain y el contrato LimitOrderProtocol
 * @class
 */
export class BlockchainService {
  private static instance: BlockchainService;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 segundo
  private readonly orderContractAddress: `0x${string}`;
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly account: `0x${string}`;
  private readonly walletAccount: ReturnType<typeof privateKeyToAccount>;

  /**
   * @private
   * @constructor
   * @description Constructor privado para implementar el patrón Singleton
   * @throws {Error} Si las variables de entorno no están configuradas correctamente
   */
  private constructor() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
    this.orderContractAddress = (process.env.ORDER_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
    
    // Obtener la clave privada y asegurarnos de que esté en el formato correcto
    const privateKey = process.env.WALLET_PRIVATE_KEY || '';
    if (!privateKey) {
      console.error('WALLET_PRIVATE_KEY no está configurado');
      throw new Error('WALLET_PRIVATE_KEY environment variable is required');
    }
    
    // Debug: Mostrar información sobre la clave privada
    console.log('Debug - Private Key Info:', {
      originalLength: privateKey.length,
      has0xPrefix: privateKey.startsWith('0x'),
      firstChars: privateKey.slice(0, 10) + '...',
      lastChars: '...' + privateKey.slice(-10)
    });
    
    // Asegurarnos de que la clave privada sea un hex válido de 64 caracteres
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Debug: Mostrar información sobre la clave limpia
    console.log('Debug - Clean Private Key Info:', {
      cleanLength: cleanPrivateKey.length,
      isHex: /^[0-9a-fA-F]{64}$/.test(cleanPrivateKey),
      firstChars: cleanPrivateKey.slice(0, 10) + '...',
      lastChars: '...' + cleanPrivateKey.slice(-10)
    });
    
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
      console.error('WALLET_PRIVATE_KEY debe ser un número hexadecimal de 64 caracteres');
      throw new Error('Invalid private key format');
    }
    
    // Asegurarnos de que la clave privada tenga el prefijo 0x
    this.account = `0x${cleanPrivateKey}` as `0x${string}`;
    
    // Verificar que la dirección de la wallet sea válida
    const walletAddress = process.env.WALLET_ADDRESS || '';
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      console.error('WALLET_ADDRESS debe ser una dirección de wallet válida (40 caracteres)');
      throw new Error('Invalid wallet address format');
    }
    
    if (this.orderContractAddress === '0x0000000000000000000000000000000000000000') {
      console.error('ORDER_CONTRACT_ADDRESS no está configurado');
      throw new Error('ORDER_CONTRACT_ADDRESS environment variable is required');
    }
    
    try {
      this.walletAccount = privateKeyToAccount(this.account);
      this.publicClient = createPublicClient({
        chain: arbitrum,
        transport: http(rpcUrl),
      });

      this.walletClient = createWalletClient({
        chain: arbitrum,
        transport: http(rpcUrl),
        account: this.walletAccount,
      });
    } catch (error) {
      console.error('Error al inicializar los clientes de blockchain:', error);
      throw new Error('Failed to initialize blockchain clients');
    }
  }

  /**
   * @public
   * @static
   * @description Obtiene la instancia única del servicio
   * @returns {BlockchainService} Instancia del servicio
   */
  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  /**
   * @private
   * @description Función auxiliar para manejar reintentos de operaciones
   * @param operation Función a ejecutar con reintentos
   * @param operationName Nombre de la operación para logging
   * @returns {Promise<T>} Resultado de la operación
   * @throws {TRPCError} Si la operación falla después de todos los reintentos
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${operationName}] Intento ${attempt}/${this.MAX_RETRIES} fallido:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt;
          console.info(`[${operationName}] Esperando ${delay}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `[${operationName}] Failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
      cause: lastError,
    });
  }

  /**
   * @public
   * @description Obtiene el balance de ETH de una dirección
   * @param address Dirección de la wallet
   * @returns {Promise<bigint>} Balance en wei
   * @throws {TRPCError} Si hay un error al obtener el balance
   */
  async getBalance(address: string): Promise<bigint> {
    return this.withRetry(async () => {
      const balance = await this.publicClient.getBalance({ address: address as `0x${string}` });
      return balance;
    }, 'getBalance');
  }

  /**
   * @public
   * @description Obtiene el balance de un token ERC20
   * @param tokenAddress Dirección del contrato del token
   * @param userAddress Dirección del usuario
   * @returns {Promise<bigint>} Balance del token
   * @throws {TRPCError} Si hay un error al obtener el balance del token
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    return this.withRetry(async () => {
      const balance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      return balance;
    }, 'getTokenBalance');
  }

  async getGasPrice(): Promise<bigint> {
    const startTime = Date.now();
    console.info('[getGasPrice] Consultando precio del gas');
    
    return this.withRetry(async () => {
      try {
        const gasPrice = await this.publicClient.getGasPrice();
        const duration = Date.now() - startTime;
        
        console.info(`[getGasPrice] Precio del gas obtenido en ${duration}ms:`, {
          gasPrice: gasPrice.toString(),
          timestamp: new Date().toISOString()
        });
        
        monitoringService.trackOperationTime('getGasPrice', duration);
        return gasPrice;
      } catch (error) {
        console.error('[getGasPrice] Error al obtener precio del gas:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'getGasPrice');
  }

  async estimateGas(transaction: any): Promise<bigint> {
    const startTime = Date.now();
    console.info('[estimateGas] Estimando gas para transacción:', {
      to: transaction.to,
      data: transaction.data?.slice(0, 66) + '...', // Solo mostramos el inicio del data
      timestamp: new Date().toISOString()
    });

    return this.withRetry(async () => {
      try {
        const gasEstimate = await this.publicClient.estimateGas(transaction);
        const duration = Date.now() - startTime;
        
        console.info(`[estimateGas] Gas estimado en ${duration}ms:`, {
          gasEstimate: gasEstimate.toString(),
          timestamp: new Date().toISOString()
        });
        
        monitoringService.trackOperationTime('estimateGas', duration);
        return gasEstimate;
      } catch (error) {
        console.error('[estimateGas] Error al estimar gas:', {
          transaction: {
            to: transaction.to,
            data: transaction.data?.slice(0, 66) + '...'
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'estimateGas');
  }

  async getTransactionReceipt(txHash: string) {
    const startTime = Date.now();
    console.info('[getTransactionReceipt] Consultando recibo de transacción:', {
      txHash,
      timestamp: new Date().toISOString()
    });

    return this.withRetry(async () => {
      try {
        const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        const duration = Date.now() - startTime;
        
        console.info(`[getTransactionReceipt] Recibo obtenido en ${duration}ms:`, {
          txHash,
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          timestamp: new Date().toISOString()
        });
        
        monitoringService.trackOperationTime('getTransactionReceipt', duration);
        return receipt;
      } catch (error) {
        console.error('[getTransactionReceipt] Error al obtener recibo:', {
          txHash,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'getTransactionReceipt');
  }

  async waitForTransaction(txHash: string, confirmations: number = 1) {
    const startTime = Date.now();
    console.info('[waitForTransaction] Esperando confirmaciones de transacción:', {
      txHash,
      confirmations,
      timestamp: new Date().toISOString()
    });

    return this.withRetry(async () => {
      try {
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
          confirmations
        });
        
        const duration = Date.now() - startTime;
        console.info(`[waitForTransaction] Transacción confirmada en ${duration}ms:`, {
          txHash,
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          confirmations,
          timestamp: new Date().toISOString()
        });
        
        monitoringService.trackOperationTime('waitForTransaction', duration);
        return receipt;
      } catch (error) {
        console.error('[waitForTransaction] Error al esperar confirmaciones:', {
          txHash,
          confirmations,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'waitForTransaction');
  }

  async getBlockNumber(): Promise<number> {
    const startTime = Date.now();
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      monitoringService.trackOperationTime('getBlockNumber', Date.now() - startTime);
      return Number(blockNumber);
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get block number',
        cause: error,
      });
    }
  }

  async getBlock(blockNumber: number) {
    const startTime = Date.now();
    try {
      const block = await this.publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
      monitoringService.trackOperationTime('getBlock', Date.now() - startTime);
      return block;
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get block',
        cause: error,
      });
    }
  }

  /**
   * @public
   * @description Crea una nueva orden en el contrato
   * @param params Parámetros de la orden
   * @returns {Promise<`0x${string}`>} Hash de la transacción
   * @throws {TRPCError} Si hay un error al crear la orden
   */
  async createOrder(params: OrderParams): Promise<`0x${string}`> {
    return this.withRetry(async () => {
      // Validar parámetros
      if (!params.amountIn || params.amountIn <= 0n) {
        throw new Error('amountIn debe ser mayor que 0');
      }
      if (!params.minAmountOut || params.minAmountOut <= 0n) {
        throw new Error('minAmountOut debe ser mayor que 0');
      }

      const hash = await this.walletClient.writeContract({
        chain: arbitrum,
        account: this.walletAccount,
        address: this.orderContractAddress,
        abi: LimitOrderProtocol.abi,
        functionName: 'createOrder',
        args: [
          params.tokenIn as `0x${string}`,
          params.tokenOut as `0x${string}`,
          params.amountIn,
          params.minAmountOut,
          params.expiryTime
        ]
      });
      return hash;
    }, 'createOrder');
  }

  /**
   * @public
   * @description Cancela una orden existente
   * @param orderId ID de la orden a cancelar
   * @returns {Promise<`0x${string}`>} Hash de la transacción
   * @throws {TRPCError} Si hay un error al cancelar la orden
   */
  async cancelOrder(orderId: string): Promise<`0x${string}`> {
    return this.withRetry(async () => {
      const hash = await this.walletClient.writeContract({
        chain: arbitrum,
        account: this.walletAccount,
        address: this.orderContractAddress,
        abi: LimitOrderProtocol.abi,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)]
      });
      return hash;
    }, 'cancelOrder');
  }

  /**
   * @public
   * @description Ejecuta una orden existente
   * @param orderId ID de la orden a ejecutar
   * @returns {Promise<`0x${string}`>} Hash de la transacción
   * @throws {TRPCError} Si hay un error al ejecutar la orden
   */
  async executeOrder(orderId: string): Promise<`0x${string}`> {
    return this.withRetry(async () => {
      const hash = await this.walletClient.writeContract({
        chain: arbitrum,
        account: this.walletAccount,
        address: this.orderContractAddress,
        abi: LimitOrderProtocol.abi,
        functionName: 'executeOrder',
        args: [BigInt(orderId)]
      });
      return hash;
    }, 'executeOrder');
  }

  /**
   * @public
   * @description Escucha eventos de órdenes del contrato
   * @param callback Función a ejecutar cuando se recibe un evento
   * @returns {Promise<() => void>} Función para detener la escucha
   */
  async listenToOrderEvents(callback: (event: OrderCreatedEvent | OrderCancelledEvent | OrderExecutedEvent) => void) {
    console.info('[listenToOrderEvents] Iniciando escucha de eventos de órdenes');
    
    const unwatch = this.publicClient.watchContractEvent({
      address: this.orderContractAddress,
      abi: LimitOrderProtocol.abi,
      eventName: 'OrderCreated',
      onLogs: logs => {
        logs.forEach(log => {
          try {
            const event = {
              orderId: log.args.orderId,
              user: log.args.user,
              tokenIn: log.args.tokenIn,
              tokenOut: log.args.tokenOut,
              amountIn: log.args.amountIn,
              minAmountOut: log.args.minAmountOut,
              expiryTime: log.args.expiryTime
            } as OrderCreatedEvent;
            
            console.info('[listenToOrderEvents] Evento OrderCreated recibido:', {
              event,
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              timestamp: new Date().toISOString()
            });
            
            callback(event);
          } catch (error) {
            console.error('[listenToOrderEvents] Error al procesar evento:', {
              error: error instanceof Error ? error.message : 'Unknown error',
              log,
              timestamp: new Date().toISOString()
            });
          }
        });
      },
    });

    console.info('[listenToOrderEvents] Escucha de eventos iniciada correctamente');
    return unwatch;
  }

  /**
   * @public
   * @description Obtiene los detalles de una orden
   * @param orderId ID de la orden
   * @returns {Promise<any>} Detalles de la orden
   * @throws {TRPCError} Si hay un error al obtener los detalles
   */
  async getOrderDetails(orderId: string) {
    return this.withRetry(async () => {
      const order = await this.publicClient.readContract({
        address: this.orderContractAddress,
        abi: LimitOrderProtocol.abi,
        functionName: 'orders',
        args: [BigInt(orderId)]
      });
      return order;
    }, 'getOrderDetails');
  }

  /**
   * @public
   * @description Aprueba tokens para el contrato
   * @param tokenAddress Dirección del token
   * @param amount Cantidad a aprobar
   * @returns {Promise<`0x${string}`>} Hash de la transacción
   * @throws {TRPCError} Si hay un error al aprobar los tokens
   */
  async approveToken(tokenAddress: string, amount: bigint): Promise<`0x${string}`> {
    return this.withRetry(async () => {
      const walletAddress = process.env.WALLET_ADDRESS || '';
      if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      const currentAllowance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, this.orderContractAddress]
      });

      if (currentAllowance >= amount) {
        return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
      }

      const hash = await this.walletClient.writeContract({
        chain: arbitrum,
        account: this.walletAccount,
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.orderContractAddress, amount]
      });
      return hash;
    }, 'approveToken');
  }

  /**
   * @public
   * @description Obtiene el allowance de un token
   * @param tokenAddress Dirección del token
   * @param ownerAddress Dirección del propietario
   * @returns {Promise<bigint>} Cantidad aprobada
   * @throws {TRPCError} Si hay un error al obtener el allowance
   */
  async getTokenAllowance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
    return this.withRetry(async () => {
      const allowance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, this.orderContractAddress]
      });
      return allowance;
    }, 'getTokenAllowance');
  }
}

export const blockchainService = BlockchainService.getInstance(); 