'use client';

import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import { FaEye, FaEyeSlash, FaCopy } from 'react-icons/fa';

export default function Profile() {
  const { address } = useAccount();
  const [showAddress, setShowAddress] = useState(false);

  const toggleAddress = () => {
    setShowAddress(!showAddress);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <div className="mt-4">
              <h2 className="text-lg font-medium text-gray-900">Wallet Information</h2>
              <div className="mt-2 flex items-center space-x-4">
                <p className="text-sm text-gray-600 font-mono">
                  {showAddress ? address : formatAddress(address || '')}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleAddress}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title={showAddress ? "Hide address" : "Show address"}
                  >
                    {showAddress ? <FaEyeSlash /> : <FaEye />}
                  </button>
                  <button
                    onClick={copyAddress}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Copy address"
                  >
                    <FaCopy />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900">Preferences</h2>
            <div className="mt-4 space-y-4">
              {/* Aquí irán las preferencias del usuario */}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
} 