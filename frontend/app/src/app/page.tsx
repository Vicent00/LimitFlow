'use client';

import { Layout } from '@/components/layout/Layout';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { motion } from 'framer-motion';
import { FaRocket, FaShieldAlt, FaChartLine } from 'react-icons/fa';

const features = [
  {
    icon: <FaRocket className="w-6 h-6" />,
    title: 'Fast Execution',
    description: 'Execute trades with minimal latency on Arbitrum.'
  },
  {
    icon: <FaShieldAlt className="w-6 h-6" />,
    title: 'Secure Trading',
    description: 'Built with security-first principles.'
  },
  {
    icon: <FaChartLine className="w-6 h-6" />,
    title: 'Advanced Tools',
    description: 'Access powerful trading features.'
  }
];

export default function Home() {
  const { isConnected, isPublicPath } = useAuthRedirect();

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 bg-clip-text text-transparent mb-6">
                Welcome to LimitFlow
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Connect your wallet to start managing your transactions and orders.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="text-indigo-600 dark:text-indigo-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div 
            className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 md:p-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Ready to Start Trading?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Connect your wallet to access advanced trading features and manage your orders.
            </p>
          </motion.div>
        </div>
    </div>
    </Layout>
  );
}
