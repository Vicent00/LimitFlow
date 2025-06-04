import { prisma } from '../db';
import axios from 'axios';
import { createPublicClient, http, Address } from 'viem';
import { arbitrum } from 'viem/chains';
import { monitoringService } from './monitoring';

// ABI para Chainlink Price Feed
const CHAINLINK_PRICE_FEED_ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// Mapeo de pares de tokens a sus feeds de Chainlink en Arbitrum
const CHAINLINK_FEEDS: Record<string, { address: Address; decimals: number; isInverse?: boolean }> = {
  'ETH/USD': {
    address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    decimals: 8
  },
  'USDC/USD': {
    address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
    decimals: 8
  },
  'WETH/USD': {
    address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', // Mismo que ETH/USD en Arbitrum
    decimals: 8
  },
  'USDC/WETH': {
    address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', // Usamos ETH/USD y calculamos el inverso
    decimals: 8,
    isInverse: true
  },
  'BTC/USD': {
    address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    decimals: 8
  },
  'LINK/USD': {
    address: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    decimals: 8
  }
  // Añade más pares según necesites
};

interface PriceData {
  price: number;
  timestamp: number;
  source: string;
  liquidity?: number;
}

/**
 * @title PriceOracle
 * @description Servicio para obtener y validar precios de tokens desde múltiples fuentes
 * @class
 */
export class PriceOracle {
  private static readonly MAX_PRICE_AGE = 5 * 60 * 1000; // 5 minutos
  private static readonly MIN_LIQUIDITY = 100000; // $100k mínimo
  private static readonly MAX_PRICE_DEVIATION = 0.01; // 1% de desviación máxima
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 segundo

  private viemClient;

  /**
   * @constructor
   * @description Inicializa el cliente Viem para interactuar con la blockchain
   * @throws {Error} Si hay un error al inicializar el cliente
   */
  constructor() {
    try {
      this.viemClient = createPublicClient({
        chain: arbitrum,
        transport: http()
      });
      console.info('[PriceOracle] Cliente Viem inicializado correctamente');
    } catch (error) {
      console.error('[PriceOracle] Error al inicializar cliente Viem:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to initialize Viem client');
    }
  }

