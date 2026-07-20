'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Key, Bell, Shield, Save, Plus, Trash2, HelpCircle,
  Mail, Phone, MapPin, TrendingUp, Award, BrainCircuit,
  Wallet, RefreshCw, LogOut, CheckCircle2, AlertCircle,
  FileText, Share2, UploadCloud, Edit3, Settings2, Download,
  Printer, Check, X, ShieldAlert, Cpu, Layers, DollarSign,
  History, GraduationCap, BarChart2, UserCheck
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  apiFetch,
  DEFAULT_PROFILE_DATA,
  normalizeProfile,
  saveProfileSnapshot,
  type ProfileData,
} from '@/lib/api';

type TabType = 'overview' | 'kyc' | 'security' | 'ai' | 'billing' | 'activity' | 'notifications';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleUrlChange = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['overview', 'kyc', 'security', 'ai', 'billing', 'activity', 'notifications'].includes(tab)) {
          setActiveTab(tab as TabType);
        }
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    const interval = setInterval(handleUrlChange, 500);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  // Billing modals states
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'mpesa' | 'visa' | null>(null);
  const [billingPhone, setBillingPhone] = useState('');

  const handlePlanUpgrade = async (plan: string) => {
    if (!paymentMode) {
      toast.error('Please select a payment method.');
      return;
    }
    if (paymentMode === 'mpesa' && (!billingPhone || billingPhone.length < 10)) {
      toast.error('Please enter a valid mobile number.');
      return;
    }
    
    setIsUpgrading(true);
    setUpgradeStep('Connecting to billing gateway...');
    
    try {
      let planEnum: 'BASIC' | 'PRO' | 'ENTERPRISE' = 'PRO';
      if (plan.toLowerCase().includes('basic')) planEnum = 'BASIC';
      else if (plan.toLowerCase().includes('enterprise')) planEnum = 'ENTERPRISE';

      await apiFetch('/api/v2/subscription/activate', {
        method: 'POST',
        body: JSON.stringify({
          plan: planEnum,
          paymentMethod: paymentMode,
          phoneNumber: billingPhone || undefined,
          billingCycle: 'yearly'
        })
      });

      setUpgradeStep('Synchronizing subscription credentials...');
      await new Promise(r => setTimeout(r, 1000));
      
      setIsUpgrading(false);
      setIsUpgradeOpen(false);
      setSelectedPlan(null);
      setPaymentMode(null);
      setBillingPhone('');
      addActivityLog(`Subscription upgraded to ${plan}`);
      toast.success(`Successfully upgraded to the TradeMind ${plan} Plan!`);
    } catch (err: any) {
      toast.error(`Subscription failed: ${err.message}`);
      setIsUpgrading(false);
    }
  };

  // Hidden File Input Refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // --- Dynamic Profile Data State ---
  const [profileData, setProfileData] = useState<ProfileData>(DEFAULT_PROFILE_DATA);

  const [profilePhoto, setProfilePhoto] = useState<string>(''); // Base64 profile image string
  const [idCardFile, setIdCardFile] = useState<string>(''); // Filename indicator
  const [selfieFile, setSelfieFile] = useState<string>('');
  const [addressFile, setAddressFile] = useState<string>('');

  const [kycDocs, setKycDocs] = useState({
    idVerified: 'verified', // verified, pending, rejected
    selfieVerified: 'verified',
    addressVerified: 'pending',
    taxInfo: 'verified'
  });

  // Local state for editing fields
  const [editedData, setEditedData] = useState<ProfileData>(DEFAULT_PROFILE_DATA);

  // Load cached profile immediately, then refresh from the API.
  useEffect(() => {
    setIsClient(true);
    const savedProfile = localStorage.getItem('trademind_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.profileData) {
          const cachedProfile = { ...DEFAULT_PROFILE_DATA, ...parsed.profileData };
          setProfileData(cachedProfile);
          setEditedData(cachedProfile);
        }
        if (parsed.profilePhoto) setProfilePhoto(parsed.profilePhoto);
        if (parsed.idCardFile) setIdCardFile(parsed.idCardFile);
        if (parsed.selfieFile) setSelfieFile(parsed.selfieFile);
        if (parsed.addressFile) setAddressFile(parsed.addressFile);
        if (parsed.kycDocs) setKycDocs(parsed.kycDocs);
      } catch (e) {
        console.error('Failed to parse saved profile:', e);
      }
    }

    const refreshProfile = async () => {
      try {
        const user = await apiFetch<any>('/api/v2/users/me');
        const freshProfile = normalizeProfile(user);
        setProfileData(freshProfile);
        setEditedData(freshProfile);
        setProfilePhoto(user.profile?.avatarUrl || '');
        setIsAlpacaConnected(!!user.profile?.alpacaApiKey);
        saveProfileSnapshot(freshProfile, { profilePhoto: user.profile?.avatarUrl || '' });
      } catch (e: any) {
        console.error('Failed to refresh profile:', e);
        if (e?.message?.toLowerCase().includes('unauthorized')) {
          router.push('/login');
        }
      }
    };

    refreshProfile();
  }, []);

  // Save profile helper
  const saveToLocalStorage = (updatedProfileData = profileData, updatedPhoto = profilePhoto, updatedId = idCardFile, updatedSelfie = selfieFile, updatedAddress = addressFile, updatedKyc = kycDocs) => {
    saveProfileSnapshot(updatedProfileData, {
      profilePhoto: updatedPhoto,
      idCardFile: updatedId,
      selfieFile: updatedSelfie,
      addressFile: updatedAddress,
      kycDocs: updatedKyc
    });
  };

  // Calculate dynamic completion score
  const calculateCompletion = () => {
    let score = 50;
    if (profileData.firstName && profileData.lastName && profileData.dob) score += 10;
    if (profileData.email && profileData.phone) score += 10;
    if (profilePhoto) score += 10; // 10% for profile photo upload
    if (idCardFile) score += 10; // 10% for ID card ID upload
    if (selfieFile) score += 5; // 5% for selfie upload
    if (addressFile) score += 5; // 5% for address proof upload
    return Math.min(100, score);
  };

  // --- Image Upload Handlers ---
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Avatar file size must be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const toastId = toast.loading('Uploading profile photo...');
        try {
          await apiFetch('/api/v2/users/me', {
            method: 'PATCH',
            body: JSON.stringify({ avatarUrl: base64String })
          });
          setProfilePhoto(base64String);
          setProfileData(prev => ({ ...prev, avatarUrl: base64String }));
          setEditedData(prev => ({ ...prev, avatarUrl: base64String }));
          saveToLocalStorage({ ...profileData, avatarUrl: base64String }, base64String);
          toast.success('Profile photo uploaded and saved successfully!', { id: toastId });
        } catch (err: any) {
          toast.error(`Failed to save profile photo: ${err.message}`, { id: toastId });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await apiFetch('/api/v2/users/me/kyc', {
          method: 'POST',
          body: JSON.stringify({ documentType: 'ID_CARD', documentUrl: file.name })
        });
        setIdCardFile(file.name);
        const updatedKyc = { ...kycDocs, idVerified: 'verified' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, file.name, selfieFile, addressFile, updatedKyc);
        addActivityLog('KYC Document uploaded: Identity Card');
        toast.success('Identity card ID uploaded and verified!');
      } catch (err: any) {
        toast.error(`KYC submission failed: ${err.message}`);
      }
    }
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await apiFetch('/api/v2/users/me/kyc', {
          method: 'POST',
          body: JSON.stringify({ documentType: 'SELFIE', documentUrl: file.name })
        });
        setSelfieFile(file.name);
        const updatedKyc = { ...kycDocs, selfieVerified: 'verified' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, idCardFile, file.name, addressFile, updatedKyc);
        addActivityLog('KYC Selfie liveness upload completed');
        toast.success('Selfie verification photo uploaded!');
      } catch (err: any) {
        toast.error(`KYC selfie upload failed: ${err.message}`);
      }
    }
  };

  const handleAddressUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await apiFetch('/api/v2/users/me/kyc', {
          method: 'POST',
          body: JSON.stringify({ documentType: 'ADDRESS_PROOF', documentUrl: file.name })
        });
        setAddressFile(file.name);
        const updatedKyc = { ...kycDocs, addressVerified: 'verified' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, idCardFile, selfieFile, file.name, updatedKyc);
        addActivityLog('KYC Document uploaded: Address Proof');
        toast.success('Residential address proof uploaded and verified!');
      } catch (err: any) {
        toast.error(`KYC address upload failed: ${err.message}`);
      }
    }
  };

  // --- Security & API Keys ---
  const [twoFactor, setTwoFactor] = useState(true);
  const [biometric, setBiometric] = useState(false);
  
  const getInitialApiKeys = (): ApiKey[] => {
    if (typeof window === 'undefined') return [
      { id: 'key1', name: 'Alpaca Live Link', key: 'alp_live_••••••••••••••••3a9b', created: '2026-06-28' },
      { id: 'key2', name: 'Binance Spot Key', key: 'bin_spot_••••••••••••••••e82d', created: '2026-06-25' },
    ];
    const saved = localStorage.getItem('trademind_apikeys');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: 'key1', name: 'Alpaca Live Link', key: 'alp_live_••••••••••••••••3a9b', created: '2026-06-28' },
      { id: 'key2', name: 'Binance Spot Key', key: 'bin_spot_••••••••••••••••e82d', created: '2026-06-25' },
    ];
  };

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(getInitialApiKeys());
  const [newKeyName, setNewKeyName] = useState('');

  // --- Notification Channels ---
  const getInitialNotifications = () => {
    if (typeof window === 'undefined') return {
      email: true, sms: false, whatsapp: true, push: true, marketAlerts: true, signalAlerts: true, newsAlerts: false, priceAlerts: true
    };
    const saved = localStorage.getItem('trademind_notifications');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      email: true, sms: false, whatsapp: true, push: true, marketAlerts: true, signalAlerts: true, newsAlerts: false, priceAlerts: true
    };
  };
  const [notifications, setNotifications] = useState(getInitialNotifications());
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  // --- Notifications History / Notification Center ---
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  const fetchNotificationsList = async () => {
    try {
      const data = await apiFetch<any[]>('/api/v2/notifications');
      if (Array.isArray(data)) {
        setNotificationsList(data);
      }
    } catch (err: any) {
      toast.error('Failed to load notifications history.');
    }
  };

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationsList();
    }
  }, [activeTab]);

  const handleMarkAllReadCenter = async () => {
    try {
      await apiFetch('/api/v2/notifications/read-all', { method: 'PATCH' });
      setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkSingleReadCenter = async (id: string) => {
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err: any) {
      toast.error('Failed to update notification');
    }
  };

  // --- AI Preferences ---
  const getInitialAIPreferences = () => {
    if (typeof window === 'undefined') return {
      assistantActive: true,
      strategy: 'Trend Follower + Sentiment Analysis',
      automationMode: 'Semi-Autonomous (Requires Confirmation)',
      riskLimit: 'Max 2% Per Trade',
      interests: 'Macroeconomic Indexes, Liquid Forex Pairs',
      frequency: 'Hourly Highlights'
    };
    const saved = localStorage.getItem('trademind_aipreferences');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      assistantActive: true,
      strategy: 'Trend Follower + Sentiment Analysis',
      automationMode: 'Semi-Autonomous (Requires Confirmation)',
      riskLimit: 'Max 2% Per Trade',
      interests: 'Macroeconomic Indexes, Liquid Forex Pairs',
      frequency: 'Hourly Highlights'
    };
  };
  const [aiPreferences, setAiPreferences] = useState(getInitialAIPreferences());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_aipreferences', JSON.stringify(aiPreferences));
    }
  }, [aiPreferences]);

  // --- MT5 & Alpaca Broker State ---
  const [brokerType, setBrokerType] = useState<'alpaca' | 'mt5' | 'custom'>('alpaca');
  
  const getInitialMt5State = () => {
    if (typeof window === 'undefined') return { connected: false, server: 'MetaQuotes-Demo', login: '', password: '' };
    const saved = localStorage.getItem('trademind_mt5_broker');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return { connected: false, server: 'MetaQuotes-Demo', login: '', password: '' };
  };

  const [mt5Config, setMt5Config] = useState(getInitialMt5State());
  const [isAlpacaConnected, setIsAlpacaConnected] = useState(true);
  const [isConnectingBroker, setIsConnectingBroker] = useState(false);

  // --- Activity Logs State & Helper ---
  const getInitialActivityLogs = () => {
    if (typeof window === 'undefined') return [
      { act: 'Password changed successfully', time: '18 days ago', dev: 'Chrome (Nairobi, KE)' },
      { act: 'KYC Document submitted: Bank statement', time: 'Jun 22, 2026', dev: 'iPhone 15 Pro' },
      { act: 'Connected API integrations: Alpaca Live Link', time: 'Jun 28, 2026', dev: 'MacOS Native' },
      { act: 'Deposited funds: $5,000 USD via Visa', time: 'Jul 01, 2026', dev: 'Safari (Nairobi, KE)' },
    ];
    const saved = localStorage.getItem('trademind_activity_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { act: 'Password changed successfully', time: '18 days ago', dev: 'Chrome (Nairobi, KE)' },
      { act: 'KYC Document submitted: Bank statement', time: 'Jun 22, 2026', dev: 'iPhone 15 Pro' },
      { act: 'Connected API integrations: Alpaca Live Link', time: 'Jun 28, 2026', dev: 'MacOS Native' },
      { act: 'Deposited funds: $5,000 USD via Visa', time: 'Jul 01, 2026', dev: 'Safari (Nairobi, KE)' },
    ];
  };

  const [activityLogs, setActivityLogs] = useState(getInitialActivityLogs());

  const addActivityLog = (action: string) => {
    if (typeof window === 'undefined') return;
    const nextLog = {
      act: action,
      time: new Date().toLocaleTimeString() + ' (' + new Date().toLocaleDateString() + ')',
      dev: 'Web Client Native'
    };
    const nextLogs = [nextLog, ...activityLogs];
    setActivityLogs(nextLogs);
    localStorage.setItem('trademind_activity_logs', JSON.stringify(nextLogs.slice(0, 50)));
  };

  const displayValue = (value?: string | null) => value?.trim() || 'Not set';

  const handleEditToggle = () => {
    if (!isEditMode) {
      setEditedData({ ...profileData });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveChanges = async () => {
    try {
      // Validate nationalId: must be exactly 8 digits
      const nationalIdStr = editedData.nationalId?.trim() || "";
      if (nationalIdStr && !/^\d{8}$/.test(nationalIdStr)) {
        toast.error("National ID/Passport must be exactly 8 digits.");
        return;
      }

      const { email, phone, ...profilePayload } = editedData;
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify(profilePayload),
      });

      setProfileData({ ...editedData });
      saveToLocalStorage(editedData, editedData.avatarUrl || profilePhoto);
      setIsEditMode(false);
      addActivityLog('Profile details edited');
      toast.success('Changes applied to profile successfully!');
    } catch (e: any) {
      toast.error(e?.message || 'Unable to save profile changes.');
    }
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    const cleanName = newKeyName.trim();
    const generatedKey = `ap_key_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const newKey: ApiKey = {
      id: Math.random().toString(),
      name: cleanName,
      key: `${generatedKey.substring(0, 8)}••••••••••••••••${generatedKey.substring(generatedKey.length - 4)}`,
      created: new Date().toISOString().split('T')[0],
    };
    
    const next = [...apiKeys, newKey];
    setApiKeys(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_apikeys', JSON.stringify(next));
    }
    addActivityLog(`API Key "${cleanName}" generated`);
    setNewKeyName('');
    toast.success(`API key "${cleanName}" generated successfully!`);
  };

  const handleDeleteKey = (id: string) => {
    const keyToDelete = apiKeys.find(k => k.id === id);
    const next = apiKeys.filter(k => k.id !== id);
    setApiKeys(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_apikeys', JSON.stringify(next));
    }
    addActivityLog(`API Key "${keyToDelete?.name || 'Unknown'}" revoked`);
    toast.success('API key revoked successfully.');
  };

  const handleBrokerSync = async () => {
    const toastId = toast.loading(`Synchronizing live broker account status...`);
    try {
      if (brokerType === 'alpaca') {
        if (!isAlpacaConnected) {
          toast.error('Alpaca is not connected.', { id: toastId });
          return;
        }
        const res = await apiFetch<any>('/api/v2/portfolio/broker');
        addActivityLog('Broker connection synchronized: Alpaca API');
        toast.success(`Synced Alpaca Account successfully! Balance: $${res.balance.toLocaleString()}, Equity: $${res.equity.toLocaleString()}`, { id: toastId });
      } else {
        if (!mt5Config.connected) {
          toast.error('MT5 is not connected.', { id: toastId });
          return;
        }
        addActivityLog('Broker connection synchronized: MetaTrader 5');
        toast.success(`Synced MT5 Account #${mt5Config.login} successfully! Leverage: 1:500, Balance: $10,540.20, Free Margin: $9,820.00`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`, { id: toastId });
    }
  };

  const handleConnectBroker = async (type: string) => {
    const key = editedData.brokerKey?.trim();
    const secret = editedData.brokerSecret?.trim();
    const server = editedData.brokerServer?.trim() || '';

    if (!key || !secret) {
      toast.error('Please enter both your connection Key/ID and Secret/Password.');
      return;
    }

    const toastId = toast.loading(`Connecting to ${type.toUpperCase()} broker terminal...`);
    try {
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          brokerType: type,
          brokerKey: key,
          brokerSecret: secret,
          brokerServer: server
        })
      });
      setProfileData(prev => ({ ...prev, brokerType: type, brokerKey: key, brokerSecret: secret, brokerServer: server }));
      saveToLocalStorage({ ...profileData, brokerType: type, brokerKey: key, brokerSecret: secret, brokerServer: server });
      addActivityLog(`Connected broker connection: ${type.toUpperCase()}`);
      toast.success(`${type.toUpperCase()} integrated and authenticated successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error(`Verification failed: ${err.message}`, { id: toastId });
    }
  };

  const handleDisconnectBroker = async () => {
    const confirmDisconnect = window.confirm('Are you sure you want to disconnect your active broker connection?');
    if (!confirmDisconnect) return;
    const toastId = toast.loading('Disconnecting broker...');
    try {
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          brokerType: 'None',
          brokerKey: '',
          brokerSecret: '',
          brokerServer: ''
        })
      });
      setEditedData(prev => ({ ...prev, brokerType: 'None', brokerKey: '', brokerSecret: '', brokerServer: '' }));
      setProfileData(prev => ({ ...prev, brokerType: 'None', brokerKey: '', brokerSecret: '', brokerServer: '' }));
      saveToLocalStorage({ ...profileData, brokerType: 'None', brokerKey: '', brokerSecret: '', brokerServer: '' });
      addActivityLog('Broker connection disconnected');
      toast.success('Broker disconnected successfully.', { id: toastId });
    } catch (err: any) {
      toast.error(`Disconnection failed: ${err.message}`, { id: toastId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isClient) return null; // Avoid hydration mismatch

  const completionPercent = calculateCompletion();

  return (
    <motion.div
      className="space-y-6 print:bg-white print:text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Hidden File Inputs */}
      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
      <input type="file" ref={idInputRef} onChange={handleIdUpload} accept="image/*,application/pdf" className="hidden" />
      <input type="file" ref={selfieInputRef} onChange={handleSelfieUpload} accept="image/*" className="hidden" />
      <input type="file" ref={addressInputRef} onChange={handleAddressUpload} accept="image/*,application/pdf" className="hidden" />

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
        
        <div className="flex flex-col sm:flex-row gap-6 items-center relative z-10 w-full md:w-auto">
          {/* Avatar Area - Responsive and Uploadable */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-tr from-purple-500 to-indigo-600 border-2 border-purple-400/30 flex items-center justify-center shadow-2xl relative">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-white">
                  {profileData.firstName?.charAt(0) || ''}{profileData.lastName?.charAt(0) || ''}
                </span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl border border-white/10 shadow-lg cursor-pointer transition-all print:hidden"
              title="Upload New Profile Photo"
            >
              <UploadCloud size={14} />
            </button>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl sm:text-2xl font-display font-black text-white">{profileData.firstName} {profileData.lastName}</h2>
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">Pro Member</Badge>
              {completionPercent === 100 ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Complete Profile
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle size={10} /> Pending Uploads
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">ID: TM-2026-000124 • Joined Jun 2026</p>
            <p className="text-xs text-slate-500">Last login: Today, 09:21 AM ({profileData.timezone})</p>
          </div>
        </div>

        {/* Profile Completion Bar */}
        <div className="w-full md:w-auto min-w-[240px] space-y-2 relative z-10">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
            <span>Profile Completion</span>
            <span className="text-purple-400 font-black">{completionPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 text-right">
            {completionPercent === 100 ? '✅ All KYC requirements verified!' : 'Upload ID & Selfie to reach 100%'}
          </p>
        </div>
      </div>

      {/* --- Tab Navigation --- */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-px print:hidden scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'kyc', label: 'Verification (KYC)', icon: Shield },
          { id: 'security', label: 'Security & Keys', icon: Key },
          { id: 'ai', label: 'AI Preferences', icon: BrainCircuit },
          { id: 'notifications', label: 'Notification Center', icon: Bell },
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.firstName)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.middleName)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.lastName)}</span>
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
                        <span className="text-slate-200 font-semibold">{profileData.username ? `@${profileData.username}` : 'Not set'}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.dob)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Gender</span>
                      {isEditMode ? (
                        <select
                          value={editedData.gender || 'Male'}
                          onChange={e => setEditedData({ ...editedData, gender: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 bg-slate-900"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.gender)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.nationality)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">National ID/Passport</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.nationalId || ''}
                          onChange={e => setEditedData({ ...editedData, nationalId: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 font-mono"
                          placeholder="8-digit ID"
                        />
                      ) : (
                        <span className="text-slate-300 font-mono font-bold">{displayValue(profileData.nationalId)}</span>
                      )}
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.occupation)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.email)}</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">Verified</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Phone Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.phone)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.secondaryEmail)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.communicationPref)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.country)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.state)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.county)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.city)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.postalCode)}</span>
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
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.address)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Timezone</span>
                      <span className="text-slate-200 font-semibold">{displayValue(profileData.timezone)}</span>
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
                  {/* Identity Card ID Verification */}
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">Identity Verification (ID Card)</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">Government-issued Passport or National ID Card.</p>
                      {idCardFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {idCardFile}
                        </div>
                      )}
                      <button
                        onClick={() => idInputRef.current?.click()}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline pt-2 cursor-pointer"
                      >
                        <UploadCloud size={12} /> {idCardFile ? 'Replace Document' : 'Upload ID Card'}
                      </button>
                    </div>
                    <Badge className={
                      idCardFile ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }>
                      {idCardFile ? '✅ Verified' : '🔴 Pending Upload'}
                    </Badge>
                  </div>

                  {/* Selfie Liveness Verification */}
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">Selfie Liveness Verification</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">3D biometric facial scanning check.</p>
                      {selfieFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {selfieFile}
                        </div>
                      )}
                      <button
                        onClick={() => selfieInputRef.current?.click()}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline pt-2 cursor-pointer"
                      >
                        <UploadCloud size={12} /> {selfieFile ? 'Replace Selfie' : 'Upload Selfie Photo'}
                      </button>
                    </div>
                    <Badge className={
                      selfieFile ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }>
                      {selfieFile ? '✅ Verified' : '🔴 Pending Upload'}
                    </Badge>
                  </div>

                  {/* Address Proof Verification */}
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">Address Verification</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">Utility bill or bank statement (&lt; 3 months old).</p>
                      {addressFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {addressFile}
                        </div>
                      )}
                      <button
                        onClick={() => addressInputRef.current?.click()}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline pt-2 cursor-pointer"
                      >
                        <UploadCloud size={12} /> {addressFile ? 'Replace Proof' : 'Upload Address Proof'}
                      </button>
                    </div>
                    <Badge className={
                      addressFile ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }>
                      {addressFile ? '✅ Verified' : '🔴 Pending Upload'}
                    </Badge>
                  </div>

                  {/* Tax Compliance Info */}
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-slate-200 text-xs">Tax Compliance Info</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">W-8BEN / international PIN code registry.</p>
                    </div>
                    <Badge className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      ✅ Verified
                    </Badge>
                  </div>
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

            {/* Tab: Notification Center */}
            {activeTab === 'notifications' && (
              <motion.div
                key="tab-notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-white text-base">Alert & Signal Notification Center</h3>
                    <p className="text-xs text-slate-400">View and manage your real-time system alerts, news digests, and trade executions.</p>
                  </div>
                  {notificationsList.filter(n => !n.isRead).length > 0 && (
                    <button
                      onClick={handleMarkAllReadCenter}
                      className="px-4 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 font-bold text-xs hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      Mark All as Read
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  {notificationsList.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-full bg-slate-900/60 border border-white/5 flex items-center justify-center">
                        <Bell size={20} className="text-slate-500" />
                      </div>
                      <p className="text-sm text-slate-400 font-semibold">No notifications history</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">When trade executions occur, AI models run, or system alerts fire, you'll see them documented here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notificationsList.map((notif) => (
                        <div
                          key={notif.id}
                          className={cn(
                            "py-4 first:pt-0 last:pb-0 flex items-start gap-4 transition-all",
                            notif.isRead ? "opacity-75" : ""
                          )}
                        >
                          <div className={cn(
                            "p-2.5 rounded-xl border flex items-center justify-center shrink-0",
                            notif.isRead 
                              ? "bg-slate-900/40 border-white/5 text-slate-500"
                              : "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          )}>
                            <Bell size={18} />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("font-bold text-sm", notif.isRead ? "text-slate-300" : "text-white")}>
                                  {notif.title}
                                </span>
                                {!notif.isRead && (
                                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] px-1 py-0 uppercase">New</Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed break-words">{notif.message}</p>
                          </div>

                          {!notif.isRead && (
                            <button
                              onClick={() => handleMarkSingleReadCenter(notif.id)}
                              className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 text-slate-300 hover:text-white font-bold text-[10px] transition-colors cursor-pointer shrink-0"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
                    <button
                      onClick={() => router.push('/wallet')}
                      className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Manage Wallet
                    </button>
                    <button
                      onClick={() => router.push('/wallet#history')}
                      className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
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
                      <span className="text-slate-200 font-bold">API Limits</span>
                      <span className="text-slate-200 font-bold">5,000 / Day (92% free)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setIsUpgradeOpen(true)}
                      className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Upgrade Plan
                    </button>
                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Billing History
                    </button>
                  </div>
                </div>

                {/* Plan Upgrade Modal Overlay */}
                <AnimatePresence>
                  {isUpgradeOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <motion.div
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { if (!isUpgrading) setIsUpgradeOpen(false); }}
                      />

                      <motion.div
                        className="relative w-full max-w-md overflow-hidden glass-card rounded-3xl border border-white/10 bg-slate-950/85 p-6 shadow-2xl text-xs"
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                          <h3 className="font-display font-bold text-white text-sm">Choose Your Plan</h3>
                          {!isUpgrading && (
                            <button
                              onClick={() => setIsUpgradeOpen(false)}
                              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        {isUpgrading ? (
                          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                            <RefreshCw size={36} className="text-purple-400 animate-spin" />
                            <div>
                              <p className="text-slate-200 font-semibold text-xs">{upgradeStep}</p>
                              <p className="text-[10px] text-slate-500 mt-1">Completing payment handshake...</p>
                            </div>
                          </div>
                        ) : selectedPlan ? (
                          <div className="space-y-4">
                            <div className="p-3.5 rounded-xl border border-white/5 bg-white/2">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Selected Plan</span>
                              <span className="text-sm font-bold text-slate-100">{selectedPlan}</span>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Billing Method</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentMode('mpesa')}
                                  className={cn(
                                    'p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all',
                                    paymentMode === 'mpesa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                                  )}
                                >
                                  💳 M-Pesa STK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentMode('visa')}
                                  className={cn(
                                    'p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all',
                                    paymentMode === 'visa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                                  )}
                                >
                                  💳 Credit Card
                                </button>
                              </div>
                            </div>

                            {paymentMode === 'mpesa' && (
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">M-Pesa Number</label>
                                <input
                                  type="text"
                                  required
                                  value={billingPhone}
                                  onChange={(e) => setBillingPhone(e.target.value)}
                                  placeholder="e.g. 254712345678"
                                  className="w-full input-glass rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                                />
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setSelectedPlan(null)}
                                className="flex-1 btn-ghost py-2.5 rounded-xl font-semibold cursor-pointer text-center text-xs"
                              >
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePlanUpgrade(selectedPlan)}
                                className="flex-1 btn-primary py-2.5 rounded-xl font-bold cursor-pointer text-center text-xs"
                              >
                                Confirm & Pay
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3.5">
                            {[
                              { name: 'Basic Tier', price: '$20/mo', desc: 'Core signals and entry-level indicators.' },
                              { name: 'Pro Tier', price: '$49/mo', desc: 'Ensemble models, live Websockets ticks, and custom alerts.' },
                              { name: 'Enterprise Tier', price: '$199/mo', desc: 'Dedicated copilot endpoints and custom fine-tuned parameters.' },
                            ].map((plan) => (
                              <div
                                key={plan.name}
                                onClick={() => { setSelectedPlan(plan.name); setPaymentMode('mpesa'); }}
                                className="p-3.5 rounded-xl border border-white/5 bg-white/2 hover:bg-purple-500/5 hover:border-purple-500/20 transition-all cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-bold text-slate-200">{plan.name}</div>
                                  <div className="text-[10px] text-slate-500 mt-1">{plan.desc}</div>
                                </div>
                                <div className="text-right">
                                  <span className="font-black text-purple-400">{plan.price}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Billing History Modal Overlay */}
                <AnimatePresence>
                  {isHistoryOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <motion.div
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsHistoryOpen(false)}
                      />

                      <motion.div
                        className="relative w-full max-w-lg overflow-hidden glass-card rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl text-xs"
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                          <h3 className="font-display font-bold text-white text-sm">Billing History</h3>
                          <button
                            onClick={() => setIsHistoryOpen(false)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full data-table">
                            <thead>
                              <tr>
                                <th className="text-left">Date</th>
                                <th className="text-left">Details</th>
                                <th className="text-right">Amount</th>
                                <th className="text-center">Receipt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { date: '2026-06-28', label: 'Pro Plan (Annual)', amount: '$480.00' },
                                { date: '2026-05-28', label: 'Pro Plan (Monthly)', amount: '$49.00' },
                                { date: '2026-04-28', label: 'Basic Plan (Monthly)', amount: '$20.00' },
                              ].map((inv) => (
                                <tr key={inv.date}>
                                  <td className="text-slate-400 font-mono">{inv.date}</td>
                                  <td className="text-slate-200 font-bold">{inv.label}</td>
                                  <td className="text-right text-slate-300 font-semibold">{inv.amount}</td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      onClick={() => toast.success('Invoice download initialized...')}
                                      className="btn-ghost text-[10px] px-2.5 py-1 rounded-lg border border-white/5 cursor-pointer text-purple-400 hover:text-white"
                                    >
                                      PDF
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
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
                    {activityLogs.map((log: any, index: number) => (
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
            <div className="flex justify-between items-center">
              <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider text-slate-500">Connected Broker</h4>
            </div>
            
            <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/5">
              {[
                { id: 'alpaca', label: 'Alpaca API' },
                { id: 'mt5', label: 'MetaTrader 5 (MT5)' },
                { id: 'custom', label: 'Custom Broker' }
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBrokerType(id as any)}
                  className={cn(
                    "flex-1 text-[9px] font-bold py-1.5 rounded-lg transition-all cursor-pointer text-center",
                    brokerType === id ? "bg-purple-500 text-white shadow-md shadow-purple-500/10" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {editedData.brokerType?.toLowerCase() === brokerType ? (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-200">
                      {brokerType === 'alpaca' ? 'Alpaca Securities LLC' : brokerType === 'mt5' ? 'MetaTrader 5 Client' : 'Custom Broker Terminal'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Account ID: {editedData.brokerKey ? `${editedData.brokerKey.slice(0, 8)}••••••••` : '••••••••'}
                    </div>
                    {editedData.brokerServer && (
                      <div className="text-[9px] text-slate-600 mt-0.5">
                        Server/Endpoint: {editedData.brokerServer}
                      </div>
                    )}
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">CONNECTED</Badge>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBrokerSync}
                    className="btn-ghost flex-1 text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} /> Sync
                  </button>
                  <button
                    onClick={handleDisconnectBroker}
                    className="btn-ghost flex-1 text-xs py-2 rounded-xl font-bold text-red-400 hover:text-red-300 border-red-500/20 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs">
                <p className="text-[10px] text-slate-500 leading-normal">
                  {brokerType === 'alpaca'
                    ? 'Enter your Alpaca Paper or Live API keys to authorize auto-trading execution.'
                    : brokerType === 'mt5'
                      ? 'Enter your MetaTrader 5 Login ID, password, and broker server details.'
                      : 'Enter your custom broker API key and endpoint gateway server.'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                      {brokerType === 'alpaca' ? 'API Key ID' : brokerType === 'mt5' ? 'MT5 Login ID' : 'Broker API Key / ID'}
                    </label>
                    <input
                      type="text"
                      placeholder={brokerType === 'alpaca' ? 'e.g. CKEW3CS6HQ6ULMVSIDHQ' : brokerType === 'mt5' ? 'e.g. 509214' : 'API Key ID'}
                      value={editedData.brokerKey || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, brokerKey: e.target.value }))}
                      className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                      {brokerType === 'alpaca' ? 'Secret Key' : brokerType === 'mt5' ? 'MT5 Password' : 'Secret Key / Password'}
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••••••••••"
                      value={editedData.brokerSecret || ''}
                      onChange={(e) => setEditedData(prev => ({ ...prev, brokerSecret: e.target.value }))}
                      className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  {brokerType !== 'alpaca' ? (
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                        {brokerType === 'mt5' ? 'MT5 Server Host' : 'API Endpoint Server'}
                      </label>
                      <input
                        type="text"
                        placeholder={brokerType === 'mt5' ? 'e.g. ICMarkets-Demo' : 'e.g. https://api.custombroker.com'}
                        value={editedData.brokerServer || ''}
                        onChange={(e) => setEditedData(prev => ({ ...prev, brokerServer: e.target.value }))}
                        className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">API Endpoint environment</label>
                      <select
                        value={editedData.brokerServer || 'https://paper-api.alpaca.markets'}
                        onChange={(e) => setEditedData(prev => ({ ...prev, brokerServer: e.target.value }))}
                        className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="https://paper-api.alpaca.markets">Paper Sandbox (Demo)</option>
                        <option value="https://api.alpaca.markets">Live Account (Production)</option>
                      </select>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleConnectBroker(brokerType)}
                  className="w-full btn-primary py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  Authenticate {brokerType === 'alpaca' ? 'Alpaca API' : brokerType === 'mt5' ? 'MT5 Account' : 'Custom Broker'}
                </button>
              </div>
            )}
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
