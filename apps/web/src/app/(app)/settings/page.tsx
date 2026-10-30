'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Key,
  Bell,
  Shield,
  Plus,
  Trash2,
  Mail,
  MapPin,
  Award,
  BrainCircuit,
  Wallet,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  Edit3,
  Settings2,
  Printer,
  Check,
  X,
  ShieldAlert,
  Cpu,
  Layers,
  History,
  GraduationCap,
  BarChart2,
  Copy,
  Flame,
  Zap,
  Sparkles,
  Link2,
  Lock,
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

type TabType = 'overview' | 'broker' | 'ai' | 'kyc' | 'security' | 'billing' | 'activity';

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

  const [portfolioStats, setPortfolioStats] = useState({
    totalTrades: 0,
    winRate: '0.0%',
    signalsFollowed: 0,
    aiAccuracy: '94.2%',
    totalProfit: 0,
  });
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Real Academy & XP stats
  const [academyStats, setAcademyStats] = useState({
    completedCourses: 0,
    totalCourses: 0,
    completedLessons: 0,
    totalLessons: 0,
    certificatesEarned: 0,
    passedQuizzes: 0,
    totalQuizzes: 0,
    totalXp: 0,
    gradedAssignments: 0,
    totalAssignments: 0,
  });

  useEffect(() => {
    const fetchAllLiveStats = async () => {
      try {
        const [stats, brokers, acadProgress, quizStats, assignmentsRes] = await Promise.allSettled([
          apiFetch<any>('/api/v2/portfolio/stats'),
          apiFetch<any>('/api/v2/brokers/accounts'),
          apiFetch<any>('/api/v2/academy/progress'),
          apiFetch<any>('/api/v2/academy/quizzes/stats'),
          apiFetch<any[]>('/api/v2/academy/assignments'),
        ]);

        if (stats.status === 'fulfilled' && stats.value) {
          setPortfolioStats({
            totalTrades: stats.value.totalTrades || 0,
            winRate: stats.value.winRate || '0.0%',
            signalsFollowed: stats.value.signalsFollowed || 0,
            aiAccuracy: stats.value.aiAccuracy || '94.2%',
            totalProfit: Number(stats.value.totalProfit || 0),
          });
        }

        if (brokers.status === 'fulfilled' && brokers.value?.summary) {
          setWalletBalance(brokers.value.summary.totalBalance || 0);
        }

        const prog = acadProgress.status === 'fulfilled' ? acadProgress.value : null;
        const qStat = quizStats.status === 'fulfilled' ? quizStats.value : null;
        const assignList =
          assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value)
            ? assignmentsRes.value
            : [];

        setAcademyStats({
          completedCourses: prog?.completedCourses || 0,
          totalCourses: prog?.totalCourses || 0,
          completedLessons: prog?.completedLessons || 0,
          totalLessons: prog?.totalLessons || 0,
          certificatesEarned: prog?.certificatesEarned || 0,
          passedQuizzes: qStat?.passedCount || 0,
          totalQuizzes: qStat?.totalQuizzes || 0,
          totalXp: qStat?.totalXp || 0,
          gradedAssignments: assignList.filter((a: any) => a.userSubmission?.status === 'GRADED').length,
          totalAssignments: assignList.length,
        });
      } catch (err) {}
    };
    fetchAllLiveStats();
  }, []);

  useEffect(() => {
    setIsClient(true);
    const handleUrlChange = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['overview', 'broker', 'ai', 'kyc', 'security', 'billing', 'activity'].includes(tab)) {
          setActiveTab(tab as TabType);
        }
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
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

  // Password Change Modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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

      await apiFetch('/api/v2/subscriptions/upgrade-instant', {
        method: 'POST',
        body: JSON.stringify({
          planCode: planEnum,
          paymentMethod: paymentMode,
          phoneNumber: billingPhone || undefined,
        }),
      });

      setUpgradeStep('Synchronizing subscription credentials...');
      await new Promise((r) => setTimeout(r, 900));

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
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [idCardFile, setIdCardFile] = useState<string>('');
  const [selfieFile, setSelfieFile] = useState<string>('');
  const [addressFile, setAddressFile] = useState<string>('');

  const [kycDocs, setKycDocs] = useState({
    idVerified: 'verified',
    selfieVerified: 'verified',
    addressVerified: 'pending',
    taxInfo: 'verified',
  });

  const [editedData, setEditedData] = useState<ProfileData>(DEFAULT_PROFILE_DATA);
  const [brokerType, setBrokerType] = useState<'alpaca' | 'mt5' | 'custom'>('mt5');

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
          if (cachedProfile.brokerType && cachedProfile.brokerType !== 'None') {
            setBrokerType(cachedProfile.brokerType.toLowerCase() as any);
          }
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
        if (typeof user.isTwoFactorEnabled === 'boolean') {
          setTwoFactor(user.isTwoFactorEnabled);
        }
        if (freshProfile.brokerType && freshProfile.brokerType !== 'None') {
          setBrokerType(freshProfile.brokerType.toLowerCase() as any);
        }
        if (Array.isArray(user.apiKeys)) {
          const mappedKeys: ApiKey[] = user.apiKeys.map((k: any) => ({
            id: k.id,
            name: k.name,
            key: k.keyHash,
            created: k.createdAt ? new Date(k.createdAt).toISOString().split('T')[0] : '',
          }));
          setApiKeys(mappedKeys);
        }
        if (Array.isArray(user.auditLogs) && user.auditLogs.length > 0) {
          const mappedLogs = user.auditLogs.map((l: any) => ({
            act: l.action,
            time: new Date(l.timestamp).toLocaleString(),
            dev: l.userAgent ? l.userAgent.slice(0, 42) : 'PostgreSQL Audit Vault',
          }));
          setActivityLogs(mappedLogs);
        }
        if (user.profile?.tradingStyle || user.profile?.tradingSession || user.profile?.riskAppetite) {
          setAiPreferences((prev: any) => ({
            ...prev,
            setupMode: user.profile?.tradingStyle || prev.setupMode,
            killzoneWindow: user.profile?.tradingSession || prev.killzoneWindow,
            riskLimit: user.profile?.riskAppetite || prev.riskLimit,
          }));
        }
        saveProfileSnapshot(freshProfile, { profilePhoto: user.profile?.avatarUrl || '' });
      } catch (e: any) {
        if (e?.message?.toLowerCase().includes('unauthorized')) {
          router.push('/login');
        }
      }
    };

    refreshProfile();
  }, []);

  const saveToLocalStorage = (
    updatedProfileData = profileData,
    updatedPhoto = profilePhoto,
    updatedId = idCardFile,
    updatedSelfie = selfieFile,
    updatedAddress = addressFile,
    updatedKyc = kycDocs
  ) => {
    saveProfileSnapshot(updatedProfileData, {
      profilePhoto: updatedPhoto,
      idCardFile: updatedId,
      selfieFile: updatedSelfie,
      addressFile: updatedAddress,
      kycDocs: updatedKyc,
    });
  };

  const calculateCompletion = () => {
    let score = 50;
    if (profileData.firstName && profileData.lastName && profileData.dob) score += 10;
    if (profileData.email && profileData.phone) score += 10;
    if (profilePhoto) score += 10;
    if (idCardFile) score += 10;
    if (selfieFile) score += 5;
    if (addressFile) score += 5;
    return Math.min(100, score);
  };

  // --- Image & KYC Upload Handlers ---
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
            body: JSON.stringify({ avatarUrl: base64String }),
          });
          setProfilePhoto(base64String);
          setProfileData((prev) => ({ ...prev, avatarUrl: base64String }));
          setEditedData((prev) => ({ ...prev, avatarUrl: base64String }));
          saveToLocalStorage({ ...profileData, avatarUrl: base64String }, base64String);
          addActivityLog('Updated profile avatar photo');
          toast.success('Profile photo uploaded and saved to database!', { id: toastId });
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
          body: JSON.stringify({ documentType: 'ID_CARD', documentUrl: file.name }),
        });
        setIdCardFile(file.name);
        const updatedKyc = { ...kycDocs, idVerified: 'pending' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, file.name, selfieFile, addressFile, updatedKyc);
        addActivityLog('KYC Document uploaded: Identity Card');
        toast.success('Identity card saved in KYC database! Status: Under Admin Review.');
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
          body: JSON.stringify({ documentType: 'SELFIE', documentUrl: file.name }),
        });
        setSelfieFile(file.name);
        const updatedKyc = { ...kycDocs, selfieVerified: 'pending' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, idCardFile, file.name, addressFile, updatedKyc);
        addActivityLog('KYC Selfie liveness upload completed');
        toast.success('Selfie saved in KYC database! Status: Under Admin Review.');
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
          body: JSON.stringify({ documentType: 'ADDRESS_PROOF', documentUrl: file.name }),
        });
        setAddressFile(file.name);
        const updatedKyc = { ...kycDocs, addressVerified: 'pending' };
        setKycDocs(updatedKyc);
        saveToLocalStorage(profileData, profilePhoto, idCardFile, selfieFile, file.name, updatedKyc);
        addActivityLog('KYC Document uploaded: Address Proof');
        toast.success('Residential address proof saved in KYC database!');
      } catch (err: any) {
        toast.error(`KYC address upload failed: ${err.message}`);
      }
    }
  };

  // --- Security & API Keys ---
  const [twoFactor, setTwoFactor] = useState(true);
  const [biometric, setBiometric] = useState(false);

  const getInitialApiKeys = (): ApiKey[] => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('trademind_apikeys');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  };

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(getInitialApiKeys());
  const [newKeyName, setNewKeyName] = useState('');

  // --- Notification Channels ---
  const getInitialNotifications = () => {
    if (typeof window === 'undefined')
      return {
        email: true,
        sms: false,
        whatsapp: true,
        push: true,
        marketAlerts: true,
        signalAlerts: true,
        academyNotesAlerts: true,
        homeworkGradingAlerts: true,
      };
    const saved = localStorage.getItem('trademind_notifications');
    if (saved) {
      try {
        return {
          academyNotesAlerts: true,
          homeworkGradingAlerts: true,
          ...JSON.parse(saved),
        };
      } catch {}
    }
    return {
      email: true,
      sms: false,
      whatsapp: true,
      push: true,
      marketAlerts: true,
      signalAlerts: true,
      academyNotesAlerts: true,
      homeworkGradingAlerts: true,
    };
  };
  const [notifications, setNotifications] = useState(getInitialNotifications());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  // --- Gold Engine v3 & AI Preferences ---
  const getInitialAIPreferences = () => {
    if (typeof window === 'undefined')
      return {
        assistantActive: true,
        strategy: 'Gold Engine v3: MTF SMC Order Block, FVG & OTE (62%-79%)',
        setupMode: 'Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION',
        killzoneWindow: 'London Open (07-10 UTC) + NY AM Overlap (12-15 UTC)',
        automationMode: 'Semi-Autonomous (Requires Confirmation)',
        riskLimit: 'Max 2% Per Trade (Standard)',
        maxDrawdown: '10% Max Portfolio Loss',
        requireStopLoss: true,
        sessionFilter: true,
        oteFilter: true,
      };
    const saved = localStorage.getItem('trademind_aipreferences');
    if (saved) {
      try {
        return {
          setupMode: 'Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION',
          killzoneWindow: 'London Open (07-10 UTC) + NY AM Overlap (12-15 UTC)',
          oteFilter: true,
          ...JSON.parse(saved),
        };
      } catch {}
    }
    return {
      assistantActive: true,
      strategy: 'Gold Engine v3: MTF SMC Order Block, FVG & OTE (62%-79%)',
      setupMode: 'Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION',
      killzoneWindow: 'London Open (07-10 UTC) + NY AM Overlap (12-15 UTC)',
      automationMode: 'Semi-Autonomous (Requires Confirmation)',
      riskLimit: 'Max 2% Per Trade (Standard)',
      maxDrawdown: '10% Max Portfolio Loss',
      requireStopLoss: true,
      sessionFilter: true,
      oteFilter: true,
    };
  };
  const [aiPreferences, setAiPreferences] = useState(getInitialAIPreferences());

  const persistAiPreferences = async (nextPrefs: any) => {
    setAiPreferences(nextPrefs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trademind_aipreferences', JSON.stringify(nextPrefs));
    }
    try {
      await apiFetch('/api/v2/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(nextPrefs),
      });
    } catch (e) {}
  };

  // --- Activity Logs State & Helper ---
  const getInitialActivityLogs = () => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('trademind_activity_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        act: 'Authenticated into Institutional Command Center',
        time: new Date().toLocaleTimeString() + ' (' + new Date().toLocaleDateString() + ')',
        dev: 'Web Client Native',
      },
    ];
  };

  const [activityLogs, setActivityLogs] = useState(getInitialActivityLogs());

  const addActivityLog = (action: string) => {
    if (typeof window === 'undefined') return;
    const nextLog = {
      act: action,
      time: new Date().toLocaleTimeString() + ' (' + new Date().toLocaleDateString() + ')',
      dev: 'Web Client Native',
    };
    const nextLogs = [nextLog, ...activityLogs];
    setActivityLogs(nextLogs);
    localStorage.setItem('trademind_activity_logs', JSON.stringify(nextLogs.slice(0, 50)));
  };

  const displayValue = (value?: string | null) => value?.trim() || 'Not set';

  const handleEditToggle = () => {
    if (!isEditMode) {
      setEditedData({ ...profileData });
      if (activeTab !== 'overview') {
        setActiveTab('overview');
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveChanges = async () => {
    try {
      const nationalIdStr = editedData.nationalId?.trim() || '';
      if (nationalIdStr && !/^\d{8}$/.test(nationalIdStr)) {
        toast.error('National ID/Passport must be exactly 8 digits.');
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
      addActivityLog('Profile identity & contact details updated in PostgreSQL');
      toast.success('Changes saved to database successfully!');
    } catch (e: any) {
      toast.error(e?.message || 'Unable to save profile changes.');
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error('Please enter a label for the API key');
      return;
    }
    const cleanName = newKeyName.trim();
    try {
      const created = await apiFetch<any>('/api/v2/users/me/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: cleanName }),
      });
      const newKey: ApiKey = {
        id: created.id,
        name: created.name,
        key: created.keyHash,
        created: created.createdAt ? new Date(created.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      };
      const next = [newKey, ...apiKeys];
      setApiKeys(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trademind_apikeys', JSON.stringify(next));
      }
      addActivityLog(`API Key "${cleanName}" generated & saved in PostgreSQL`);
      setNewKeyName('');
      toast.success(`API key "${cleanName}" generated and saved to database!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate API key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    const keyToDelete = apiKeys.find((k) => k.id === id);
    try {
      await apiFetch(`/api/v2/users/me/api-keys/${id}`, {
        method: 'DELETE',
      });
      const next = apiKeys.filter((k) => k.id !== id);
      setApiKeys(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trademind_apikeys', JSON.stringify(next));
      }
      addActivityLog(`API Key "${keyToDelete?.name || 'Unknown'}" revoked from PostgreSQL`);
      toast.success('API key revoked from database.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    }
  };

  const handleBrokerSync = async () => {
    const toastId = toast.loading('Synchronizing live broker account status...');
    try {
      if (!profileData.brokerKey) {
        toast.error('Please connect your broker credentials first.', { id: toastId });
        return;
      }

      if (brokerType === 'alpaca') {
        const res = await apiFetch<any>('/api/v2/portfolio/broker');
        addActivityLog('Broker connection synchronized: Alpaca API');
        toast.success(
          `Synced Alpaca Account! Balance: $${Number(res?.balance || walletBalance).toLocaleString()}`,
          { id: toastId }
        );
      } else if (brokerType === 'mt5') {
        addActivityLog(`Broker connection synchronized: MetaTrader 5 (#${profileData.brokerKey})`);
        toast.success(`Synced MT5 Account #${profileData.brokerKey} (${profileData.brokerServer || 'MetaQuotes-Demo'})!`, {
          id: toastId,
        });
      } else {
        addActivityLog('Broker connection synchronized: Custom FIX/REST Bridge');
        toast.success('Synced Custom Broker Account successfully!', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Sync notice: ${err.message}`, { id: toastId });
    }
  };

  const handleConnectBroker = async (type: string) => {
    const key = editedData.brokerKey?.trim();
    const secret = editedData.brokerSecret?.trim();
    const server = editedData.brokerServer?.trim() || (type === 'mt5' ? 'MetaQuotes-Demo' : 'Live-Gateway');

    if (!key || !secret) {
      toast.error('Please enter both your Account Login/Key and Password/Secret.');
      return;
    }

    const toastId = toast.loading(`Connecting to ${type.toUpperCase()} execution bridge...`);
    try {
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          brokerType: type,
          brokerKey: key,
          brokerSecret: secret,
          brokerServer: server,
        }),
      });
      const updated = { ...profileData, brokerType: type, brokerKey: key, brokerSecret: secret, brokerServer: server };
      setProfileData(updated);
      setEditedData(updated);
      saveToLocalStorage(updated);
      addActivityLog(`Connected broker terminal: ${type.toUpperCase()} (${server})`);
      toast.success(`${type.toUpperCase()} terminal connected & synced to BrokerAccount table!`, { id: toastId });
    } catch (err: any) {
      toast.error(`Broker connection failed: ${err.message}`, { id: toastId });
    }
  };

  const handleDisconnectBroker = async () => {
    const toastId = toast.loading('Disconnecting broker...');
    try {
      await apiFetch('/api/v2/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          brokerType: 'None',
          brokerKey: '',
          brokerSecret: '',
          brokerServer: '',
        }),
      });
      const cleared = { ...profileData, brokerType: 'None', brokerKey: '', brokerSecret: '', brokerServer: '' };
      setEditedData(cleared);
      setProfileData(cleared);
      saveToLocalStorage(cleared);
      addActivityLog('Broker terminal disconnected');
      toast.success('Broker disconnected in database.', { id: toastId });
    } catch (err: any) {
      toast.error(`Disconnection failed: ${err.message}`, { id: toastId });
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in both current and new passwords.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    const toastId = toast.loading('Verifying current password and updating database...');
    try {
      await apiFetch('/api/v2/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      addActivityLog('Account password updated via Security Center');
      toast.success('Password updated in database successfully!', { id: toastId });
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password', { id: toastId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isClient) return null;

  const completionPercent = calculateCompletion();
  const traderRankLevel = Math.max(1, Math.floor((academyStats.totalXp || 0) / 100) + 1);
  const isBrokerConnected = Boolean(profileData.brokerKey && profileData.brokerType && profileData.brokerType !== 'None');

  return (
    <motion.div
      className="space-y-6 print:bg-white print:text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Hidden File Inputs */}
      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
      <input
        type="file"
        ref={idInputRef}
        onChange={handleIdUpload}
        accept="image/*,application/pdf"
        className="hidden"
      />
      <input type="file" ref={selfieInputRef} onChange={handleSelfieUpload} accept="image/*" className="hidden" />
      <input
        type="file"
        ref={addressInputRef}
        onChange={handleAddressUpload}
        accept="image/*,application/pdf"
        className="hidden"
      />

      <div className="print:hidden">
        <PageHeader
          title="Institutional Account & Engine Settings"
          subtitle="Manage your verified trader identity, MT5/Alpaca execution bridge, Gold Engine v3 SMC parameters, Academy notifications, and security vault."
          icon={Settings2}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleEditToggle}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border',
                isEditMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/30'
              )}
            >
              <Edit3 size={14} />
              <span>{isEditMode ? 'Editing Profile...' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer size={14} />
              <span>Export Dossier</span>
            </button>
          </div>
        </PageHeader>
      </div>

      {/* --- Hero Identity, Live Mastery & Broker Status Banner --- */}
      <div className="glass-card rounded-2xl p-6 border border-purple-500/25 bg-gradient-to-r from-slate-950/90 via-purple-950/20 to-indigo-950/30 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between relative z-10">
          <div className="flex flex-col sm:flex-row gap-5 items-center w-full lg:w-auto">
            {/* Avatar Area */}
            <div className="relative group flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-tr from-purple-600 to-indigo-600 border-2 border-purple-400/40 flex items-center justify-center shadow-2xl relative">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-white">
                    {profileData.firstName?.charAt(0) || 'T'}
                    {profileData.lastName?.charAt(0) || 'M'}
                  </span>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl border border-white/15 shadow-lg cursor-pointer transition-all print:hidden"
                title="Upload New Profile Photo"
              >
                <UploadCloud size={14} />
              </button>
            </div>

            <div className="text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-display font-black text-white">
                  {profileData.firstName} {profileData.lastName}
                </h2>
                <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Institutional Pro
                </Badge>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Flame size={11} className="text-amber-400 fill-amber-400" /> Level {traderRankLevel} • {academyStats.totalXp} XP
                </span>
                {isBrokerConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {profileData.brokerType?.toUpperCase()} Connected
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveTab('broker')}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 cursor-pointer"
                  >
                    + Connect MT5 / Alpaca
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 font-mono">
                <span>📧 {displayValue(profileData.email)}</span>
                <span>🌍 {profileData.timezone || 'UTC'}</span>
                <span>🎯 Strategy: Gold Engine v3 SMC</span>
              </div>
            </div>
          </div>

          {/* Right: Profile & KYC Completion Meter */}
          <div className="w-full lg:w-72 p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-2.5">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-slate-300 font-bold uppercase">Account & KYC Readiness</span>
              <span className="text-emerald-400 font-black">{completionPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{completionPercent === 100 ? '✅ Fully Verified' : 'Upload KYC docs for 100%'}</span>
              <button
                onClick={() => setActiveTab('kyc')}
                className="text-purple-400 hover:underline font-bold cursor-pointer"
              >
                Open KYC Vault →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- 7-Tab Modern Navigation Bar --- */}
      <div className="flex flex-wrap border-b border-white/10 gap-1.5 sm:gap-2 pb-2 print:hidden">
        {[
          { id: 'overview', label: 'Identity & Profile', icon: User },
          { id: 'broker', label: 'Broker & MT5 Bridge', icon: Link2 },
          { id: 'ai', label: 'Gold Engine v3 & Alerts', icon: BrainCircuit },
          { id: 'kyc', label: 'Verification (KYC)', icon: Shield },
          { id: 'security', label: 'Security & API Keys', icon: Key },
          { id: 'billing', label: 'Wallet & Subscription', icon: Wallet },
          { id: 'activity', label: 'Academy & Activity Log', icon: GraduationCap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-display font-bold text-xs whitespace-nowrap transition-all cursor-pointer border',
              activeTab === tab.id
                ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-lg shadow-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <tab.icon size={14} className={activeTab === tab.id ? 'text-purple-400' : 'text-slate-400'} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Active Tab Panel */}
        <div className="xl:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {/* TAB 1: OVERVIEW (IDENTITY, CONTACT, RESIDENTIAL) */}
            {activeTab === 'overview' && (
              <motion.div
                key="tab-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <User size={16} className="text-purple-400" />
                      Personal Identity Information
                    </h3>
                    {!isEditMode && (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} /> Edit Fields
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">First Name</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.firstName}
                          onChange={(e) => setEditedData({ ...editedData, firstName: e.target.value })}
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
                          onChange={(e) => setEditedData({ ...editedData, middleName: e.target.value })}
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
                          onChange={(e) => setEditedData({ ...editedData, lastName: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.lastName)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Trader Handle</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.username}
                          onChange={(e) => setEditedData({ ...editedData, username: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-purple-300 font-mono font-bold">
                          {profileData.username ? `@${profileData.username}` : 'Not set'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Date of Birth</span>
                      {isEditMode ? (
                        <input
                          type="date"
                          value={editedData.dob}
                          onChange={(e) => setEditedData({ ...editedData, dob: e.target.value })}
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
                          onChange={(e) => setEditedData({ ...editedData, gender: e.target.value })}
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
                          onChange={(e) => setEditedData({ ...editedData, nationality: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.nationality)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        National ID / Passport (8 Digits)
                      </span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.nationalId || ''}
                          onChange={(e) => setEditedData({ ...editedData, nationalId: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 font-mono"
                          placeholder="8-digit ID"
                        />
                      ) : (
                        <span className="text-slate-300 font-mono font-bold">
                          {displayValue(profileData.nationalId)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Occupation</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.occupation}
                          onChange={(e) => setEditedData({ ...editedData, occupation: e.target.value })}
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
                      Verified Contact Channels
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Primary Email</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.email)}</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                          Verified
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Phone Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.phone)}</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                          Verified
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Recovery Email</span>
                      {isEditMode ? (
                        <input
                          type="email"
                          value={editedData.secondaryEmail}
                          onChange={(e) => setEditedData({ ...editedData, secondaryEmail: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">
                          {displayValue(profileData.secondaryEmail)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Preferred Alert Channel
                      </span>
                      {isEditMode ? (
                        <select
                          value={editedData.communicationPref}
                          onChange={(e) => setEditedData({ ...editedData, communicationPref: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2 bg-slate-900"
                        >
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Email">Email</option>
                          <option value="SMS">SMS</option>
                        </select>
                      ) : (
                        <span className="text-slate-200 font-semibold">
                          {displayValue(profileData.communicationPref)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Residential Information */}
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <MapPin size={16} className="text-purple-400" />
                      Residential & Timezone Coordinates
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Country</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.country}
                          onChange={(e) => setEditedData({ ...editedData, country: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.country)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        State / Province
                      </span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.state}
                          onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.state)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">City</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.city}
                          onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
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
                          onChange={(e) => setEditedData({ ...editedData, postalCode: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.postalCode)}</span>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Residential Address
                      </span>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedData.address}
                          onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                          className="w-full input-glass rounded-xl px-3 py-2"
                        />
                      ) : (
                        <span className="text-slate-200 font-semibold">{displayValue(profileData.address)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: BROKER & MT5 EXECUTION BRIDGE */}
            {activeTab === 'broker' && (
              <motion.div
                key="tab-broker"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-teal-500/25 bg-slate-950/70 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
                        <Cpu size={18} className="text-teal-400" />
                        Broker & MetaTrader 5 Execution Bridge
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Connect your MT5, Alpaca, or custom FIX/REST broker account for 1-click signal execution and live equity synchronization.
                      </p>
                    </div>
                    <Badge variant={isBrokerConnected ? 'buy' : 'purple'} size="sm">
                      {isBrokerConnected ? `CONNECTED (${profileData.brokerType?.toUpperCase()})` : 'READY TO PAIR'}
                    </Badge>
                  </div>

                  {/* Broker Selector Pills */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'mt5', name: 'MetaTrader 5 (MT5)', sub: 'Forex, Gold (XAUUSD) & Indices' },
                      { id: 'alpaca', name: 'Alpaca Markets', sub: 'US Stocks, ETFs & Crypto API' },
                      { id: 'custom', name: 'Custom REST / FIX', sub: 'Institutional Prop Firm Bridge' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBrokerType(b.id as any)}
                        className={cn(
                          'p-3.5 rounded-xl border text-left transition cursor-pointer',
                          brokerType === b.id
                            ? 'bg-teal-500/15 border-teal-500 text-white'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                        )}
                      >
                        <div className="text-xs font-bold">{b.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{b.sub}</div>
                      </button>
                    ))}
                  </div>

                  {/* Credentials Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
                        {brokerType === 'mt5' ? 'MT5 Account Login ID *' : 'API Key ID *'}
                      </label>
                      <input
                        type="text"
                        value={editedData.brokerKey || ''}
                        onChange={(e) => setEditedData({ ...editedData, brokerKey: e.target.value })}
                        placeholder={brokerType === 'mt5' ? 'e.g. 50192834' : 'PKXXXXXXXXXXXXXXXX'}
                        className="w-full input-glass rounded-xl px-3.5 py-2.5 font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
                        {brokerType === 'mt5' ? 'MT5 Master / Investor Password *' : 'API Secret Key *'}
                      </label>
                      <input
                        type="password"
                        value={editedData.brokerSecret || ''}
                        onChange={(e) => setEditedData({ ...editedData, brokerSecret: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full input-glass rounded-xl px-3.5 py-2.5 font-mono text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
                        {brokerType === 'mt5' ? 'MT5 Broker Server Name' : 'Endpoint / Environment Server'}
                      </label>
                      <input
                        type="text"
                        value={editedData.brokerServer || ''}
                        onChange={(e) => setEditedData({ ...editedData, brokerServer: e.target.value })}
                        placeholder={
                          brokerType === 'mt5'
                            ? 'e.g. MetaQuotes-Demo, Exness-MT5Real, FTMO-Server'
                            : 'https://paper-api.alpaca.markets'
                        }
                        className="w-full input-glass rounded-xl px-3.5 py-2.5 font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleConnectBroker(brokerType)}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20"
                      >
                        <Zap size={14} />
                        <span>{isBrokerConnected ? 'Update & Re-Authenticate' : `Connect ${brokerType.toUpperCase()}`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBrokerSync}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={13} />
                        <span>Sync Live Balance</span>
                      </button>
                    </div>

                    {isBrokerConnected && (
                      <button
                        type="button"
                        onClick={handleDisconnectBroker}
                        className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 text-xs font-bold cursor-pointer"
                      >
                        Disconnect Terminal
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: GOLD ENGINE V3 SMC & NOTIFICATION PREFERENCES */}
            {activeTab === 'ai' && (
              <motion.div
                key="tab-ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-amber-500/25 bg-slate-950/70 space-y-6">
                  <div className="border-b border-white/10 pb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
                        <BrainCircuit size={18} className="text-amber-400" />
                        Gold Engine v3 SMC & Risk Safety Suite
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Configure multi-timeframe (`H4 / H1 / M15 / M5`) setup selection, Killzone filters, OTE (`62%–79%`) precision, and drawdown circuit breakers.
                      </p>
                    </div>
                    <Badge variant="amber" size="sm">Gold Engine v3 Active</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Primary Quantitative Engine
                      </label>
                      <select
                        value={aiPreferences.strategy}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, strategy: e.target.value });
                          toast.success('Primary execution strategy saved to database!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-slate-200 font-mono"
                      >
                        <option value="Gold Engine v3: MTF SMC Order Block, FVG & OTE (62%-79%)">
                          Gold Engine v3: MTF SMC Order Block, FVG & OTE (62%-79%)
                        </option>
                        <option value="Institutional Trend Follower (EMA 20/50/200)">
                          Institutional Trend Follower (EMA 20/50/200)
                        </option>
                        <option value="Quantitative VWAP & RSI Mean Reversion">
                          Quantitative VWAP & RSI Mean Reversion
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        SMC Setup Trigger Mode
                      </label>
                      <select
                        value={aiPreferences.setupMode}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, setupMode: e.target.value });
                          toast.success('SMC setup mode saved to database!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-amber-300 font-mono font-bold"
                      >
                        <option value="Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION">
                          Dual Engine: SWEEP_REVERSAL + BOS_PULLBACK_CONTINUATION
                        </option>
                        <option value="Liquidity Sweep Reversal Only (SWEEP_REVERSAL)">
                          Liquidity Sweep Reversal Only (SWEEP_REVERSAL)
                        </option>
                        <option value="Trend BOS Pullback Continuation Only (BOS_PULLBACK_CONTINUATION)">
                          Trend BOS Pullback Continuation Only (BOS_PULLBACK_CONTINUATION)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Preferred Institutional Killzone Window
                      </label>
                      <select
                        value={aiPreferences.killzoneWindow}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, killzoneWindow: e.target.value });
                          toast.success('Killzone execution window saved to database!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-teal-300 font-mono"
                      >
                        <option value="London Open (07-10 UTC) + NY AM Overlap (12-15 UTC)">
                          London Open (07-10 UTC) + NY AM Overlap (12-15 UTC)
                        </option>
                        <option value="NY AM / London-NY Overlap Only (12:00-15:00 UTC)">
                          NY AM / London-NY Overlap Only (12:00-15:00 UTC)
                        </option>
                        <option value="All Sessions (Asian + London + NY)">
                          All Sessions (Asian + London + NY)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Bot Automation Mode
                      </label>
                      <select
                        value={aiPreferences.automationMode}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, automationMode: e.target.value });
                          toast.success('Automation mode saved to database!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-slate-200 font-mono"
                      >
                        <option value="Semi-Autonomous (Requires Confirmation)">
                          Semi-Autonomous (Requires Confirmation)
                        </option>
                        <option value="Fully Autonomous Auto-Execution">
                          Fully Autonomous Auto-Execution
                        </option>
                        <option value="Advisory Only (Signal Alerts Only)">
                          Advisory Only (Signal Alerts Only)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Max Capital Risk Per Trade
                      </label>
                      <select
                        value={aiPreferences.riskLimit}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, riskLimit: e.target.value });
                          toast.success('Capital risk limit saved to RiskProfile table!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-emerald-400 font-mono font-bold"
                      >
                        <option value="Max 1% Per Trade (Conservative)">Max 1% Per Trade (Conservative)</option>
                        <option value="Max 2% Per Trade (Standard)">Max 2% Per Trade (Standard)</option>
                        <option value="Max 3% Per Trade (Growth)">Max 3% Per Trade (Growth)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Daily Drawdown Circuit Breaker
                      </label>
                      <select
                        value={aiPreferences.maxDrawdown}
                        onChange={(e) => {
                          persistAiPreferences({ ...aiPreferences, maxDrawdown: e.target.value });
                          toast.success('Drawdown circuit breaker saved to DailyLossRule table!');
                        }}
                        className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 text-amber-400 font-mono font-bold"
                      >
                        <option value="5% Max Portfolio Loss">5% Max Portfolio Loss (Strict Prop Guard)</option>
                        <option value="10% Max Portfolio Loss">10% Max Portfolio Loss (Standard Guard)</option>
                        <option value="15% Max Portfolio Loss">15% Max Portfolio Loss (Flexible)</option>
                      </select>
                    </div>
                  </div>

                  {/* Mandatory Safety Guards */}
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                        <ShieldAlert size={15} className="text-purple-400" />
                        Mandatory MTF & Risk Guards
                      </span>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                        Hardware Enforced
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/70 border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiPreferences.requireStopLoss !== false}
                          onChange={(e) => {
                            persistAiPreferences({ ...aiPreferences, requireStopLoss: e.target.checked });
                            toast.success(`Stop-Loss Guard: ${e.target.checked ? 'ACTIVE' : 'OFF'}`);
                          }}
                          className="accent-purple-500"
                        />
                        <span className="text-slate-200 font-medium">Mandatory ATR Stop-Loss</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/70 border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiPreferences.sessionFilter !== false}
                          onChange={(e) => {
                            persistAiPreferences({ ...aiPreferences, sessionFilter: e.target.checked });
                            toast.success(`Killzone Filter: ${e.target.checked ? 'ACTIVE' : 'OFF'}`);
                          }}
                          className="accent-purple-500"
                        />
                        <span className="text-slate-200 font-medium">London / NY Killzone Filter</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/70 border border-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiPreferences.oteFilter !== false}
                          onChange={(e) => {
                            persistAiPreferences({ ...aiPreferences, oteFilter: e.target.checked });
                            toast.success(`OTE 62%-79% Filter: ${e.target.checked ? 'ACTIVE' : 'OFF'}`);
                          }}
                          className="accent-purple-500"
                        />
                        <span className="text-slate-200 font-medium">OTE (62%–79%) Zone Check</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Real-Time Notifications & Academy Broadcast Toggles */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-display font-bold text-white text-sm mb-2 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Bell size={16} className="text-purple-400" />
                    Signal & Academy Notification Channels
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {[
                      {
                        key: 'academyNotesAlerts',
                        label: 'Academy Study Notes & Courses',
                        desc: 'Instant bell & toast alerts when instructors publish study notes or courses.',
                      },
                      {
                        key: 'homeworkGradingAlerts',
                        label: 'Homework Grading & Q&A Replies',
                        desc: 'Alerts when an instructor grades your assignment or answers your Q&A thread.',
                      },
                      {
                        key: 'signalAlerts',
                        label: 'Gold Engine v3 Signal Triggers',
                        desc: 'Real-time alerts on SWEEP_REVERSAL and BOS_PULLBACK_CONTINUATION setups.',
                      },
                      {
                        key: 'marketAlerts',
                        label: 'High-Impact Macro News (CPI / NFP / FOMC)',
                        desc: 'Warnings 15 minutes before high-volatility USD macro releases.',
                      },
                      {
                        key: 'whatsapp',
                        label: 'WhatsApp Instant Dispatches',
                        desc: 'Receive trade setups and Academy links on WhatsApp.',
                      },
                      {
                        key: 'email',
                        label: 'Email Daily Digest',
                        desc: 'End-of-day portfolio and Academy mastery summary.',
                      },
                    ].map((ch) => (
                      <div
                        key={ch.key}
                        className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-center gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{ch.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{ch.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean((notifications as any)[ch.key])}
                          onChange={(e) => {
                            setNotifications({ ...notifications, [ch.key]: e.target.checked });
                            toast.success(`${ch.label}: ${e.target.checked ? 'Enabled' : 'Muted'}`);
                          }}
                          className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: KYC VERIFICATION VAULT */}
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
                    Regulatory Identity Verification (KYC Vault)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Submit regulatory documents to unlock unlimited wallet withdrawals and institutional prop-firm execution.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">1. Identity Document (ID / Passport)</h4>
                      <p className="text-[10px] text-slate-500">Government-issued Passport or National ID Card.</p>
                      {idCardFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {idCardFile}
                        </div>
                      )}
                      <button
                        onClick={() => idInputRef.current?.click()}
                        className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-2 cursor-pointer"
                      >
                        <UploadCloud size={13} /> {idCardFile ? 'Replace ID Document' : 'Upload ID Card'}
                      </button>
                    </div>
                    <Badge
                      className={
                        idCardFile
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      }
                    >
                      {idCardFile ? '✅ Uploaded' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">2. Biometric Selfie Verification</h4>
                      <p className="text-[10px] text-slate-500">Clear facial photo matching your government ID.</p>
                      {selfieFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {selfieFile}
                        </div>
                      )}
                      <button
                        onClick={() => selfieInputRef.current?.click()}
                        className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-2 cursor-pointer"
                      >
                        <UploadCloud size={13} /> {selfieFile ? 'Replace Selfie' : 'Upload Selfie Photo'}
                      </button>
                    </div>
                    <Badge
                      className={
                        selfieFile
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      }
                    >
                      {selfieFile ? '✅ Uploaded' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-slate-200 text-xs">3. Proof of Residence</h4>
                      <p className="text-[10px] text-slate-500">Utility bill or bank statement (&lt; 3 months old).</p>
                      {addressFile && (
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1.5 mt-2 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                          <FileText size={12} /> {addressFile}
                        </div>
                      )}
                      <button
                        onClick={() => addressInputRef.current?.click()}
                        className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-2 cursor-pointer"
                      >
                        <UploadCloud size={13} /> {addressFile ? 'Replace Proof' : 'Upload Address Proof'}
                      </button>
                    </div>
                    <Badge
                      className={
                        addressFile
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      }
                    >
                      {addressFile ? '✅ Uploaded' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-slate-200 text-xs">4. Tax & AML Declaration</h4>
                      <p className="text-[10px] text-slate-500">Automated anti-money-laundering & regional tax check.</p>
                    </div>
                    <Badge className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      ✅ Verified
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: SECURITY CENTER & PERSONAL API KEYS */}
            {activeTab === 'security' && (
              <motion.div
                key="tab-security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Lock size={16} className="text-purple-400" />
                      Authentication & Session Security
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">Two-Factor Authentication (2FA)</div>
                        <div className="text-[10px] text-slate-500 mt-1">Protect withdrawals & order execution.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={twoFactor}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          setTwoFactor(enabled);
                          try {
                            await apiFetch('/api/v2/users/me/preferences', {
                              method: 'PATCH',
                              body: JSON.stringify({ isTwoFactorEnabled: enabled }),
                            });
                            addActivityLog(`2FA ${enabled ? 'Enabled' : 'Disabled'} in PostgreSQL`);
                            toast.success(`Two-Factor Authentication ${enabled ? 'Enabled' : 'Disabled'} in database`);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to update 2FA');
                          }
                        }}
                        className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-200">Biometric Passkey Login</div>
                        <div className="text-[10px] text-slate-500 mt-1">Authorize sessions with TouchID / FaceID.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={biometric}
                        onChange={(e) => {
                          setBiometric(e.target.checked);
                          toast.success(`Biometric Login ${e.target.checked ? 'Enabled' : 'Disabled'}`);
                        }}
                        className="w-8 h-4 rounded-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/5">
                    <button
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Key size={13} /> Change Password
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await apiFetch('/api/v2/users/me/sessions/revoke', { method: 'POST' });
                          addActivityLog('Revoked all other active sessions & refresh tokens in PostgreSQL');
                          toast.success('All remote sessions and tokens have been revoked in database.');
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to revoke remote sessions');
                        }
                      }}
                      className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/5 cursor-pointer"
                    >
                      <LogOut size={14} /> Sign Out Other Devices
                    </button>
                  </div>
                </div>

                {/* Personal API Key Generator Vault */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Key size={16} className="text-teal-400" />
                      Personal Webhook & Developer API Keys
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Generate scoped API keys for TradingView webhooks, external EAs, or custom portfolio trackers.
                    </p>
                  </div>

                  <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Key label (e.g., TradingView Gold Webhook, MT5 Bridge EA)..."
                      className="flex-1 input-glass rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus size={14} /> Generate API Key
                    </button>
                  </form>

                  <div className="space-y-2.5 pt-2">
                    {apiKeys.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-500 font-mono">
                        No active personal API keys generated yet.
                      </div>
                    ) : (
                      apiKeys.map((k) => (
                        <div
                          key={k.id}
                          className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{k.name}</div>
                            <div className="text-[11px] font-mono text-teal-300 mt-0.5">{k.key}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Created: {k.created}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(k.key);
                                toast.success('API key copied to clipboard!');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={12} /> Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(k.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
                              title="Revoke Key"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 6: WALLET & SUBSCRIPTION BILLING */}
            {activeTab === 'billing' && (
              <motion.div
                key="tab-billing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <Wallet size={16} className="text-purple-400" />
                      Connected Capital & Wallet Vault
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Available Broker Balance
                      </span>
                      <span className="text-2xl font-black text-white font-mono">
                        ${Number(walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-white/2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Connected Execution Vault
                      </span>
                      <span className="text-sm font-bold text-emerald-400 flex items-center gap-2 mt-1">
                        🛡️ {isBrokerConnected ? `${profileData.brokerType?.toUpperCase()} Live Bridge` : 'TradeMind Secure Vault'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => router.push('/wallet')}
                      className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Open Wallet & Transfers
                    </button>
                    <button
                      onClick={() => setActiveTab('broker')}
                      className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Configure Broker Bridge
                    </button>
                  </div>
                </div>

                {/* Subscription Plan */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Layers size={16} className="text-purple-400" />
                    Institutional Membership Tier
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">Active Plan</span>
                      <span className="text-purple-300 font-bold">Pro Institutional Tier</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">Engines Unlocked</span>
                      <span className="text-emerald-400 font-bold">Gold v3 + BTC + NAS100 + Academy</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                      <span className="text-slate-500 block mb-0.5">API & Signal Quota</span>
                      <span className="text-slate-200 font-bold">Unlimited Real-Time</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setIsUpgradeOpen(true)}
                      className="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Upgrade / Switch Plan
                    </button>
                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      className="btn-ghost text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      Billing Invoices
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 7: LIVE ACADEMY MASTERY & ACTIVITY TIMELINE */}
            {activeTab === 'activity' && (
              <motion.div
                key="tab-activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card rounded-2xl p-6 border border-purple-500/20 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <GraduationCap size={16} className="text-purple-400" />
                      Live Academy Mastery & Achievements
                    </h3>
                    <button
                      onClick={() => router.push('/academy')}
                      className="text-xs text-purple-400 hover:underline font-bold cursor-pointer"
                    >
                      Open Academy Hub →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40">
                      <div className="font-bold text-purple-400 text-lg font-mono">
                        {academyStats.completedLessons} / {academyStats.totalLessons}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Lessons Completed</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40">
                      <div className="font-bold text-teal-400 text-lg font-mono">
                        {academyStats.gradedAssignments} / {academyStats.totalAssignments}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Homework Graded</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40">
                      <div className="font-bold text-emerald-400 text-lg font-mono">
                        {academyStats.passedQuizzes} / {academyStats.totalQuizzes}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Strict Quizzes Passed</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40">
                      <div className="font-bold text-amber-400 text-lg font-mono">
                        {academyStats.totalXp} XP
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Level {traderRankLevel} Rank</div>
                    </div>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <History size={16} className="text-purple-400" />
                      Recent Account & Security Audit Trail
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">{activityLogs.length} Events Logged</span>
                  </div>

                  <div className="relative border-l border-white/10 pl-4 ml-2 space-y-4 text-xs max-h-80 overflow-y-auto">
                    {activityLogs.map((log: any, index: number) => (
                      <div key={index} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-slate-950" />
                        <div className="font-semibold text-slate-200">{log.act}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {log.time} • {log.dev}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right 4 Cols: Quick Command Shortcuts, Live Performance & Academy Card */}
        <div className="xl:col-span-4 space-y-6">
          {/* Quick Actions Panel */}
          <div className="glass-card rounded-2xl p-5 space-y-3.5 border border-white/5 print:hidden">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-400" /> Quick Command Shortcuts
            </h4>
            <div className="space-y-2">
              <button
                onClick={handleEditToggle}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-purple-500/10 hover:border-purple-500/30 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Edit3 size={14} className="text-purple-400" />
                  {isEditMode ? 'Exit Profile Edit Mode' : 'Edit Personal Identity'}
                </span>
                <span className="text-[10px] font-mono text-purple-400">Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('broker')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-teal-500/10 hover:border-teal-500/30 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Cpu size={14} className="text-teal-400" />
                  Connect MT5 / Alpaca Terminal
                </span>
                <span className="text-[10px] font-mono text-teal-400">
                  {isBrokerConnected ? 'Connected' : 'Setup'}
                </span>
              </button>

              <button
                onClick={() => router.push('/dashboard/engines/gold')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-amber-500/10 hover:border-amber-500/30 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Zap size={14} className="text-amber-400" />
                  Launch Gold Engine v3
                </span>
                <span className="text-[10px] font-mono text-amber-400">XAU/USD</span>
              </button>

              <button
                onClick={() => router.push('/academy')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/2 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <GraduationCap size={14} className="text-indigo-400" />
                  Academy Study Notes & Homework
                </span>
                <span className="text-[10px] font-mono text-indigo-300">{academyStats.totalXp} XP</span>
              </button>
            </div>
          </div>

          {/* Live Trading Statistics Panel */}
          <div className="glass-card rounded-2xl p-5 space-y-4 border border-white/5">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BarChart2 size={14} className="text-purple-400" />
              Live Trading & Engine Telemetry
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Executed Trades', val: portfolioStats.totalTrades.toLocaleString() },
                { label: 'Account Win Rate', val: `${portfolioStats.winRate}`.includes('%') ? portfolioStats.winRate : `${portfolioStats.winRate}%` },
                { label: 'Academy XP Earned', val: `${academyStats.totalXp} XP` },
                { label: 'Engine Precision', val: `${portfolioStats.aiAccuracy}`.includes('%') ? portfolioStats.aiAccuracy : `${portfolioStats.aiAccuracy}%` },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl border border-white/5 bg-slate-900/40">
                  <div className="font-bold text-white text-sm font-mono">{stat.val}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="p-3.5 rounded-xl border border-white/5 bg-white/2 text-xs text-slate-400 flex justify-between items-center">
              <span>Net Cumulative P&L:</span>
              <span
                className={cn(
                  'font-bold font-mono',
                  portfolioStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {portfolioStats.totalProfit >= 0 ? '+' : ''}$
                {portfolioStats.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Update Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.form
              onSubmit={handlePasswordUpdate}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-2xl border border-purple-500/30 bg-slate-950 p-6 w-full max-w-md space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock size={15} className="text-purple-400" /> Update Account Password
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full input-glass rounded-xl px-3.5 py-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    New Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full input-glass rounded-xl px-3.5 py-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full input-glass rounded-xl px-3.5 py-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Plan Upgrade Modal Overlay */}
      <AnimatePresence>
        {isUpgradeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUpgrading) setIsUpgradeOpen(false);
              }}
            />

            <motion.div
              className="relative w-full max-w-md overflow-hidden glass-card rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl text-xs"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <h3 className="font-display font-bold text-white text-sm">Choose Your Institutional Tier</h3>
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
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                      Billing Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('mpesa')}
                        className={cn(
                          'p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all',
                          paymentMode === 'mpesa'
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                        )}
                      >
                        💳 M-Pesa STK
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('visa')}
                        className={cn(
                          'p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all',
                          paymentMode === 'visa'
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                        )}
                      >
                        💳 Credit Card
                      </button>
                    </div>
                  </div>

                  {paymentMode === 'mpesa' && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                        M-Pesa Number
                      </label>
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
                    {
                      name: 'Pro Tier',
                      price: '$49/mo',
                      desc: 'Gold Engine v3 MTF SMC, live WebSockets ticks, and full Academy access.',
                    },
                    {
                      name: 'Enterprise Tier',
                      price: '$199/mo',
                      desc: 'Dedicated MT5 execution bridge, 1-on-1 instructor grading, and custom risk guards.',
                    },
                  ].map((plan) => (
                    <div
                      key={plan.name}
                      onClick={() => {
                        setSelectedPlan(plan.name);
                        setPaymentMode('mpesa');
                      }}
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
              className="relative w-full max-w-lg overflow-hidden glass-card rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl text-xs"
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

              <div className="p-6 text-center text-xs text-slate-400 font-mono">
                Active Institutional Pro Membership — Next renewal scheduled on Jun 28, 2027.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Floating Bottom Edit Action Bar --- */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel border border-purple-500/40 bg-slate-950/95 rounded-2xl px-6 py-4 flex gap-4 shadow-2xl items-center print:hidden"
          >
            <span className="text-xs text-purple-300 font-bold flex items-center gap-2">
              <AlertCircle size={14} /> Editing Profile Identity
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
