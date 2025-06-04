'use client';

import { Layout } from '@/components/layout/Layout';
import { FaTwitter, FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import { motion } from 'framer-motion';

const socialLinks = [
  {
    name: 'GitHub',
    icon: FaGithub,
    url: 'https://github.com/Vicent00',
    color: 'text-gray-800 dark:text-gray-200',
    hoverColor: 'hover:text-gray-900 dark:hover:text-white',
    description: 'Check out my projects and contributions.',
    bgColor: 'bg-white/50 dark:bg-gray-800/50'
  },
  {
    name: 'LinkedIn',
    icon: FaLinkedin,
    url: 'https://www.linkedin.com/in/vicente-aguilar00',
    color: 'text-blue-600 dark:text-blue-400',
    hoverColor: 'hover:text-blue-700 dark:hover:text-blue-300',
    description: 'Connect with me professionally.',
    bgColor: 'bg-white/50 dark:bg-gray-800/50'
  },
  {
    name: 'Twitter',
    icon: FaTwitter,
    url: 'https://x.com/0x_Vicent',
    color: 'text-blue-400 dark:text-blue-300',
    hoverColor: 'hover:text-blue-500 dark:hover:text-blue-200',
    description: 'Follow my updates and thoughts.',
    bgColor: 'bg-white/50 dark:bg-gray-800/50'
  },
  {
    name: 'Email',
    icon: FaEnvelope,
    url: 'mailto:info@vicenteaguilar.com',
    color: 'text-red-500 dark:text-red-400',
    hoverColor: 'hover:text-red-600 dark:hover:text-red-300',
    description: 'Send me an email.',
    bgColor: 'bg-white/50 dark:bg-gray-800/50'
  }
];

export default function Social() {
  return (
    <Layout>
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 -z-10" />
      <main className="min-h-screen w-full">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 bg-clip-text text-transparent mb-4">
              Let's Connect
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Choose your preferred way to reach out
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {socialLinks.map((social, index) => (
              <motion.a
                key={social.name}
                href={social.url}
                target={social.name === 'Email' ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className={`flex items-center p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ${social.bgColor} backdrop-blur-sm hover:scale-[1.02]`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className={`p-3 rounded-full ${social.bgColor}`}>
                  <social.icon className={`w-8 h-8 ${social.color} ${social.hoverColor}`} />
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{social.name}</h2>
                  <p className="text-gray-600 dark:text-gray-300">{social.description}</p>
                </div>
              </motion.a>
            ))}
          </div>

          <motion.div 
            className="mt-16 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:to-blue-300/10 backdrop-blur-sm p-8 rounded-3xl shadow-lg border border-white/20 dark:border-gray-700/20"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 bg-clip-text text-transparent mb-6">About Me</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              I'm a blockchain developer passionate about creating innovative solutions in the Web3 space.
              Feel free to reach out through any of my social channels - I'm always happy to connect with fellow developers
              and discuss new ideas and collaborations.
            </p>
          </motion.div>
        </div>
      </main>
    </Layout>
  );
} 