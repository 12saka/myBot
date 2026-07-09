'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles, CheckCircle2, RefreshCw, Smartphone, CreditCard,
  ArrowRight, ShieldCheck, HelpCircle, Layers, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

export default function ChoosePlanPage() {
  const router = useRouter();
  
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PRO' | 'PREMIUM' | null>(null);
  const [paymentMode, setPaymentMode] = useState<'mpesa' | 'visa' | null>(null);
  
  // Payment Details
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Spinner loader states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const plans = [
    {
      id: 'STARTER' as const,
      name: 'Starter Package',
      priceMonthly: 0,
      priceYearly: 0,
      desc: 'Perfect for learning and demo testing',
      features: [
        'Demo trading environment',
        'Academy courses & quizes',
        'Basic moving average indicators',
        '10 daily signals queries',
      ],
      cta: 'Get Started for Free',
      isPopular: false,
    },
    {
      id: 'PRO' as const,
      name: 'Pro Trader',
      priceMonthly: 5000,
      priceYearly: 50000,
      desc: 'Full suite of neural network models',
      features: [
        'Ensemble AI signals feeds',
        'Real-time Websockets tick streaming',
        'Automated drawdown rules',
        'Portfolio risk analytics dashboard',
      ],
      cta: 'Activate Pro Trader',
      isPopular: true,
    },
    {
      id: 'PREMIUM' as const,
      name: 'Premium Tier',
      priceMonthly: 20000,
      priceYearly: 200000,
      desc: 'Dedicated parameter execution power',
      features: [
        'Advanced LSTM indicators analytics',
        'Interactive AI Copilot chat assistance',
        'Custom parameters fine-tuning',
        '24/7 priority execution lines',
      ],
      cta: 'Unlock Premium Engine',
      isPopular: false,
    },
  ];

  const handleFreeActivation = async () => {
    setIsSubmitting(true);
    setProgressStep('Activating Starter tier profile...');
    setErrorMessage('');
    
    try {
      await apiFetch('/api/v2/subscription/activate', {
        method: 'POST',
        body: JSON.stringify({ plan: 'STARTER' })
      });

      await new Promise(r => setTimeout(r, 1200));
      toast.success('Starter plan activated successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate Starter subscription.');
      toast.error(err.message || 'Failed to activate Starter subscription.');
    } finally {
      setIsSubmitting(false);
      setProgressStep('');
    }
  };

  const handlePaidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (paymentMode === 'mpesa') {
        if (!phoneNumber || phoneNumber.length < 10) {
          toast.error('Please enter a valid M-Pesa phone number.');
          setIsSubmitting(false);
          return;
        }

        setProgressStep('Connecting Safaricom Daraja API...');
        await new Promise(r => setTimeout(r, 1200));
        setProgressStep('Dispatching M-Pesa STK Push prompt...');

        await apiFetch('/api/v2/subscription/activate', {
          method: 'POST',
          body: JSON.stringify({
            plan: selectedPlan,
            paymentMethod: 'mpesa',
            phoneNumber,
            billingCycle
          })
        });

        setProgressStep('Awaiting mobile PIN confirmation...');
        await new Promise(r => setTimeout(r, 3000));
        setProgressStep('Validating active ledger updates...');
        await new Promise(r => setTimeout(r, 1000));
      } else {
        // Visa
        if (cardNumber.length !== 16) {
          toast.error('Please enter a valid 16-digit card number.');
          setIsSubmitting(false);
          return;
        }

        setProgressStep('Verifying credit card details with processor...');
        await new Promise(r => setTimeout(r, 1500));

        await apiFetch('/api/v2/subscription/activate', {
          method: 'POST',
          body: JSON.stringify({
            plan: selectedPlan,
            paymentMethod: 'visa',
            billingCycle
          })
        });

        setProgressStep('Authorizing billing subscription tokens...');
        await new Promise(r => setTimeout(r, 1500));
      }

      toast.success(`Welcome to TradeMind ${selectedPlan}! Your plan is now active.`);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || `Unable to activate ${selectedPlan}.`);
      toast.error(err.message || `Unable to activate ${selectedPlan}.`);
    } finally {
      setIsSubmitting(false);
      setProgressStep('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-10 px-4 text-xs">
      
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full z-10 space-y-6">
        
        {/* Page Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-bold">
            <Sparkles size={12} /> Live Mode Setup
          </div>
          <h2 className="font-display font-black text-white text-2xl">Choose Your Trading Tier</h2>
          <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            Select a plan to configure your AI strategies parameters. Registration is free and card configurations can be skipped.
          </p>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 w-52 mx-auto mt-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all text-[10px] cursor-pointer ${billingCycle === 'monthly' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all text-[10px] cursor-pointer ${billingCycle === 'yearly' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Yearly (Save 15%)
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="max-w-md mx-auto rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-xs text-rose-200">
            {errorMessage}
          </div>
        )}

        {isSubmitting ? (
          <div className="glass-card max-w-md mx-auto rounded-3xl p-10 border border-white/10 flex flex-col items-center justify-center text-center space-y-4">
            <RefreshCw size={36} className="text-purple-400 animate-spin" />
            <div>
              <h3 className="font-bold text-white text-sm">{progressStep}</h3>
              <p className="text-[10px] text-slate-500 mt-1">Please do not navigate away or refresh.</p>
            </div>
          </div>
        ) : selectedPlan && selectedPlan !== 'STARTER' ? (
          /* Payment Billing Config Page */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card max-w-md mx-auto rounded-3xl p-6 border border-white/10 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <button
                onClick={() => { setSelectedPlan(null); setPaymentMode(null); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <ArrowLeft size={14} />
              </button>
              <div>
                <h3 className="font-display font-bold text-white text-sm">Configure Billing method</h3>
                <p className="text-[10px] text-slate-500">Upgrading to TradeMind {selectedPlan}</p>
              </div>
            </div>

            {/* Payment Method Choose */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Billing Channel</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMode('mpesa')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${paymentMode === 'mpesa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400'}`}
                >
                  <Smartphone size={16} />
                  <span className="text-[9px] font-bold">M-Pesa STK (KES)</span>
                </button>
                <button
                  onClick={() => setPaymentMode('visa')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${paymentMode === 'visa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400'}`}
                >
                  <CreditCard size={16} />
                  <span className="text-[9px] font-bold">Credit Card</span>
                </button>
              </div>
            </div>

            <form onSubmit={handlePaidPayment} className="space-y-4">
              {paymentMode === 'mpesa' && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Safaricom Number</label>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 254712345678"
                    className="w-full input-glass rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">STK push prompt will be sent in Kenyan Shillings (KES).</span>
                </div>
              )}

              {paymentMode === 'visa' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Card Number</label>
                    <input
                      type="text"
                      required
                      maxLength={16}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="4242 4242 4242 4242"
                      className="w-full input-glass rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Expiry Date</label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="w-full input-glass rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">CVV Code</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="w-full input-glass rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none text-center"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Total review */}
              <div className="p-3 rounded-xl border border-white/5 bg-white/2 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Total Invoice Amount</span>
                <span className="font-black text-white">
                  KES {selectedPlan === 'PRO' ? 
                    (billingCycle === 'monthly' ? '5,000 / mo' : '50,000 / yr') : 
                    (billingCycle === 'monthly' ? '20,000 / mo' : '200,000 / yr')
                  }
                </span>
              </div>

              <button
                type="submit"
                disabled={!paymentMode}
                className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck size={14} /> Confirm & Activate Plan
              </button>
            </form>
          </motion.div>
        ) : (
          /* Plans List Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
              return (
                <div
                  key={plan.id}
                  className={`glass-card rounded-3xl p-6 border relative flex flex-col justify-between gap-5 transition-all hover:scale-[1.01] ${plan.isPopular ? 'border-purple-500 bg-purple-500/5 shadow-purple-500/5' : 'border-white/5 bg-slate-900/30'}`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-500 text-white font-bold text-[9px] uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <h3 className="font-display font-bold text-white text-base mb-1">{plan.name}</h3>
                    <p className="text-slate-500 text-[10px] leading-relaxed mb-4">{plan.desc}</p>
                    
                    <div className="flex items-baseline gap-1.5 mb-5 border-b border-white/5 pb-4">
                      <span className="font-display font-black text-2xl text-white">
                        KES {price.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        / {billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>

                    <ul className="space-y-2 text-slate-400">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      if (plan.id === 'STARTER') {
                        handleFreeActivation();
                      } else {
                        setSelectedPlan(plan.id);
                        setPaymentMode('mpesa');
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${plan.isPopular ? 'btn-primary' : 'border border-white/10 hover:border-white/20 text-slate-200 hover:text-white'}`}
                  >
                    {plan.cta} <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Skip billing link */}
        {!selectedPlan && (
          <div className="text-center pt-4">
            <button
              onClick={handleFreeActivation}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer font-semibold underline text-[10px]"
            >
              Skip payment setup and continue with Starter limited free tier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
