'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Zap, TrendingUp, Shield, BarChart3,
  Sparkles, ChevronRight, User
} from 'lucide-react';
import { useAIStore, ChatMessage } from '@/store/useAIStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: 'Analyze BTC/USD current market conditions' },
  { icon: Shield,     text: 'Review my portfolio risk and suggest adjustments' },
  { icon: BarChart3,  text: 'What are the top AI signals right now?' },
  { icon: Zap,        text: 'Explain the Smart Money AI strategy' },
];



function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div className={cn(
        'h-8 w-8 flex-shrink-0 rounded-xl flex items-center justify-center text-xs font-bold',
        isUser ? 'bg-purple-500/20 text-purple-300 border border-purple-500/25' : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/25'
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-purple-500/15 text-slate-100 border border-purple-500/20 rounded-tr-sm'
          : 'glass-card text-slate-200 rounded-tl-sm'
      )}>
        {message.content.split('\n').map((line, i) => (
          <p key={i} className={line === '' ? 'h-2' : ''}>
            {line.startsWith('**') && line.endsWith('**')
              ? <strong className="text-white">{line.slice(2, -2)}</strong>
              : line}
          </p>
        ))}
        <div className={cn('text-[10px] mt-2', isUser ? 'text-purple-400/60 text-right' : 'text-slate-600')}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
}

export default function CopilotPage() {
  const { copilotMessages, isTyping, addMessage, setTyping } = useAIStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setInput('');

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date() };
    addMessage(userMsg);
    setTyping(true);

    try {
      const token = localStorage.getItem('trademind_token');
      // Format history matching python expectations
      const history = copilotMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v2/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text, history })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      const data = await response.json();
      
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: data.reply, 
        timestamp: new Date(data.timestamp || Date.now()) 
      };
      addMessage(aiMsg);
    } catch (err: any) {
      console.error('[Copilot] Backend chat failed:', err.message);
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm unable to reach the AI backend right now. Please check that all services are running and try again.\n\nError: ${err.message}`,
        timestamp: new Date()
      };
      addMessage(errMsg);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <PageHeader
        title="AI Copilot"
        subtitle="Powered by multi-agent GPT-4o + FinBERT + custom trading models"
        icon={Bot}
        className="mb-4"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-semibold">
          <Sparkles size={12} />
          AI Online
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <div className="hidden lg:block space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Analysis</h3>
            <div className="space-y-2">
              {QUICK_PROMPTS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => sendMessage(text)}
                  className="w-full text-left flex items-start gap-2.5 p-3 rounded-xl btn-ghost text-xs group"
                >
                  <Icon size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors leading-normal">{text}</span>
                  <ChevronRight size={12} className="text-slate-600 flex-shrink-0 ml-auto mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">AI Capabilities</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              {[
                'Real-time market analysis',
                'Portfolio optimization',
                'Risk assessment',
                'Strategy explanations',
                'Signal interpretation',
                'Educational content',
              ].map(cap => (
                <li key={cap} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col glass-card rounded-2xl overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {copilotMessages.map(msg => <MessageBubble key={msg.id} message={msg} />)}

            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/25 flex items-center justify-center">
                    <Bot size={14} className="text-indigo-300" />
                  </div>
                  <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-purple-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/5 p-4">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about markets, signals, strategies, portfolio..."
                disabled={isTyping}
                className="input-glass flex-1 px-4 py-3 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="btn-primary px-4 py-3 rounded-xl disabled:opacity-50 flex items-center gap-2 text-sm font-semibold"
              >
                <Send size={16} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              TradeMind Copilot uses real-time data + AI models. Not financial advice. Always verify signals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
