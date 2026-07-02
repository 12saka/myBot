'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { motion } from 'framer-motion';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <motion.main
          className="flex-1 overflow-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">
            {children}
          </div>
        </motion.main>

        {/* Mobile Bottom Navigation */}
        <nav className="glass-panel fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 py-2 md:hidden">
          <div className="flex items-center justify-around px-2">
            {[
              { href: '/dashboard', label: 'Home',     emoji: '🏠' },
              { href: '/markets',   label: 'Markets',  emoji: '📊' },
              { href: '/signals',   label: 'Signals',  emoji: '⚡' },
              { href: '/portfolio', label: 'Portfolio',emoji: '💼' },
              { href: '/copilot',   label: 'Copilot',  emoji: '🤖' },
            ].map(({ href, label, emoji }) => (
              <a
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500 hover:text-white transition-colors"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-[10px] font-medium">{label}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
