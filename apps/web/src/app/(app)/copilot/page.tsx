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

const AI_RESPONSES: Record<string, string> = {
  'btc': `**BTC/USD Analysis — Real-Time Assessment**

📈 **Technical Picture**: Bitcoin is trading at $64,318 showing a strong breakout above the EMA-200 on the 4H chart. RSI is at 62 — bullish momentum without being overbought. MACD has crossed bullish.

🏦 **Macro Context**: BTC ETF net inflows accelerated this week (+$420M). The DXY (dollar index) is softening, historically a strong tailwind for BTC.

🎯 **Key Levels**:
- Support: $62,800 (EMA-50) | $61,200 (major)
- Resistance: $65,500 | $68,000 (ATH zone)

⚡ **AI Signal**: **BUY** with 91% confidence. Entry zone: $63,800–$64,400. Stop-loss: $63,200. Target 1: $66,000. Target 2: $68,500.

⚠️ **Risk**: Watch for resistance at $65,500. Position size maximum 2% of portfolio.`,
  
  'portfolio': `**Portfolio Risk Assessment — Current State**

✅ **Diversification Score**: 78/100 — Good but can improve.

📊 **Current Allocation**:
- Crypto: 68% (slightly overweight — consider reducing to 55%)
- Equities: 17% (underweight — target 25%)
- Forex: 0% (consider adding 10-15% hedge positions)

⚠️ **Risk Alerts**:
1. **High Crypto Concentration**: 68% crypto exposure creates high volatility risk
2. **Missing Hedges**: No inverse positions or options hedging active
3. **Sharpe Ratio**: 1.42 — Good, but can be optimized

🔧 **Recommendations**:
1. Reduce BTC allocation from 55% → 40%
2. Add NVDA/AAPL positions to strengthen equity exposure
3. Consider EUR/USD long position as macro hedge
4. Set trailing stop-losses on all crypto positions at -8%`,

  'signals': `**Top AI Signals — Active Right Now**

🚀 **1. BTC/USD — BUY** | Confidence: 91%
   Entry: $64,200 | SL: $63,500 | TP: $66,000 → $68,500
   Strategy: Trend Following AI | Duration: 4–8 hours

📈 **2. SOL/USD — BUY** | Confidence: 88%  
   Entry: $182 | SL: $174 | TP: $196 → $212
   Strategy: Breakout AI | Duration: 2–3 days

💹 **3. EUR/USD — BUY** | Confidence: 84%
   Entry: 1.0850 | SL: 1.0810 | TP: 1.0920 → 1.0970
   Strategy: Smart Money AI | Duration: 1 day

🔻 **4. AAPL — SELL** | Confidence: 76%
   Entry: $197.34 | SL: $200.50 | TP: $191 → $185
   Strategy: Swing Trading AI | Duration: 3 days

📌 **Market Sentiment**: 84% Bullish overall. Crypto markets leading. Risk-on environment active.`,

  'strategy': `**Smart Money AI Strategy — Deep Dive**

🧠 **How It Works**: Smart Money AI tracks institutional order flow by analyzing large block trades, dark pool prints, options positioning, and liquidity zone accumulation patterns.

📊 **Signal Generation Process**:
1. Detect institutional accumulation in price range (order blocks)
2. Identify liquidity sweeps (stop hunts by large players)
3. Confirm fair value gap (FVG) presence on 15M–1H charts
4. Wait for market structure shift (MSS) to confirm direction
5. Generate entry signal with predefined SL/TP levels

📈 **Historical Performance** (2023–2026):
- Win Rate: 72%
- Average R:R: 1:2.8
- Max Drawdown: 12.4%
- Annual Return: 31.2%
- Sharpe Ratio: 1.89

⚙️ **Best Market Conditions**: Low VIX (12–20), trending markets, high institutional volume. Avoid during major news events.`,
};

function getAIResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('btc') || lower.includes('bitcoin')) return AI_RESPONSES['btc'];
  if (lower.includes('portfolio') || lower.includes('risk')) return AI_RESPONSES['portfolio'];
  if (lower.includes('signal')) return AI_RESPONSES['signals'];
  if (lower.includes('strategy') || lower.includes('smart money')) return AI_RESPONSES['strategy'];
  return `I've analyzed your query about "${message}".

📊 Based on current market conditions and your portfolio composition, here's my assessment:

The AI engine has processed 2,847 data points across technical indicators, fundamental metrics, and market sentiment signals. Current market conditions show a **risk-on** environment with 84% bullish sentiment aggregate.

**Key Insights**:
- Global liquidity is expanding, supporting risk assets
- Institutional positioning is net-long across major asset classes
- AI prediction confidence is running at 92% — above 6-month average

For more specific analysis, try asking about:
- A specific asset (e.g., "Analyze ETH/USD")
- Your portfolio risk ("Review my portfolio")
- Active signals ("What signals are active?")
- Trading strategies ("Explain Trend Following AI")`;
}

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

    await new Promise(r => setTimeout(r, 1400 + Math.random() * 800));
    const response = getAIResponse(text);
    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date() };
    setTyping(false);
    addMessage(aiMsg);
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
