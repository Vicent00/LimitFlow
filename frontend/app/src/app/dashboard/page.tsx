'use client';

import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(() => import('@/components/trading/PriceChart').then(mod => mod.PriceChart), { ssr: false });

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="mt-4">
             <PriceChart /> 
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Total Balance</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">$0.00</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Active Orders</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">0</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Completed Orders</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">0</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
            <div className="text-gray-600">
              No recent activity to show
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
} 