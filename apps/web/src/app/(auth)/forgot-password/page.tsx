'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail, Phone, ShieldCheck, ChevronRight, ArrowLeft,
  Key, Sparkles, CheckCircle2, Lock, AlertTriangle,
  RefreshCw, Smartphone, Check, HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

type RecoveryStep = 'method' | 'input' | 'otp' | 'reset' | 'success';
type RecoveryMethod = 'email' | 'phone';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>('method');
  const [method, setMethod] = useState<RecoveryMethod>('email');
  const [inputValue, setInputValue] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes (300s)
  const [resendCooldown, setResendCooldown] = useState(60); // 1 minute cooldown
  const [statusMessage, setStatusMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (step !== 'otp' || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleSelectMethod = (selected: RecoveryMethod) => {
    setMethod(selected);
    setInputValue('');
    setStep('input');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      toast.error(`Please enter your registered ${method === 'email' ? 'email' : 'phone number'}`);
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(`Sending OTP to your ${method === 'email' ? 'email address' : 'phone number'}...`);
    try {
      const data = await apiFetch<{ deliveryMode?: string; devOtp?: string }>('/api/v2/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
        method,
        inputValue
        })
      });
      setStep('otp');
      setCountdown(300);
      setResendCooldown(60);
      setDevOtp(data.devOtp || '');
      setStatusMessage(data.deliveryMode === 'mock'
        ? 'Local delivery is in mock mode. Use the development OTP below.'
        : 'OTP sent. Check the selected recovery channel.');
      toast.success(`Secure OTP delivered to your ${method === 'email' ? 'email address' : 'mobile phone'}`);
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to send OTP.');
      toast.error(err.message || 'Unable to send OTP. Please verify the account details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || isNaN(Number(otp))) {
      toast.error('Invalid OTP. Code must be 6 digits.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage('Verifying OTP with the API gateway...');
    try {
      await apiFetch('/api/v2/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
        key: inputValue,
        otp
        })
      });
      setStep('reset');
      setStatusMessage('Identity verified. Create a new secure password.');
      toast.success('Identity verified. Please define a new secure password.');
    } catch (err: any) {
      setStatusMessage(err.message || 'OTP verification failed.');
      toast.error(err.message || 'OTP verification failed. Please enter the latest code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage('Resetting password and revoking active sessions...');
    try {
      await apiFetch('/api/v2/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
        key: inputValue,
        newPassword: password
        })
      });
      setStep('success');
      toast.success('Password successfully reset! All active sessions revoked.');
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to reset password.');
      toast.error(err.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsSubmitting(true);
    setStatusMessage('Requesting a fresh recovery OTP...');
    try {
      const data = await apiFetch<{ deliveryMode?: string; devOtp?: string }>('/api/v2/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({
          key: inputValue,
          purpose: 'password-reset',
          channel: method,
        }),
      });
      setResendCooldown(60);
      setCountdown(300);
      setDevOtp(data.devOtp || '');
      setStatusMessage(data.deliveryMode === 'mock'
        ? 'A new development OTP is available below.'
        : 'A fresh recovery OTP has been sent.');
      toast.success('A new 6-digit verification code has been dispatched.');
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to resend OTP.');
      toast.error(err.message || 'Unable to resend OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMaskedValue = () => {
    if (method === 'email') {
      const parts = inputValue.split('@');
      if (parts.length < 2) return inputValue;
      return `${parts[0].slice(0, 2)}••••@${parts[1]}`;
    } else {
      return `${inputValue.slice(0, 4)} ••• ••• ${inputValue.slice(-3)}`;
    }
  };

  // Password requirements checklist
  const requirements = [
    { label: 'Minimum 8 characters', met: password.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least one number', met: /[0-9]/.test(password) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const passwordStrength = requirements.filter(r => r.met).length;

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Immersive background graphics */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-color-dodge scale-105 pointer-events-none"
          style={{ backgroundImage: "url('/bull-bear.png')" }}
        />
        <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] rounded-full bg-purple-500/10 filter blur-[110px] animate-neural" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 filter blur-[100px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {step !== 'success' && (
          <button
            onClick={() => {
              if (step === 'input') setStep('method');
              else if (step === 'otp') setStep('input');
              else if (step === 'reset') setStep('otp');
              else router.push('/login');
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            {step === 'method' ? 'Back to Sign In' : 'Back to previous step'}
          </button>
        )}

        <div className="glass-card rounded-3xl p-8 border border-white/8 bg-slate-950/40 backdrop-blur-2xl">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Method */}
            {step === 'method' && (
              <motion.div
                key="step-method"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="text-purple-400" size={20} />
                  </div>
                  <h2 className="text-xl font-display font-bold text-white">Reset Password</h2>
                  <p className="text-xs text-slate-400 mt-2">Select how you want to receive your recovery credentials.</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div
                    onClick={() => handleSelectMethod('email')}
                    className="p-4 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 hover:border-purple-500/30 cursor-pointer transition-all flex items-start gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                      <Mail size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">Recover via Email</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Receive a secure one-time passcode to your registered email inbox. Estimated delivery: &lt; 30s.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => handleSelectMethod('phone')}
                    className="p-4 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 hover:border-purple-500/30 cursor-pointer transition-all flex items-start gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">Recover via SMS</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Dispatch a 6-digit mobile verification token directly to your phone number. Estimated delivery: &lt; 15s.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Input Details */}
            {step === 'input' && (
              <motion.div
                key="step-input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Identity Verification</h2>
                  <p className="text-xs text-slate-400 mt-2">
                    Enter the registered details associated with your TradeMind account.
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                      {method === 'email' ? 'Email Address' : 'Phone Number'}
                    </label>
                    <div className="relative">
                      {method === 'email' ? (
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      ) : (
                        <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      )}
                      <input
                        type={method === 'email' ? 'email' : 'tel'}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder={method === 'email' ? 'your@email.com' : '+254 700 000 000'}
                        className="w-full input-glass rounded-xl pl-9 pr-4 py-3"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>Generate OTP <ChevronRight size={14} /></>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 3: Enter OTP */}
            {step === 'otp' && (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Verification Code</h2>
                  <p className="text-xs text-slate-400 mt-2">
                    Enter the 6-digit verification code sent to <strong className="text-white">{getMaskedValue()}</strong>.
                  </p>
                </div>
                {statusMessage && (
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-[11px] text-purple-200">
                    {statusMessage}
                    {devOtp && <div className="mt-2 font-mono text-sm font-bold text-white">Dev OTP: {devOtp}</div>}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Passcode</label>
                      <span className="text-[10px] font-semibold text-purple-400">
                        Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
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
                    {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : 'Confirm Passcode'}
                  </button>
                </form>

                <div className="text-center text-[11px] border-t border-white/5 pt-4">
                  <span className="text-slate-500">Didn't receive the token? </span>
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className={`font-bold hover:underline ${resendCooldown > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-purple-400'}`}
                  >
                    Resend Code {resendCooldown > 0 && `(${resendCooldown}s)`}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Create Password */}
            {step === 'reset' && (
              <motion.div
                key="step-reset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Create New Password</h2>
                  <p className="text-xs text-slate-400 mt-2">
                    Define a new password with at least 8 characters.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">New Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full input-glass rounded-xl px-3.5 py-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full input-glass rounded-xl px-3.5 py-3"
                      required
                    />
                  </div>

                  {/* Password strength meter */}
                  <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-slate-900/40">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Password Strength</span>
                      <span className={
                        passwordStrength <= 1 ? 'text-red-400 font-bold' :
                        passwordStrength <= 3 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'
                      }>
                        {passwordStrength <= 1 ? 'Weak' : passwordStrength <= 3 ? 'Medium' : 'Strong'}
                      </span>
                    </div>
                    <div className="progress-track h-1.5 flex gap-1.5">
                      {[1, 2, 3, 4].map(idx => (
                        <div
                          key={idx}
                          className={`flex-1 h-full rounded-full transition-all ${
                            idx <= passwordStrength
                              ? passwordStrength <= 1 ? 'bg-red-500' :
                                passwordStrength <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
                              : 'bg-white/5'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      {requirements.map((req, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                          <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            req.met ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-600'
                          }`}>
                            {req.met ? <Check size={8} /> : '•'}
                          </span>
                          <span className={req.met ? 'text-slate-300' : 'text-slate-600'}>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : 'Apply New Password'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 5: Success Screen */}
            {step === 'success' && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-2 animate-glow-pulse">
                  <CheckCircle2 className="text-emerald-400" size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Password Updated</h2>
                  <p className="text-xs text-slate-400 mt-2">
                    Your TradeMind password has been changed successfully.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/5 text-[10px] text-amber-300 leading-normal flex items-start gap-2.5 text-left">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Audit Triggered:</strong> We have invalidated all active sessions, revoked previous login devices, and reset API tokens to ensure your account remains fully protected.
                  </span>
                </div>

                <Link
                  href="/login"
                  className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs text-white"
                >
                  Return to Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
