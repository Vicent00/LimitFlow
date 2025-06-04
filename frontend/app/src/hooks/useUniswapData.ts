import { useContractRead } from 'wagmi';
import { UNISWAP_V3_POOL, UNISWAP_V3_POOL_ABI, ARBITRUM_TOKENS } from '@/lib/constants/tokens';
import { arbitrum } from 'wagmi/chains';

export const useUniswapData = () => {
  console.log('Initializing useUniswapData hook');
  console.log('Pool address:', UNISWAP_V3_POOL);
  console.log('Chain ID:', arbitrum.id);

  const { data: slot0, isError, isLoading, error } = useContractRead({
    address: UNISWAP_V3_POOL as `0x${string}`,
    abi: UNISWAP_V3_POOL_ABI,
    functionName: 'slot0',
    chainId: arbitrum.id,
  });

  console.log('Contract read result:', { slot0, isError, isLoading, error });

  const getCurrentPrice = () => {
    if (!slot0) {
      console.log('No slot0 data available');
      return null;
    }
    try {
      const sqrtPriceX96 = slot0[0];
      // Fórmula correcta para Uniswap V3: price = (sqrtPriceX96 / 2^96)^2 * (10^dec0 / 10^dec1)
      const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
      const priceAdjusted = price * (10 ** ARBITRUM_TOKENS.WETH.decimals) / (10 ** ARBITRUM_TOKENS.USDC.decimals);
      console.log('Final adjusted price:', priceAdjusted);
      return priceAdjusted;
    } catch (error) {
      console.error('Error calculating price:', error);
      return null;
    }
  };

  if (error) {
    console.error('Contract read error:', error);
  }

  const currentPrice = getCurrentPrice();
  console.log('Final current price:', currentPrice);

  return {
    currentPrice,
    isLoading,
    isError,
    error,
    // Añadir información adicional útil
    tokenInfo: {
      baseToken: ARBITRUM_TOKENS.WETH,
      quoteToken: ARBITRUM_TOKENS.USDC,
      price: currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A'
    }
  };
}; 