'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings2, User, Key, Bell, Shield,
  Eye, EyeOff, Save, Plus, Trash2, HelpCircle
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useUIStore } from '@/store/useUIStore';
import { toast } from 'react-hot-toast';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
}

export default function SettingsPage() {
  const { theme, toggleSidebar } = useUIStore();
  const [firstName, setFirstName] = useState('Alex');
  const [lastName, setLastName] = useState('Trader');
  const [email, setEmail] = useState('alex@trademind.ai');
  const [twoFactor, setTwoFactor] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: 'key1', name: 'Alpaca Live Link', key: 'alp_live_••••••••••••••••3a9b', created: '2026-06-28' },
    { id: 'key2', name: 'Binance Spot Key', key: 'bin_spot_••••••••••••••••e82d', created: '2026-06-25' },
  ]);
  const [newKeyName, setNewKeyName] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Profile settings updated!');
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    const newKey: ApiKey = {
      id: Math.random().toString(),
      name: newKeyName,
      key: `tm_api_${Math.random().toString(36).substring(2, 10)}••••••••••••••••`,
      created: new Date().toISOString().split('T')[0]
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    toast.success('New TradeMind API Key generated!');
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
    toast.success('API key revoked.');
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile settings, security variables, and API connection keys."
        icon={Settings2}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
              <User size={16} className="text-purple-400" />
              Profile Details
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full input-glass rounded-xl px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full input-glass rounded-xl px-3 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full input-glass rounded-xl px-3 py-2.5"
                />
              </div>

              <button
                type="submit"
                className="btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5"
              >
                <Save size={14} /> Save Profile
              </button>
            </form>
          </div>

          {/* API Keys */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
              <Key size={16} className="text-purple-400" />
              External Integration Keys
            </h3>
            <div className="space-y-3 mb-5">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/2">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{k.name}</div>
                    <div className="font-mono text-[10px] text-slate-500 mt-1">{k.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600">Created: {k.created}</span>
                    <button
                      onClick={() => handleDeleteKey(k.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateKey} className="flex gap-3 text-xs">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key label (e.g., Python Bot Client)"
                className="input-glass flex-1 rounded-xl px-3"
              />
              <button
                type="submit"
                className="btn-ghost px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-purple-500 hover:text-white hover:border-purple-600 transition-all"
              >
                <Plus size={14} /> Add Key
              </button>
            </form>
          </div>
        </div>

        {/* Security & Notifications */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2">
              <Shield size={16} className="text-purple-400" />
              Security Settings
            </h3>

            <div className="flex items-center justify-between py-2 text-xs">
              <div>
                <div className="font-semibold text-slate-200">Two-Factor Auth (2FA)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Secure operations using Google Authenticator</div>
              </div>
              <input
                type="checkbox"
                checked={twoFactor}
                onChange={e => setTwoFactor(e.target.checked)}
                className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 text-xs border-t border-white/5 pt-3">
              <div>
                <div className="font-semibold text-slate-200">Biometric Verification</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Authorize trades with FaceID / fingerprint</div>
              </div>
              <input
                type="checkbox"
                checked={biometric}
                onChange={e => setBiometric(e.target.checked)}
                className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2">
              <Bell size={16} className="text-purple-400" />
              Notifications
            </h3>

            <div className="flex items-center justify-between py-2 text-xs">
              <div>
                <div className="font-semibold text-slate-200">Email System Alerts</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Receive reports on executed automation trades</div>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={e => setEmailAlerts(e.target.checked)}
                className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
