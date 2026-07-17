'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, Lock, Sparkles, Shield,
  CheckCircle, ArrowLeft, ArrowRight, TrendingUp,
  Award, BrainCircuit, Activity, Eye, EyeOff
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

const HeroCanvas = dynamic(() => import('@/components/3d/HeroCanvas'), { ssr: false });

type RegisterStep = 'details' | 'verify' | 'experience' | 'risk';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [experience, setExperience] = useState('Intermediate');
  const [riskLevel, setRiskLevel] = useState('Balanced');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage('Creating your account and preparing verification...');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phone.trim();
      setEmail(normalizedEmail);
      setPhone(normalizedPhone);

      const data = await apiFetch<{ message: string; accountExists?: boolean; deliveryMode?: string; devOtp?: string }>('/api/v2/auth/register', {
        method: 'POST',
        body: JSON.stringify({
        email: normalizedEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalizedPhone || undefined,
        })
      });
      setStep('verify');
      setDevOtp(data.devOtp || '');
      setResendCooldown(60);
      setStatusMessage(data.deliveryMode === 'mock'
        ? `${data.accountExists ? 'This email is already registered.' : 'Account created.'} Local email/SMS provider is in mock mode. Use the development code shown below.`
        : `${data.accountExists ? 'This email is already registered.' : 'Account created.'} Verification code sent. Check your email inbox.`);
      toast.success(data.accountExists
        ? 'Account found. A fresh verification code was sent.'
        : 'Registration details saved. A verification code has been sent to your email.');
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to register account.');
      toast.error(err.message || 'Unable to register account. Please check the API gateway.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsSubmitting(true);
    setStatusMessage('Requesting a fresh verification code...');
    try {
      const data = await apiFetch<{ message: string; deliveryMode?: string; devOtp?: string }>('/api/v2/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({
          key: email,
          purpose: 'registration',
          channel: 'email',
        }),
      });
      setDevOtp(data.devOtp || '');
      setResendCooldown(60);
      setStatusMessage(data.deliveryMode === 'mock'
        ? 'A new development OTP is available below.'
        : 'A fresh verification code was sent to your email.');
      toast.success('A fresh verification code has been sent.');
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to resend verification code.');
      toast.error(err.message || 'Unable to resend verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage('Verifying OTP with the API gateway...');
    
    let otpVerified = false;
    try {
      await apiFetch('/api/v2/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          key: email,
          otp: verifyCode
        })
      });
      otpVerified = true;
    } catch (err: any) {
      setStatusMessage(err.message || 'Verification failed.');
      toast.error(err.message || 'Verification failed. Please enter the latest 6-digit code.');
      setIsSubmitting(false);
      return;
    }

    try {
      setStatusMessage('OTP verified. Logging in to your account...');
      // Auto-authenticate verified user to retrieve session tokens
      const loginRes = await apiFetch<{ accessToken?: string }>('/api/v2/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });
      
      if (loginRes.accessToken) {
        localStorage.removeItem('trademind_profile');
        localStorage.setItem('trademind_token', loginRes.accessToken);
      }
      
      setStatusMessage('Email verified. Tell us a little about your trading style.');
      setStep('experience');
    } catch (err: any) {
      toast.success('Identity verified successfully!');
      toast.error('Auto-login failed: mismatch or invalid credentials. Please log in manually.');
      setStatusMessage('Verification successful, but auto-login failed. Redirecting to Login page...');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExperienceSubmit = () => {
    setStep('risk');
  };

  const handleRiskSubmit = async () => {
    setIsSubmitting(true);
    setStatusMessage('Saving onboarding preferences...');
    try {
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          experience,
          riskAppetite: riskLevel,
          phone,
        }),
      });
      setIsSubmitting(false);
      toast.success('Profile created successfully! Welcome to TradeMind!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusMessage(err.message || 'Unable to save onboarding preferences.');
      toast.error(err.message || 'Unable to save onboarding preferences.');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-950">
      {/* Left panel: Immersive 3D Brain Hologram & Brand benefits */}
      <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 border-r border-white/5 bg-slate-950/40">
        <div className="absolute inset-0 z-0 opacity-40">
          <HeroCanvas />
        </div>
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-white font-display font-bold text-lg">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs">
              TM
            </span>
            TradeMind AI
          </Link>
        </div>

        <div className="relative z-10 max-w-sm space-y-6">
          <h1 className="text-3xl font-display font-bold text-white leading-tight">
            Trade Smarter.<br />Grow Faster.<br />Stay Ahead.
          </h1>
          <p className="text-xs text-slate-400 leading-normal">
            Join 128K+ traders using institutional-grade neural networks to scan volatility and execute strategies.
          </p>

          <div className="space-y-3.5 pt-4 border-t border-white/5">
            {[
              { icon: BrainCircuit, title: 'AI-Powered Market Analysis', desc: 'Predictive neural feeds scanning economic nodes.' },
              { icon: Activity,     title: 'Automated Strategies',    desc: 'Paper-trade or deploy rules with full risk limits.' },
              { icon: Shield,       title: 'Advanced Risk Management', desc: 'Circuit breakers protecting user portfolios.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center flex-shrink-0 text-purple-400">
                  <Icon size={14} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs">{title}</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[10px] text-slate-500 flex items-center gap-2">
          <CheckCircle size={12} className="text-emerald-400" />
          Secured with end-to-end data encryption protocols.
        </div>
      </div>

      {/* Right panel: Multi-step registration forms */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="absolute top-8 right-8 text-xs text-slate-400 lg:block hidden">
          Already have an account? <Link href="/login" className="text-purple-400 font-bold hover:underline">Sign In</Link>
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Progress indicators */}
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4 mb-4">
            <span className={step === 'details' ? 'text-purple-400' : 'text-slate-400'}>1. Info</span>
            <span className="text-slate-700">/</span>
            <span className={step === 'verify' ? 'text-purple-400' : 'text-slate-400'}>2. Verify</span>
            <span className="text-slate-700">/</span>
            <span className={step === 'experience' ? 'text-purple-400' : 'text-slate-400'}>3. Level</span>
            <span className="text-slate-700">/</span>
            <span className={step === 'risk' ? 'text-purple-400' : 'text-slate-400'}>4. Risk</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div
                key="step-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card rounded-3xl p-8"
              >
                <h2 className="text-xl font-display font-bold text-white mb-2">Create Account</h2>
                <p className="text-xs text-slate-400 mb-6">Enter your credentials to configure your profile.</p>

                <form onSubmit={handleDetailsSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">First Name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full input-glass rounded-xl px-3.5 py-3"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Trader"
                        className="w-full input-glass rounded-xl px-3.5 py-3"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Email Address</label>
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
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full input-glass rounded-xl pl-9 pr-4 py-3"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full input-glass rounded-xl pl-3.5 pr-10 py-3"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Confirm</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full input-glass rounded-xl pl-3.5 pr-10 py-3"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 mt-2"
                  >
                    {isSubmitting ? 'Saving...' : 'Register details'}
                    <ArrowRight size={14} />
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                key="step-verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card rounded-3xl p-8"
              >
                <h2 className="text-xl font-display font-bold text-white mb-2">Verify Email</h2>
                <p className="text-xs text-slate-400 mb-6">Enter the 6-digit confirmation code sent to {email}.</p>
                {statusMessage && (
                  <div className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-[11px] text-purple-200">
                    {statusMessage}
                    {devOtp && <div className="mt-2 font-mono text-sm font-bold text-white">Dev OTP: {devOtp}</div>}
                  </div>
                )}

                <form onSubmit={handleVerifySubmit} className="space-y-5 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full input-glass rounded-xl px-4 py-3 text-center text-lg font-bold letter-spacing-lg"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify Code'}
                    <ArrowRight size={14} />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSubmitting}
                  className="mt-4 w-full text-[11px] font-bold text-purple-400 disabled:text-slate-600"
                >
                  {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend verification code'}
                </button>
              </motion.div>
            )}

            {step === 'experience' && (
              <motion.div
                key="step-experience"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card rounded-3xl p-8"
              >
                <h2 className="text-xl font-display font-bold text-white mb-2">Trading Experience</h2>
                <p className="text-xs text-slate-400 mb-6">Select your familiarity level with global financial assets.</p>

                <div className="space-y-3.5 text-xs">
                  {[
                    { label: 'Beginner', desc: 'New to trading. Want to learn and copy signals.' },
                    { label: 'Intermediate', desc: 'Have active accounts. Understand leverage/SL.' },
                    { label: 'Pro', desc: 'Deploy scripts. Trade large volumes and indexes.' },
                  ].map(item => (
                    <div
                      key={item.label}
                      onClick={() => setExperience(item.label)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        experience === item.label
                          ? 'border-purple-500/40 bg-purple-500/5'
                          : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/3'
                      }`}
                    >
                      <div className="font-bold text-slate-200">{item.label}</div>
                      <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                    </div>
                  ))}

                  <button
                    onClick={handleExperienceSubmit}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 mt-4"
                  >
                    Continue
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'risk' && (
              <motion.div
                key="step-risk"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card rounded-3xl p-8"
              >
                <h2 className="text-xl font-display font-bold text-white mb-2">Risk Appetite</h2>
                <p className="text-xs text-slate-400 mb-6">Select default risk constraints for automation strategies.</p>

                <div className="space-y-3.5 text-xs">
                  {[
                    { label: 'Conservative', desc: 'Low risk limit. Focus on stable, high-win signals.' },
                    { label: 'Balanced', desc: 'Standard parameters. Optimal risk-to-reward ratio.' },
                    { label: 'Aggressive', desc: 'Wide SL thresholds. Maximize leverage potential.' },
                  ].map(item => (
                    <div
                      key={item.label}
                      onClick={() => setRiskLevel(item.label)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        riskLevel === item.label
                          ? 'border-purple-500/40 bg-purple-500/5'
                          : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/3'
                      }`}
                    >
                      <div className="font-bold text-slate-200">{item.label}</div>
                      <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                    </div>
                  ))}

                  <button
                    onClick={handleRiskSubmit}
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 mt-4"
                  >
                    {isSubmitting ? 'Configuring profile...' : 'Complete Onboarding & Enter'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center text-xs lg:hidden">
            Already have an account? <Link href="/login" className="text-purple-400 font-bold hover:underline">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
