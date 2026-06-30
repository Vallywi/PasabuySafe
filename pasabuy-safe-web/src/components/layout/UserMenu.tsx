'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, UserCircle, Settings, ClipboardList, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWallet } from '@/lib/hooks/useWallet';

interface UserData {
  email: string;
  avatar_url: string | null;
  display_name: string | null;
  full_name: string | null;
}

export function UserMenu() {
  const router = useRouter();
  const { disconnect } = useWallet();
  const [user, setUser] = useState<UserData | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load user
  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, display_name, full_name')
        .eq('id', authUser.id)
        .single();
      setUser({
        email: authUser.email || '',
        avatar_url: profile?.avatar_url || null,
        display_name: profile?.display_name || null,
        full_name: profile?.full_name || null,
      });
    }
    load();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
      else if (event === 'SIGNED_IN') load();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    disconnect();          // disconnect wallet locally
    await supabase.auth.signOut();
    router.push('/');
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="text-sm text-slate-700 hover:text-yellow-700 font-medium px-3 py-2 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const displayName = user.display_name || user.full_name || user.email.split('@')[0];
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 transition-colors group"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover border-2 border-yellow-300"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm border-2 border-yellow-300">
            {initial}
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-50"
          >
            {/* User info */}
            <div className="px-4 py-3 bg-gradient-to-br from-yellow-50 to-amber-50 border-b border-yellow-100">
              <p className="font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-yellow-50 hover:text-yellow-800 transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                Edit Profile
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-yellow-50 hover:text-yellow-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/dashboard/orders"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-yellow-50 hover:text-yellow-800 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                My Orders
              </Link>
              <Link
                href="/dashboard/organizer/create"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-yellow-50 hover:text-yellow-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Pasabuy
              </Link>
            </div>

            {/* Sign out */}
            <div className="py-2 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
