'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Mail, ChevronRight, ArrowLeft,
  Eye, EyeOff, Key, AlertTriangle, AlertCircle, MessageCircle, Loader2,
  Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [is2FA, setIs2FA] = useState(false);
  const [code2fa, setCode2fa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suspendedMsg, setSuspendedMsg] = useState('');
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
  const [devOtp, setDevOtp] = useState('');
  const [inactivityNotice, setInactivityNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'inactivity') {
        setInactivityNotice(true);
      }
    }
  }, []);

  type LoginResponse = {
    accessToken?: string;
    requires2fa?: boolean;
    devOtp?: string;
    deliveryMode?: string;
    user?: {
      id: string;
      email: string;
      role?: string;
      firstName?: string;
      lastName?: string;
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMouseCoords({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all credentials.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: LoginResponse = is2FA
        ? await apiFetch<LoginResponse>('/api/v2/auth/complete-2fa', {
            method: 'POST',
            body: JSON.stringify({ email, otp: code2fa }),
          })
        : await apiFetch<LoginResponse>('/api/v2/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });

      if (data.requires2fa) {
        setIs2FA(true);
        setDevOtp(data.devOtp || '');
        toast.success('Credentials verified. Please enter your 2FA authentication code.');
      } else {
        localStorage.removeItem('trademind_profile');
        if (data.accessToken) {
          localStorage.setItem('trademind_token', data.accessToken);
        }
        if (data.user) {
          localStorage.setItem('trademind_profile', JSON.stringify({ profileData: data.user, role: data.user.role }));
        }

        toast.success('Successfully authenticated! Redirecting to command center...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      if (msg.toLowerCase().includes('suspended')) {
        setSuspendedMsg(msg);
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 overflow-hidden bg-[#070A11] selection:bg-amber-500/20 selection:text-amber-200">
      {/* Dynamic Institutional Matrix Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Subtle Bull & Bear Watermark Silhouette */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07] mix-blend-screen pointer-events-none"
          style={{ backgroundImage: "url('/bull-bear.png')" }}
          animate={{
            x: mouseCoords.x * -18,
            y: mouseCoords.y * -18,
            scale: 1.04
          }}
          transition={{ type: 'spring', stiffness: 35, damping: 20 }}
        />

        {/* Ambient Institutional Radial Glows */}
        <div 
          className="absolute top-1/4 -left-20 w-[550px] h-[550px] rounded-full blur-[140px] opacity-15"
          style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20"
          style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[180px] opacity-10"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 75%)' }}
        />

        {/* Institutional Grid Overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loginGrid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>

        {/* Subtle Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070A11] via-transparent to-[#070A11]/80" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-[420px]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Navigation Back */}
        <div className="flex items-center justify-between mb-5">
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors group px-2.5 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Landing</span>
          </Link>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>System Active</span>
          </div>
        </div>

        {/* Glass Card */}
        <div className="relative rounded-2xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/90 overflow-hidden">
          {/* Subtle Top Accent Horizon Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          
          {/* Subtle Header Glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-6 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-indigo-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-3 shadow-inner shadow-amber-500/10">
              <Lock className="text-amber-400" size={20} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Institutional Terminal</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed">
              Authenticate to TradeMind quantitative trading engines & academy
            </p>
          </div>

          {/* Inactivity Notice */}
          {inactivityNotice && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs mb-5 relative z-10 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-white mb-0.5">Session Locked for Inactivity</strong>
                <span className="text-[11px] text-amber-300/90 leading-relaxed">
                  Your session was automatically protected. Please re-enter your credentials to resume.
                </span>
              </div>
            </div>
          )}

          {/* Suspended Notice */}
          {suspendedMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-2.5 mb-5 relative z-10">
              <div className="flex items-center gap-2 font-bold text-red-200">
                <AlertTriangle size={15} className="text-red-400 shrink-0" />
                <span>Account Suspended</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">{suspendedMsg}</p>
              <a
                href="https://wa.me/254780566096?text=Hello%20TradeMind%20Admin%2C%20my%20account%20has%20been%20suspended.%20Please%20assist."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-md cursor-pointer"
              >
                <MessageCircle size={13} />
                <span>Chat Admin on WhatsApp (+254780566096)</span>
              </a>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs relative z-10">
            <AnimatePresence mode="wait">
              {!is2FA ? (
                <motion.div
                  key="form-credentials"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-300 tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="trader@domain.com"
                        className="w-full bg-[#0E1424] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all duration-200"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] uppercase font-bold text-slate-300 tracking-wider">
                        Password
                      </label>
                      <Link 
                        href="/forgot-password" 
                        className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline transition-colors font-medium"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#0E1424] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all duration-200"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-2fa"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="space-y-3.5"
                >
                  <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-200 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-indigo-400" />
                    <span className="text-xs leading-relaxed">
                      Two-Factor Authentication is active. Enter the 6-digit code sent to your email.
                      {devOtp && <strong className="block mt-1.5 font-mono text-white text-xs bg-black/40 px-2 py-1 rounded">Dev OTP: {devOtp}</strong>}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-300 tracking-wider mb-1.5">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={code2fa}
                      onChange={e => setCode2fa(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full bg-[#0E1424] border border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-bold font-mono tracking-widest text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all duration-200"
                      required
                      autoFocus
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={!isSubmitting ? { scale: 1.01 } : {}}
              whileTap={!isSubmitting ? { scale: 0.98 } : {}}
              className={cn(
                "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs select-none relative overflow-hidden shadow-lg mt-2 min-h-[44px]",
                isSubmitting
                  ? "bg-slate-800 text-slate-400 cursor-wait border border-white/5"
                  : "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 font-bold hover:brightness-110 shadow-amber-500/20 active:ring-2 active:ring-amber-400 cursor-pointer"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-slate-400 shrink-0" />
                  <span className="font-mono tracking-wide">Validating Institutional Node...</span>
                </>
              ) : (
                <>
                  <span>{is2FA ? 'Verify Code & Enter Terminal' : 'Authenticate Terminal Access'}</span>
                  <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5 shrink-0" />
                </>
              )}
            </motion.button>
          </form>

          {/* Footer Link */}
          <div className="mt-5 border-t border-white/5 pt-4 text-center">
            <span className="text-slate-400 text-xs">Don't have an account? </span>
            <Link href="/register" className="text-amber-400 font-bold hover:underline text-xs">
              Create Account
            </Link>
          </div>
        </div>

        {/* Security & System Status */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>256-Bit SSL/TLS Encrypted</span>
          </div>
          <span className="hidden sm:inline text-slate-700">•</span>
          <span>TradeMind v3.2 Core</span>
        </div>
      </motion.div>
    </div>
  );
}