  /**
   * @private
   * @description Función auxiliar para manejar reintentos de operaciones
   * @param operation Función a ejecutar con reintentos
   * @param operationName Nombre de la operación para logging
   * @returns {Promise<T>} Resultado de la operación
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= PriceOracle.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${operationName}] Intento ${attempt}/${PriceOracle.MAX_RETRIES} fallido:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        
        if (attempt < PriceOracle.MAX_RETRIES) {
          const delay = PriceOracle.RETRY_DELAY * attempt;
          console.info(`[${operationName}] Esperando ${delay}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error(`Failed after ${PriceOracle.MAX_RETRIES} attempts`);
  }

  /**
   * @public
   * @description Obtiene y valida el precio de un par de tokens
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @returns {Promise<bigint>} Precio validado en formato BigInt
   * @throws {Error} Si no hay precios válidos disponibles
   */
  async getValidatedPrice(tokenIn: string, tokenOut: string): Promise<bigint> {
    const startTime = Date.now();
    
    // Validación de parámetros de entrada
    if (!tokenIn || !tokenOut) {
      throw new Error('TokenIn y TokenOut son requeridos');
    }

    console.info(`[getValidatedPrice] Consultando precio para par:`, {
      tokenIn,
      tokenOut,
      timestamp: new Date().toISOString()
    });

    try {
      // Obtener precios de múltiples fuentes
      const prices = await Promise.all([
        this.getChainlinkPrice(tokenIn, tokenOut),
        this.getBinancePrice(tokenIn, tokenOut),
        this.getCoinGeckoPrice(tokenIn, tokenOut)
      ]);

      // Validar que al menos una fuente devolvió un precio
      const validPrices = prices.filter((price): price is PriceData => 
        price !== null &&
        Date.now() - price.timestamp < PriceOracle.MAX_PRICE_AGE &&
        (!price.liquidity || price.liquidity > PriceOracle.MIN_LIQUIDITY)
      );

      if (validPrices.length === 0) {
        const error = new Error('No valid prices available');
        console.error('[getValidatedPrice] No hay precios válidos disponibles:', {
          tokenIn,
          tokenOut,
          timestamp: new Date().toISOString(),
          error: error.message,
          sources: prices.map(p => p?.source || 'null')
        });
        throw error;
      }

      // Validar que los precios no estén muy dispersos
      const priceValues = validPrices.map(p => p.price);
      const maxPrice = Math.max(...priceValues);
      const minPrice = Math.min(...priceValues);
      const priceSpread = (maxPrice - minPrice) / minPrice;

      if (priceSpread > 0.1) { // 10% de dispersión máxima
        console.warn('[getValidatedPrice] Alta dispersión en precios:', {
          tokenIn,
          tokenOut,
          minPrice,
          maxPrice,
          spread: priceSpread,
          sources: validPrices.map(p => p.source),
          timestamp: new Date().toISOString()
        });
      }

      // Calcular precio mediano
      const medianPrice = this.calculateMedianPrice(validPrices);

      // Validar que el precio mediano sea positivo
      if (medianPrice <= 0) {
        const error = new Error('Invalid median price calculated');
        console.error('[getValidatedPrice] Precio mediano inválido:', {
          tokenIn,
          tokenOut,
          medianPrice,
          sources: validPrices.map(p => p.source),
          timestamp: new Date().toISOString(),
          error: error.message
        });
        throw error;
      }

      // Convertir a BigInt (multiplicando por 10^18 para mantener precisión)
      const priceBigInt = BigInt(Math.floor(medianPrice * 1e18));

      // Guardar precio en la base de datos
      try {
        await this.savePrice(tokenIn, tokenOut, medianPrice);
      } catch (dbError) {
        // No fallamos si hay error al guardar en DB, solo lo registramos
        console.error('[getValidatedPrice] Error al guardar precio en DB:', {
          tokenIn,
          tokenOut,
          medianPrice,
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }

      const duration = Date.now() - startTime;
      console.info(`[getValidatedPrice] Precio obtenido en ${duration}ms:`, {
        tokenIn,
        tokenOut,
        price: medianPrice,
        priceBigInt: priceBigInt.toString(),
        sources: validPrices.map(p => p.source),
        timestamp: new Date().toISOString()
      });

      monitoringService.trackOperationTime('getValidatedPrice', duration);
      return priceBigInt;
    } catch (error) {
      console.error('[getValidatedPrice] Error al obtener precio validado:', {
        tokenIn,
        tokenOut,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * @private
   * @description Obtiene el precio desde Chainlink
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @returns {Promise<PriceData | null>} Datos del precio o null si no está disponible
   */
  private async getChainlinkPrice(tokenIn: string, tokenOut: string): Promise<PriceData | null> {
    return this.withRetry(async () => {
      try {
        const pair = `${tokenIn}/${tokenOut}`;
        const feed = CHAINLINK_FEEDS[pair];

        if (!feed) {
          console.warn(`[getChainlinkPrice] No hay feed disponible para ${pair}`);
          return null;
        }

        // Validar que la dirección del feed sea válida
        if (!feed.address || typeof feed.address !== 'string') {
          console.error('[getChainlinkPrice] Dirección de feed inválida:', {
            pair,
            feedAddress: feed.address,
            timestamp: new Date().toISOString()
          });
          return null;
        }

        console.info(`[getChainlinkPrice] Consultando feed de Chainlink:`, {
          pair,
          feedAddress: feed.address,
          timestamp: new Date().toISOString()
        });

        const [roundData, decimals] = await Promise.all([
          this.viemClient.readContract({
            address: feed.address,
            abi: CHAINLINK_PRICE_FEED_ABI,
            functionName: 'latestRoundData'
          }),
          this.viemClient.readContract({
            address: feed.address,
            abi: CHAINLINK_PRICE_FEED_ABI,
            functionName: 'decimals'
          })
        ]);

        // Validar datos del round
        if (!roundData || typeof roundData !== 'object') {
          throw new Error('Invalid round data received from Chainlink');
        }

        const { answer, updatedAt } = roundData as any;
        
        // Validar que answer sea un número válido
        if (typeof answer !== 'bigint' || answer <= 0n) {
          throw new Error('Invalid price answer from Chainlink');
        }

        // Validar que updatedAt sea un timestamp válido
        if (typeof updatedAt !== 'bigint' || updatedAt <= 0n) {
          throw new Error('Invalid timestamp from Chainlink');
        }

        let price = Number(answer) / (10 ** Number(decimals));

        // Validar que el precio sea positivo
        if (price <= 0) {
          throw new Error('Invalid price calculated from Chainlink data');
        }

        if (feed.isInverse) {
          price = 1 / price;
        }

        const result = {
          price,
          timestamp: Number(updatedAt) * 1000,
          source: 'chainlink'
        };

        console.info(`[getChainlinkPrice] Precio obtenido:`, {
          pair,
          price,
          chainlinkTimestamp: result.timestamp,
          currentTimestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        console.error('[getChainlinkPrice] Error al obtener precio de Chainlink:', {
          tokenIn,
          tokenOut,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'getChainlinkPrice');
  }

  /**
   * @private
   * @description Obtiene el precio desde Binance
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @returns {Promise<PriceData | null>} Datos del precio o null si no está disponible
   */
  private async getBinancePrice(tokenIn: string, tokenOut: string): Promise<PriceData | null> {
    return this.withRetry(async () => {
      try {
        const symbol = `${tokenIn}${tokenOut}`;
        console.info(`[getBinancePrice] Consultando precio en Binance:`, {
          symbol,
          timestamp: new Date().toISOString()
        });

        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = response.data as any;

        const result = {
          price: parseFloat(data.price),
          timestamp: Date.now(),
          source: 'binance'
        };

        console.info(`[getBinancePrice] Precio obtenido:`, {
          symbol,
          price: result.price,
          timestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        console.error('[getBinancePrice] Error al obtener precio de Binance:', {
          tokenIn,
          tokenOut,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'getBinancePrice');
  }

  /**
   * @private
   * @description Obtiene el precio desde CoinGecko
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @returns {Promise<PriceData | null>} Datos del precio o null si no está disponible
   */
  private async getCoinGeckoPrice(tokenIn: string, tokenOut: string): Promise<PriceData | null> {
    return this.withRetry(async () => {
      try {
        console.info(`[getCoinGeckoPrice] Consultando precio en CoinGecko:`, {
          tokenIn,
          tokenOut,
          timestamp: new Date().toISOString()
        });

        const response = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIn}&vs_currencies=${tokenOut}`
        );
        const data = response.data as any;

        const result = {
          price: data[tokenIn][tokenOut],
          timestamp: Date.now(),
          source: 'coingecko'
        };

        console.info(`[getCoinGeckoPrice] Precio obtenido:`, {
          tokenIn,
          tokenOut,
          price: result.price,
          timestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        console.error('[getCoinGeckoPrice] Error al obtener precio de CoinGecko:', {
          tokenIn,
          tokenOut,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }, 'getCoinGeckoPrice');
  }

  /**
   * @private
   * @description Calcula el precio mediano de una lista de precios
   * @param prices Lista de datos de precios
   * @returns {number} Precio mediano
   */
  private calculateMedianPrice(prices: PriceData[]): number {
    const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
    const middle = Math.floor(sortedPrices.length / 2);
    
    if (sortedPrices.length % 2 === 0) {
      return (sortedPrices[middle - 1] + sortedPrices[middle]) / 2;
    }
    
    return sortedPrices[middle];
  }

  /**
   * @private
   * @description Guarda el precio en la base de datos
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @param price Precio a guardar
   * @throws {Error} Si hay un error al guardar el precio
   */
  private async savePrice(tokenIn: string, tokenOut: string, price: number): Promise<void> {
    try {
      console.info(`[savePrice] Guardando precio en base de datos:`, {
        tokenIn,
        tokenOut,
        price,
        timestamp: new Date().toISOString()
      });

      await prisma.$executeRaw`
        INSERT INTO "Price" (id, "tokenIn", "tokenOut", price, timestamp, source, "chainId")
        VALUES (gen_random_uuid(), ${tokenIn}, ${tokenOut}, ${price}, NOW(), 'oracle', 1)
      `;

      console.info(`[savePrice] Precio guardado correctamente`);
    } catch (error) {
      console.error('[savePrice] Error al guardar precio en base de datos:', {
        tokenIn,
        tokenOut,
        price,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * @public
   * @description Valida si el precio de una orden está dentro del rango aceptable
   * @param orderPrice Precio de la orden
   * @param tokenIn Token de entrada
   * @param tokenOut Token de salida
   * @returns {Promise<boolean>} true si el precio es válido
   */
  async validateOrderPrice(orderPrice: bigint, tokenIn: string, tokenOut: string): Promise<boolean> {
    const startTime = Date.now();

    // Validación de parámetros de entrada
    if (!orderPrice || orderPrice <= 0n) {
      throw new Error('Order price must be positive');
    }
    if (!tokenIn || !tokenOut) {
      throw new Error('TokenIn y TokenOut son requeridos');
    }

    console.info(`[validateOrderPrice] Validando precio de orden:`, {
      orderPrice: orderPrice.toString(),
      tokenIn,
      tokenOut,
      timestamp: new Date().toISOString()
    });

    try {
      const oraclePrice = await this.getValidatedPrice(tokenIn, tokenOut);
      
      // Validar que el precio del oracle sea positivo
      if (oraclePrice <= 0n) {
        throw new Error('Invalid oracle price received');
      }

      const priceDeviation = Number(orderPrice - oraclePrice) / Number(oraclePrice);
      const isValid = Math.abs(priceDeviation) <= PriceOracle.MAX_PRICE_DEVIATION;

      const duration = Date.now() - startTime;
      console.info(`[validateOrderPrice] Validación completada en ${duration}ms:`, {
        orderPrice: orderPrice.toString(),
        oraclePrice: oraclePrice.toString(),
        priceDeviation,
        isValid,
        timestamp: new Date().toISOString()
      });

      monitoringService.trackOperationTime('validateOrderPrice', duration);
      return isValid;
    } catch (error) {
      console.error('[validateOrderPrice] Error al validar precio de orden:', {
        orderPrice: orderPrice.toString(),
        tokenIn,
        tokenOut,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
} 