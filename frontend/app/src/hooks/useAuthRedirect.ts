import { useAccount } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/'];
const DEFAULT_REDIRECT = '/dashboard';

export function useAuthRedirect() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Si está en una ruta pública y está conectado, redirigir al dashboard
    if (PUBLIC_PATHS.includes(pathname) && isConnected) {
      router.push(DEFAULT_REDIRECT);
    }
    
    // Si está en una ruta protegida y no está conectado, redirigir a la página principal
    if (!PUBLIC_PATHS.includes(pathname) && !isConnected) {
      router.push('/');
    }
  }, [isConnected, pathname, router]);

  return {
    isConnected,
    isPublicPath: PUBLIC_PATHS.includes(pathname),
  };
} 