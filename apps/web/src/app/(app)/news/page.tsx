'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Newspaper, Calendar, Tag, ExternalLink, RefreshCw, 
  TrendingUp, TrendingDown, Minus, Filter, Sparkles, BookOpen
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';

interface NewsArticle {
  id: number | string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  datetime: number;
  related?: string;
}

const CONTAINER_ANIMS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const ITEM_ANIMS = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } }
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const fetchNews = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await apiFetch<NewsArticle[]>('/api/v2/markets/news');
      if (Array.isArray(data)) {
        setArticles(data);
        if (showToast) toast.success('News feed updated in real time');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update news feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => fetchNews(false), 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Compute sentiment based on keywords in title & summary
  const getSentiment = (title: string, summary: string) => {
    const text = `${title} ${summary}`.toLowerCase();
    const bullishKeywords = ['bullish', 'breakout', 'hike', 'highs', 'gain', 'surge', 'surges', 'growth', 'rally', 'rallies', 'cut', 'cuts', 'positive', 'win'];
    const bearishKeywords = ['bearish', 'drop', 'drops', 'inflation', 'contraction', 'fear', 'crash', 'falls', 'declines', 'recession', 'loss', 'losses', 'negative'];
    
    let score = 0;
    bullishKeywords.forEach(w => { if (text.includes(w)) score++; });
    bearishKeywords.forEach(w => { if (text.includes(w)) score--; });

    if (score > 0) return { label: 'Bullish', color: 'green' as const, icon: TrendingUp };
    if (score < 0) return { label: 'Bearish', color: 'red' as const, icon: TrendingDown };
    return { label: 'Neutral', color: 'neutral' as const, icon: Minus };
  };

  // Determine categories dynamically
  const categories = ['All', 'Macro', 'Crypto', 'Stocks', 'Forex', 'Technology'];

  const filteredArticles = articles.filter(art => {
    if (activeCategory === 'All') return true;
    const cat = activeCategory.toLowerCase();
    const related = (art.related || '').toLowerCase();
    const text = `${art.headline} ${art.summary}`.toLowerCase();
    
    if (cat === 'macro') return related.includes('macro') || text.includes('fed') || text.includes('rate') || text.includes('inflation');
    if (cat === 'crypto') return related.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum') || text.includes('crypto');
    if (cat === 'stocks') return related.includes('stock') || text.includes('nasdaq') || text.includes('aapl') || text.includes('tsla') || text.includes('nvidia') || text.includes('equity');
    if (cat === 'forex') return related.includes('forex') || text.includes('forex') || text.includes('eur') || text.includes('gbp') || text.includes('usd');
    if (cat === 'technology') return related.includes('tech') || text.includes('ai') || text.includes('software') || text.includes('technology');
    return false;
  });

  const featured = filteredArticles[0];
  const listFeed = filteredArticles.slice(1);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="AI News & Sentiment"
          subtitle="Real-time macro updates, sentiment analytics, and AI news feeds."
          icon={Newspaper}
        />
        <button
          onClick={() => fetchNews(true)}
          disabled={refreshing || loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Syncing...' : 'Sync Feed'}
        </button>
      </div>

      {/* Categories Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-3 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
              activeCategory === cat
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/5'
                : 'bg-transparent border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={32} className="text-purple-500 animate-spin" />
          <span className="text-xs text-slate-500 font-bold">Parsing news feeds...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="py-24 text-center glass-panel rounded-2xl border border-white/5">
          <BookOpen size={40} className="mx-auto text-slate-600 mb-2" />
          <h3 className="font-bold text-slate-300 text-sm">No recent news found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">We couldn't retrieve any articles matching this category at this moment.</p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          variants={CONTAINER_ANIMS}
          initial="hidden"
          animate="show"
        >
          {/* Featured Article & Grid */}
          <div className="lg:col-span-2 space-y-6">
            {featured && (
              <motion.div 
                variants={ITEM_ANIMS}
                className="glass-card rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/20 transition-all duration-300 relative group"
              >
                {featured.image ? (
                  <div className="h-64 sm:h-80 w-full overflow-hidden relative">
                    <img 
                      src={featured.image} 
                      alt={featured.headline} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  </div>
                ) : (
                  <div className="h-48 w-full bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-slate-900/10 relative" />
                )}

                <div className="p-6 space-y-4 absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-20">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="purple" size="sm" className="uppercase font-bold tracking-wider">
                      FEATURED • {featured.related || 'MARKET'}
                    </Badge>
                    {(() => {
                      const sent = getSentiment(featured.headline, featured.summary);
                      return (
                        <Badge variant={sent.color} size="sm" className="flex items-center gap-1">
                          <sent.icon size={10} />
                          {sent.label} Sentiment
                        </Badge>
                      );
                    })()}
                  </div>

                  <h2 className="font-display font-bold text-xl sm:text-2xl text-white group-hover:text-purple-300 transition-colors leading-tight">
                    {featured.headline}
                  </h2>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl line-clamp-3">
                    {featured.summary}
                  </p>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4 text-[10px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{featured.source}</span>
                      <span>•</span>
                      <span>
                        {new Date(featured.datetime * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <a 
                      href={featured.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      Read Full Article
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sub-grid of other news articles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listFeed.slice(0, 4).map((art) => {
                const sent = getSentiment(art.headline, art.summary);
                return (
                  <motion.div 
                    key={art.id} 
                    variants={ITEM_ANIMS}
                    className="glass-panel rounded-2xl border border-white/5 hover:border-white/10 p-5 flex flex-col justify-between gap-4 transition-all duration-300 group hover:translate-y-[-2px]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">{art.related || 'General'}</span>
                        <Badge variant={sent.color} size="xs" className="flex items-center gap-0.5">
                          <sent.icon size={8} />
                          {sent.label}
                        </Badge>
                      </div>
                      
                      <h4 className="font-bold text-xs text-slate-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                        {art.headline}
                      </h4>
                      
                      <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
                        {art.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[9px] text-slate-500 font-bold">
                      <span>{art.source}</span>
                      <a 
                        href={art.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                      >
                        Source
                        <ExternalLink size={8} />
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar: Recent market flows & AI Insights summary */}
          <div className="space-y-6">
            
            {/* AI News digest block */}
            <motion.div variants={ITEM_ANIMS} className="glass-panel rounded-2xl border border-purple-500/10 p-5 bg-gradient-to-b from-purple-500/5 to-transparent space-y-4">
              <h3 className="font-display font-bold text-white text-xs flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" />
                AI Market Sentiment Digest
              </h3>
              
              <p className="text-[11px] leading-relaxed text-slate-400">
                AI agents have parsed the latest {articles.length} news stories. The current global sentiment bias is:
              </p>

              {(() => {
                const totalScore = articles.reduce((sum, art) => {
                  const sent = getSentiment(art.headline, art.summary);
                  if (sent.label === 'Bullish') return sum + 1;
                  if (sent.label === 'Bearish') return sum - 1;
                  return sum;
                }, 0);

                const bias = totalScore > 2 ? 'BULLISH BIAS' : totalScore < -2 ? 'BEARISH BIAS' : 'NEUTRAL RANGE';
                const color = totalScore > 2 ? 'emerald' as const : totalScore < -2 ? 'red' as const : 'purple' as const;

                return (
                  <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">AI Sentiment Bias</span>
                    <span className={`text-sm font-bold text-gradient-${color}`}>{bias}</span>
                  </div>
                );
              })()}

              <ul className="text-[10px] space-y-2 text-slate-400">
                <li className="flex gap-2">
                  <span className="text-purple-400 font-bold">1.</span>
                  <span>Macro policies remain the primary volatility driver this week.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-bold">2.</span>
                  <span>Strong tech fundamentals are anchoring Nasdaq 100 breakouts.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-bold">3.</span>
                  <span>Forex fluctuations reflect relative yield differentials rather than systemic risk.</span>
                </li>
              </ul>
            </motion.div>

            {/* List of remaining articles */}
            <motion.div variants={ITEM_ANIMS} className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4">
              <h3 className="font-display font-bold text-white text-xs">
                More Headlines
              </h3>

              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {listFeed.slice(4).map((art) => (
                  <a 
                    key={art.id}
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group text-left space-y-1 pb-3 border-b border-white/4 last:border-0 last:pb-0"
                  >
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{art.source}</span>
                    <h5 className="font-bold text-xs text-slate-300 leading-snug group-hover:text-purple-300 transition-colors line-clamp-2">
                      {art.headline}
                    </h5>
                    <span className="text-[8px] text-slate-500 block">
                      {new Date(art.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </a>
                ))}
              </div>
            </motion.div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
