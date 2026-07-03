'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Key, Bell, Shield, Save, Plus, Trash2, HelpCircle,
  Mail, Phone, MapPin, TrendingUp, Award, BrainCircuit,
  Wallet, RefreshCw, LogOut, CheckCircle2, AlertCircle,
  FileText, Share2, UploadCloud, Edit3, Settings2, Download,
  Printer, Check, X, ShieldAlert, Cpu, Layers, DollarSign,
  History, GraduationCap, BarChart2
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';

type TabType = 'overview' | 'kyc' | 'security' | 'ai' | 'billing' | 'activity';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditMode, setIsEditMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Profile Fields ---
  const [profileData, setProfileData] = useState({
    firstName: 'Alex',
    middleName: 'G.',
    lastName: 'Trader',
    username: 'alextrader_ai',
    dob: '1992-04-18',
    gender: 'Male',
    nationality: 'American',
    nationalId: '••••-••••-9821',
    occupation: 'Commodity Swing Strategist',
    email: 'alex@trademind.ai',
    phone: '+254 700 123 456',
    secondaryEmail: 'backup_alex@gmail.com',
    communicationPref: 'WhatsApp',
    country: 'Kenya',
    state: 'Nairobi',
    county: 'Nairobi County',
    city: 'Nairobi',
    postalCode: '00100',
    address: 'Vantage Heights, Suite 12B, Westlands',
    timezone: 'EAT (UTC+3)',
    experience: 'Intermediate (4 Years)',
    primaryMarket: 'Forex & Commodities',
    preferredAssets: 'EUR/USD, XAU/USD, Brent Crude',
    tradingStyle: 'Swing Trading',
    riskAppetite: 'Balanced',
    tradingSession: 'London / New York Overlap',
    baseCurrency: 'USD',
    leverage: '1:50',
    avatarUrl: '', // Default state is empty for styled avatar representation
  });

  // Edited local state (copied when entering edit mode)
  const [editedData, setEditedData] = useState({ ...profileData });

  // --- Security States ---
  const [twoFactor, setTwoFactor] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [passkeyActive, setPasskeyActive] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: 'key1', name: 'Alpaca Live Link', key: 'alp_live_••••••••••••••••3a9b', created: '2026-06-28' },
    { id: 'key2', name: 'Binance Spot Key', key: 'bin_spot_••••••••••••••••e82d', created: '2026-06-25' },
  ]);
  const [newKeyName, setNewKeyName] = useState('');

  // --- Notification Channels ---
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    whatsapp: true,
    push: true,
    marketAlerts: true,
    signalAlerts: true,
    newsAlerts: false,
    priceAlerts: true
  });

  // --- AI Preferences ---
  const [aiPreferences, setAiPreferences] = useState({
    assistantActive: true,
    strategy: 'Trend Follower + Sentiment Analysis',
    automationMode: 'Semi-Autonomous (Requires Confirmation)',
    riskLimit: 'Max 2% Per Trade',
    interests: 'Macroeconomic Indexes, Liquid Forex Pairs',
    frequency: 'Hourly Highlights'
  });

  // --- KYC Documents ---
  const [kycDocs, setKycDocs] = useState({
    idVerified: 'verified', // verified, pending, rejected
    selfieVerified: 'verified',
    addressVerified: 'pending',
    taxInfo: 'verified'
  });

  const handleEditToggle = () => {
    if (!isEditMode) {
      setEditedData({ ...profileData });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveChanges = () => {
    setProfileData({ ...editedData });
    setIsEditMode(false);
    toast.success('Changes applied to profile successfully!');
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      className="space-y-6 print:bg-white print:text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      ref={printRef}
    >
      <div className="print:hidden">
        <PageHeader
          title="Account Hub"
          subtitle="View and manage your identity data, trading parameters, connected integrations, security variables, and KYC."
          icon={Settings2}
        />
      </div>

      {/* --- Profile Header Card (Print CSS support included) --- */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 bg-slate-950/40 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full filter blur-[80px]" />
        
        <div className="flex flex-col sm:flex-row gap-6 items-center relative z-10">
          {/* Avatar Area */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 border-2 border-purple-400/30 flex items-center justify-center text-4xl font-black text-white shadow-2xl relative">
              {profileData.firstName[0]}{profileData.lastName[0]}
            </div>
            <button className="absolute -bottom-2 -right-2 bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-xl border border-white/10 shadow-lg cursor-pointer transition-all print:hidden">
              <UploadCloud size={14} />
            </button>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-2xl font-display font-black text-white">{profileData.firstName} {profileData.lastName}</h2>
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">Pro Member</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={10} /> Verified
              </Badge>
            </div>
            <p className="text-xs text-slate-400 font-mono">ID: TM-2026-000124 • Joined Jun 2026</p>
            <p className="text-xs text-slate-500">Last login: Today, 09:21 AM ({profileData.timezone})</p>
          </div>
        </div>

        {/* Profile Completion Bar */}
        <div className="w-full md:w-auto min-w-[240px] space-y-2 relative z-10">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
            <span>Profile Completion</span>
            <span className="text-purple-400 font-black">92%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" style={{ width: '92%' }} />
          </div>
          <p className="text-[10px] text-slate-500 text-right">Complete selfie KYC to reach 100%</p>
        </div>
      </div>

      {/* --- Tab Navigation --- */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-px print:hidden scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'kyc', label: 'Verification (KYC)', icon: Shield },
          { id: 'security', label: 'Security & Keys', icon: Key },
          { id: 'ai', label: 'AI & Notifications', icon: BrainCircuit },
          { id: 'billing', label: 'Wallet & Billing', icon: Wallet },
          { id: 'activity', label: 'Activity Logs', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-display font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'border-purple-500 text-white bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/2'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- Main Section Cards --- */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Tabs Contents */}
        <div className="xl:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="tab-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Personal Information */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <User size={16} className="text-purple-400" />
                      Personal Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">First Name</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.firstName}
                          onChange={e => setEditedData({ ...editedData, firstName: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.firstName}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Middle Name</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.middleName}
                          onChange={e => setEditedData({ ...editedData, middleName: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.middleName}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Last Name</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.lastName}
                          onChange={e => setEditedData({ ...editedData, lastName: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.lastName}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Username</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.username}
                          onChange={e => setEditedData({ ...editedData, username: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">@{profileData.username}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Date of Birth</span>
                      {isEditMode ? (
                        <input
                          type="date"
                          value={editedData.dob}
                          onChange={e => setEditedData({ ...editedData, dob: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.dob}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Gender</span>
                      {isEditMode ? (
                        <select
                          value={editedData.gender}
                          onChange={e => setEditedData({ ...editedData, gender: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 bg-slate-900"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.gender}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nationality</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.nationality}
                          onChange={e => setEditedData({ ...editedData, nationality: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.nationality}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">National ID/Passport</span>
                      <span className="text-slate-300 font-mono font-bold">{profileData.nationalId}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Occupation</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.occupation}
                          onChange={e => setEditedData({ ...editedData, occupation: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.occupation}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Mail size={16} className="text-purple-400" />
                      Contact Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Email Address</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-semibold">{profileData.email}</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">Verified</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Phone Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-semibold">{profileData.phone}</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">Verified</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Secondary Email</span>
                      {isEditMode ? (
                        <input
                          type="email"
                          value={editedData.secondaryEmail}
                          onChange={e => setEditedData({ ...editedData, secondaryEmail: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.secondaryEmail}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Preferred Contact Channel</span>
                      {isEditMode ? (
                        <select
                          value={editedData.communicationPref}
                          onChange={e => setEditedData({ ...editedData, communicationPref: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 bg-slate-900"
                        >
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Email">Email</option>
                          <option value="SMS">SMS</option>
                        </select>
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.communicationPref}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Residential Details */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <MapPin size={16} className="text-purple-400" />
                      Residential Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Country</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.country}
                          onChange={e => setEditedData({ ...editedData, country: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.country}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">State / Province</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.state}
                          onChange={e => setEditedData({ ...editedData, state: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.state}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">County</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.county}
                          onChange={e => setEditedData({ ...editedData, county: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.county}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">City</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.city}
                          onChange={e => setEditedData({ ...editedData, city: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.city}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Postal Code</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.postalCode}
                          onChange={e => setEditedData({ ...editedData, postalCode: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.postalCode}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Residential Address</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.address}
                          onChange={e => setEditedData({ ...editedData, address: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.address}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Timezone</span>
                      <span className="text-slate-200 font-semibold">{profileData.timezone}</span>
                    </div>
                  </div>
                </div>

                {/* Trading Profile */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <h3 className="font-display font-bold text-white text-sm flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                    <TrendingUp size={16} className="text-purple-400" />
                    Trading Preferences
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Trading Experience</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.experience}
                          onChange={e => setEditedData({ ...editedData, experience: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.experience}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Primary Market</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.primaryMarket}
                          onChange={e => setEditedData({ ...editedData, primaryMarket: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.primaryMarket}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Preferred Assets</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.preferredAssets}
                          onChange={e => setEditedData({ ...editedData, preferredAssets: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.preferredAssets}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Trading Style</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.tradingStyle}
                          onChange={e => setEditedData({ ...editedData, tradingStyle: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.tradingStyle}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Risk Appetite</span>
                      {isEditMode ? (
                        <select
                          value={editedData.riskAppetite}
                          onChange={e => setEditedData({ ...editedData, riskAppetite: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 bg-slate-900"
                        >
                          <option value="Conservative">Conservative</option>
                          <option value="Balanced">Balanced</option>
                          <option value="Aggressive">Aggressive</option>
                        </select>
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.riskAppetite}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Default Leverage</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.leverage}
                          onChange={e => setEditedData({ ...editedData, leverage: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{profileData.leverage}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 p-3.5 rounded-xl border border-purple-500/10 bg-purple-500/5 flex items-start gap-2.5 text-xs text-purple-300">
                    <BrainCircuit size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold">AI Summary Profile Feed:</span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Based on your account history and parameters, your profile indicates a moderate-risk swing trader focused on Forex and Commodities.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: KYC Verification */}
            {activeTab === 'kyc' && (
              <motion.div
                key="tab-kyc"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card rounded-2xl p-6 border border-white/5 space-y-6"
              >
                <div className="border-b border-white/5 pb-3">
                  <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                    <Shield size={16} className="text-purple-400" />
                    Account Verification (KYC)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Submit regulatory documents to unlock unlimited wallet withdrawals.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Identity Verification', status: kycDocs.idVerified, desc: 'Government-issued Passport or National ID.' },
                    { label: 'Selfie Liveness Verification', status: kycDocs.selfieVerified, desc: '3D biometric facial scanning check.' },
                    { label: 'Address Verification', status: kycDocs.addressVerified, desc: 'Bank statement or utility bill (< 3 months old).' },
                    { label: 'Tax Information Compliance', status: kycDocs.taxInfo, desc: 'Declaration of international W-8BEN / KRA PIN code.' },
                  ].map(doc => (
                    <div key={doc.label} className="p-4 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-200 text-xs">{doc.label}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{doc.desc}</p>
                      </div>
                      <Badge className={
                        doc.status === 'verified' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                        doc.status === 'pending' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' :
                        'bg-red-500/15 border border-red-500/30 text-red-400'
                      }>
                        {doc.status === 'verified' ? '✅ Verified' : doc.status === 'pending' ? '🟡 Pending' : '🔴 Rejected'}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
                  <button className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                    <UploadCloud size={14} /> Upload New Document
                  </button>
                  <button className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                    <FileText size={14} /> View Uploaded Files
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tab: Security & Keys */}
            {activeTab === 'security' && (
              <motion.div
                key="tab-security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Security Settings */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Key size={16} className="text-purple-400" />
                      Security Center
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">Two-Factor Authentication (2FA)</div>
                        <div className="text-[10px] text-slate-500 mt-1">Verify transactions with authenticator apps.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={twoFactor}
                        onChange={e => setTwoFactor(e.target.checked)}
                        className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">Biometric Login</div>
                        <div className="text-[10px] text-slate-500 mt-1">Authorize settings with facial scans / TouchID.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={biometric}
                        onChange={e => setBiometric(e.target.checked)}
                        className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">WebAuthn Passkey Status</div>
                        <div className="text-[10px] text-slate-500 mt-1">Passwordless authentication using secure hardware.</div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 border border-purple-500/30 text-purple-400">ACTIVE</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">Last Password Change</div>
                        <div className="text-[10px] text-slate-500 mt-1">Last edited 18 days ago (Jun 14, 2026).</div>
                      </div>
                      <button className="text-[10px] font-bold text-purple-400 hover:underline">Change</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/5">
                    <button className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      Change Password
                    </button>
                    <button className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/5 cursor-pointer">
                      <LogOut size={14} /> Sign Out All Other Devices
                    </button>
                  </div>
                </div>

                {/* API Keys */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Plus size={16} className="text-purple-400" />
                    External API Connection Keys
                  </h3>

                  <div className="space-y-3 mb-5 text-xs">
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
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer"
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
              </motion.div>
            )}

            {/* Tab: AI Preferences & Notifications */}
            {activeTab === 'ai' && (
              <motion.div
                key="tab-ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* AI Preferences */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <BrainCircuit size={16} className="text-purple-400" />
                      AI Intelligence Parameters
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Preferred AI Strategy</span>
                      <span className="text-slate-200 font-semibold">{aiPreferences.strategy}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Automation Mode</span>
                      <span className="text-slate-200 font-semibold">{aiPreferences.automationMode}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Risk Limit Guard</span>
                      <span className="text-slate-200 font-semibold">{aiPreferences.riskLimit}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Recommendation Frequency</span>
                      <span className="text-slate-200 font-semibold">{aiPreferences.frequency}</span>
                    </div>
                  </div>

                  <button className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                    <Cpu size={14} /> Customize AI Strategy
                  </button>
                </div>

                {/* Notifications */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Bell size={16} className="text-purple-400" />
                    Notification Channels
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {[
                      { key: 'email', label: 'Email Notifications', desc: 'Receive daily report digests.' },
                      { key: 'sms', label: 'SMS Notifications', desc: 'Alerts for margin thresholds.' },
                      { key: 'whatsapp', label: 'WhatsApp Alerts', desc: 'Instant AI signal dispatches.' },
                      { key: 'push', label: 'Push Notifications', desc: 'Real-time dashboard popups.' },
                      { key: 'marketAlerts', label: 'Market Volatility Reports', desc: 'Alerts on high volatility nodes.' },
                      { key: 'signalAlerts', label: 'AI Signal Execution Matches', desc: 'Instant confirmations on triggers.' },
                    ].map(ch => (
                      <div key={ch.key} className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-200">{ch.label}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{ch.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={(notifications as any)[ch.key]}
                          onChange={e => setNotifications({ ...notifications, [ch.key]: e.target.checked })}
                          className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: Wallet & Billing */}
            {activeTab === 'billing' && (
              <motion.div
                key="tab-billing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Wallet Balance Summary */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Wallet size={16} className="text-purple-400" />
                      Wallet Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Available Balance</span>
                      <span className="text-2xl font-black text-white">$12,480.50</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-white/2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Default Payment Method</span>
                      <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        💳 Visa Ending in 4242
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      Manage Wallet
                    </button>
                    <button className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      View Transactions
                    </button>
                  </div>
                </div>

                {/* Subscription Details */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Layers size={16} className="text-purple-400" />
                    Subscription Plan
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">Billing Cycle</span>
                      <span className="text-slate-200 font-bold">Annual ($480/yr)</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">Renewal Date</span>
                      <span className="text-slate-200 font-bold">Jun 28, 2027</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">API Limits</span>
                      <span className="text-slate-200 font-bold">5,000 / Day (92% free)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      Upgrade Plan
                    </button>
                    <button className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      Billing History
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: Activity & Achievements */}
            {activeTab === 'activity' && (
              <motion.div
                key="tab-activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Learning Progress */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <GraduationCap size={16} className="text-purple-400" />
                      Academy & Achievements
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20">
                      <div className="font-bold text-purple-400 text-lg">4 / 6</div>
                      <div className="text-[10px] text-slate-500 mt-1">Courses Completed</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20">
                      <div className="font-bold text-purple-400 text-lg">2</div>
                      <div className="text-[10px] text-slate-500 mt-1">Trading Certificates</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/20">
                      <div className="font-bold text-purple-400 text-lg">Level 42</div>
                      <div className="text-[10px] text-slate-500 mt-1">Trading Rank Score</div>
                    </div>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                    <History size={16} className="text-purple-400" />
                    Recent Account Activity
                  </h3>

                  <div className="relative border-l border-white/5 pl-4 ml-2 space-y-4 text-xs">
                    {[
                      { act: 'Password changed successfully', time: '18 days ago', dev: 'Chrome (Nairobi, KE)' },
                      { act: 'KYC Document submitted: Bank statement', time: 'Jun 22, 2026', dev: 'iPhone 15 Pro' },
                      { act: 'Connected API integrations: Alpaca Live Link', time: 'Jun 28, 2026', dev: 'MacOS Native' },
                      { act: 'Deposited funds: $5,000 USD via Visa', time: 'Jul 01, 2026', dev: 'Safari (Nairobi, KE)' },
                    ].map((log, index) => (
                      <div key={index} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-slate-950" />
                        <div className="font-semibold text-slate-200">{log.act}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{log.time} • Device: {log.dev}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Account Actions, Stats, Broker */}
        <div className="xl:col-span-4 space-y-6">
          {/* Actions Bar */}
          <div className="glass-card rounded-2xl p-5 space-y-3.5 print:hidden">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider text-slate-500">Actions</h4>
            <div className="space-y-2.5">
              <button
                onClick={handleEditToggle}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 hover:border-purple-500/30 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <Edit3 size={14} className="text-purple-400" />
                {isEditMode ? 'Exit Edit Mode' : 'Edit Profile'}
              </button>
              
              <button
                onClick={handlePrint}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <Printer size={14} className="text-purple-400" />
                Print / Download Profile
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <Shield size={14} className="text-purple-400" />
                Security Settings
              </button>
            </div>
          </div>

          {/* Statistics Panel */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <BarChart2 size={14} className="text-purple-400" />
              Trading Statistics
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Total Trades', val: '1,424' },
                { label: 'Win Rate', val: '68.2%' },
                { label: 'Signals Followed', val: '890' },
                { label: 'AI Accuracy', val: '86%' },
              ].map(stat => (
                <div key={stat.label} className="p-3 rounded-xl border border-white/5 bg-slate-900/30">
                  <div className="font-semibold text-slate-200 text-sm">{stat.val}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-xs text-emerald-400 flex justify-between items-center">
              <span>Total Profit Growth:</span>
              <span className="font-black">+$42,150.20</span>
            </div>
          </div>

          {/* Broker Connections */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider text-slate-500">Connected Broker</h4>
            <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-slate-200">Alpaca Securities LLC</div>
                <div className="text-[10px] text-slate-500 mt-1">Acct: ••••••9821</div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">CONNECTED</Badge>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer">
                <RefreshCw size={12} /> Sync
              </button>
              <button className="btn-ghost flex-1 text-xs py-2 rounded-xl font-bold text-red-400 hover:text-red-300 border-red-500/20 cursor-pointer">
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Floating Bottom Edit Action Bar (shows only when editMode active) --- */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel border border-purple-500/30 bg-slate-950/90 rounded-2xl px-6 py-4 flex gap-4 shadow-2xl items-center print:hidden"
          >
            <span className="text-xs text-purple-300 font-bold flex items-center gap-2">
              <AlertCircle size={14} /> Unsaved changes in progress
            </span>
            <button
              onClick={handleSaveChanges}
              className="btn-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check size={14} /> Save Changes
            </button>
            <button
              onClick={handleEditToggle}
              className="btn-ghost text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
            >
              <X size={14} /> Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
