'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { PublicHeader } from './PublicHeader';
import { Suspense } from 'react';

const PUBLIC_PATHS = ['/', '/about', '/social'];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100" />}>
        {isPublicPath ? <PublicHeader /> : <Header />}
      </Suspense>
      <main className="container mx-auto px-4 py-8">
        <Suspense fallback={<div className="animate-pulse bg-gray-200 h-96 rounded-lg" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
} 