'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-100">
          <main className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-gray-900 text-2xl font-bold">Órdenes</h1>
              <div className="flex space-x-4">
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                  Nueva Orden
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg text-gray-500 font-semibold mb-4">Lista de Órdenes</h2>
                  <div className="text-gray-500">No hay órdenes disponibles</div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg text-gray-500 font-semibold mb-4">Crear Nueva Orden</h2>
                <div className="text-gray-500">Formulario de creación de órdenes</div>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    </ProtectedRoute>
  );
} 