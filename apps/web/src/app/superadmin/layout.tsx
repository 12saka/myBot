'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('trademind_token');
    const profile = localStorage.getItem('trademind_profile');

    if (!token) {
      router.push('/login');
      return;
    }

    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        const role = parsed.role || parsed.profileData?.role;
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
          setAuthorized(true);
        } else {
          router.push('/dashboard');
        }
      } catch (e) {
        setAuthorized(true);
      }
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="h-dvh w-full bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400">Verifying Superadmin Authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex overflow-hidden">
      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-dvh min-h-0 overflow-hidden">
        <AdminTopbar onOpenMobile={() => setMobileMenuOpen(true)} />
        <main className="p-4 md:p-6 flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-12">{children}</main>
      </div>
    </div>
  );
}
