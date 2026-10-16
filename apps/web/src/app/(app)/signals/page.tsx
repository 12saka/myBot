'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignalsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/engines/gold');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
      <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      <p className="text-xs font-semibold text-slate-400">Opening MasterGold Engine...</p>
    </div>
  );
}
