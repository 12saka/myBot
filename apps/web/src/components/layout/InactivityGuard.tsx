'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'react-hot-toast';

// 15 minutes of inactivity timeout in milliseconds
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// Warning notice 60 seconds before logout
const WARNING_BEFORE_TIMEOUT_MS = 60 * 1000;

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    try {
      localStorage.removeItem('trademind_token');
      localStorage.removeItem('trademind_profile');
      sessionStorage.clear();
    } catch (e) {}

    toast.error('Session expired due to inactivity. Please log in again to continue.', {
      id: 'inactivity-logout-toast',
      duration: 5000,
      icon: '🔒',
    });

    router.push('/login?reason=inactivity');
  }, [router]);

  useEffect(() => {
    // Check if token exists; if not, do not track inactivity
    const token = typeof window !== 'undefined' ? localStorage.getItem('trademind_token') : null;
    if (!token) return;

    // Events to monitor user presence
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
      'click',
    ];

    // Throttled event handler to avoid excessive re-executions
    let throttleTimeout: NodeJS.Timeout | null = null;
    const onUserActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          resetActivity();
        }, 1000);
      }
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Background interval checking idle time every 2 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        handleLogout();
      } else if (elapsed >= INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS) {
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSecondsRemaining(remaining);
        setShowWarning(true);
      } else {
        if (showWarning) setShowWarning(false);
      }
    }, 2000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(interval);
    };
  }, [resetActivity, handleLogout, showWarning, pathname]);

  return (
    <>
      {children}

      {/* Floating Inactivity Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-card max-w-sm w-full p-6 rounded-2xl border border-amber-500/40 bg-slate-900/95 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 text-2xl font-bold">
              ⏱️
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-base">Inactivity Security Warning</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                You have been inactive. To protect your trading account, your session will automatically terminate in:
              </p>
              <div className="mt-3 font-mono text-2xl font-black text-amber-400 tracking-wider">
                {secondsRemaining}s
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleLogout}
                className="w-1/2 py-2 px-3 rounded-xl text-xs font-semibold border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Log Out Now
              </button>
              <button
                onClick={resetActivity}
                className="w-1/2 btn-primary py-2 px-3 rounded-xl text-xs font-bold shadow-lg shadow-purple-500/25 cursor-pointer"
              >
                Keep Working
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
