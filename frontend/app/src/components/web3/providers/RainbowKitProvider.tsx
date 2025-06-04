'use client';

import { getDefaultWallets, RainbowKitProvider as RKProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID) {
  throw new Error('Missing NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID');
}

const { connectors } = getDefaultWallets({
  appName: 'LimitFlow',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
});

const config = createConfig({
  chains: [arbitrum],
  connectors,
  transports: {
    [arbitrum.id]: http(),
  },
});

const queryClient = new QueryClient();

const customTheme = darkTheme({
  accentColor: '#000000',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
});

export function RainbowKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RKProvider theme={customTheme}>
          {children}
        </RKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 