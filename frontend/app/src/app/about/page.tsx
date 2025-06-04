'use client';

import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { FaRocket, FaShieldAlt, FaChartLine, FaUsers } from 'react-icons/fa';

const features = [
  {
    icon: <FaRocket className="w-6 h-6" />,
    title: 'High Performance',
    description: 'Execute trades with minimal latency and maximum efficiency on Arbitrum.'
  },
  {
    icon: <FaShieldAlt className="w-6 h-6" />,
    title: 'Secure & Reliable',
    description: 'Built with security-first principles and battle-tested smart contracts.'
  },
  {
    icon: <FaChartLine className="w-6 h-6" />,
    title: 'Advanced Trading',
    description: 'Access powerful trading tools and real-time market data.'
  },
  {
    icon: <FaUsers className="w-6 h-6" />,
    title: 'Community Driven',
    description: 'Join a growing community of traders and developers.'
  }
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

export default function About() {
  return (
    <Layout>
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 -z-10" />
      <main className="min-h-screen w-full">
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
                About LimitFlow
              </h1>
              <p className="text-xl text-gray-800 dark:text-gray-400 max-w-3xl mx-auto">
                Revolutionizing decentralized trading with advanced limit order execution on Arbitrum.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="text-indigo-600 dark:text-indigo-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-700 dark:text-gray-200">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mission Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div 
            className="bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-500 dark:to-blue-400 rounded-3xl p-8 md:p-12 shadow-lg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-lg text-white mb-8">
              LimitFlow is dedicated to bringing institutional-grade trading tools to the decentralized world. 
              We're building the future of DeFi trading with a focus on security, performance, and user experience.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-2">Security First</h3>
                <p className="text-white">Audited smart contracts and battle-tested infrastructure.</p>
              </div>
              <div className="bg-white/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-2">User Focused</h3>
                <p className="text-white">Intuitive interface designed for both beginners and professionals.</p>
              </div>
              <div className="bg-white/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-2">Innovation Driven</h3>
                <p className="text-white">Constantly evolving with the latest DeFi technologies.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tech Stack Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-500 mb-4">Built with Modern Tech</h2>
            <p className="text-gray-700 dark:text-gray-400">Leveraging cutting-edge technologies for optimal performance.</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {['Arbitrum', 'Solidity', 'Next.js', 'TailwindCSS', 'Wagmi', 'Viem', 'Node.js', 'Typescript'].map((tech, index) => (
              <motion.div
                key={tech}
                className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 text-center hover:shadow-lg transition-shadow duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">{tech}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
} 