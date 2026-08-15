'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Lock, Mail, ChevronRight, ArrowLeft,
  Eye, EyeOff, Key, Sparkles, AlertCircle, AlertTriangle, MessageCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

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

        const role = data.user?.role;
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
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Immersive background graphics */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-color-dodge pointer-events-none"
          style={{ backgroundImage: "url('/bull-bear.png')" }}
          animate={{
            x: mouseCoords.x * -30,
            y: mouseCoords.y * -30,
            rotate: mouseCoords.x * 2.5,
            scale: 1.06
          }}
          transition={{ type: 'spring', stiffness: 45, damping: 15 }}
        />
        {/* Soft parallax glowing blobs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/10 filter blur-[120px] animate-neural" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 filter blur-[100px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-6 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to landing page
        </Link>

        <div className="glass-card rounded-3xl p-8 border border-white/8 bg-slate-950/40 backdrop-blur-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center mx-auto mb-4">
              <Lock className="text-purple-400" size={20} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white">Enter the Ecosystem</h2>
            <p className="text-xs text-slate-400 mt-2">Access TradeMind AI autonomous trading center</p>
          </div>

          {suspendedMsg && (
            <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs space-y-3 mb-6">
              <div className="flex items-center gap-2 font-bold text-red-200">
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <span>Account Suspended by Admin</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">{suspendedMsg}</p>
              <a
                href="https://wa.me/254712345678?text=Hello%20TradeMind%20Admin%2C%20my%20account%20has%20been%20suspended.%20Please%20assist."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-md cursor-pointer"
              >
                <MessageCircle size={14} />
                <span>Chat Admin on WhatsApp (+254712345678)</span>
              </a>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 text-xs">
            <AnimatePresence mode="wait">
              {!is2FA ? (
                <motion.div
                  key="form-credentials"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Email Address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full input-glass rounded-xl pl-9 pr-4 py-3"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Password</label>
                      <Link href="/forgot-password" className="text-[10px] text-purple-400 hover:underline">Forgot password?</Link>
                    </div>
                    <div className="relative">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full input-glass rounded-xl pl-9 pr-10 py-3"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-2fa"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className="p-3.5 rounded-xl border border-purple-500/10 bg-purple-500/5 text-purple-300 flex items-start gap-2.5">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      2-Factor Authentication enabled. Enter the 6-digit code sent to your email to authorize entry.
                      {devOtp && <strong className="block mt-2 font-mono text-white">Dev OTP: {devOtp}</strong>}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={code2fa}
                      onChange={e => setCode2fa(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full input-glass rounded-xl px-4 py-3 text-center text-lg font-bold letter-spacing-lg"
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs"
            >
              {isSubmitting ? 'Authenticating...' : is2FA ? 'Verify 2FA & Enter' : 'Secure Login'}
              {!isSubmitting && <ChevronRight size={14} />}
            </button>
          </form>

          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <span className="text-slate-500">Don't have an account? </span>
            <Link href="/register" className="text-purple-400 font-bold hover:underline">Create Account</Link>
          </div>
        </div>

        {/* Security badges */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Sessions encrypted with SSL/TLS • AI Fraud Protection enabled</span>
        </div>
      </motion.div>
    </div>
  );
}
