'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstructorSidebar } from '@/components/instructor/InstructorSidebar';
import { InstructorTopbar } from '@/components/instructor/InstructorTopbar';
import { apiFetch } from '@/lib/api';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('trademind_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const profile = localStorage.getItem('trademind_profile');
      let role = '';

      if (profile) {
        try {
          const parsed = JSON.parse(profile);
          role = parsed.role || parsed.profileData?.role;
        } catch (e) {}
      }

      if (role === 'INSTRUCTOR' || role === 'SUPER_ADMIN' || role === 'ADMIN') {
        setAuthorized(true);
        return;
      }

      try {
        const user = await apiFetch<any>('/api/v2/users/me');
        if (user && ['INSTRUCTOR', 'SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
          setAuthorized(true);
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (!authorized) {
    return (
      <div className="h-dvh w-full bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400">Verifying Instructor Authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex overflow-hidden">
      <InstructorSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-dvh min-h-0 overflow-hidden">
        <InstructorTopbar onOpenMobile={() => setMobileMenuOpen(true)} />
        <main className="p-4 md:p-6 flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-12">{children}</main>
      </div>
    </div>
  );
}
