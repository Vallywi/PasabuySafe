'use client';

import { create } from 'zustand';
import { ensureProfileWalletLinked } from '@/lib/supabase/ensureProfileWallet';

interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Zustand store for Freighter wallet state.
 * Manages connection, public key, and status.
 *
 * On successful connection, automatically links the stellar_address to the
 * user's Supabase profile (if authenticated). This ensures the strict RLS
 * policies on participants SELECT/UPDATE work correctly.
 */
export const useWallet = create<WalletState>((set) => ({
  publicKey: null,
  isConnected: false,
  isConnecting: false,

  connect: async () => {
    set({ isConnecting: true });
    try {
      // Dynamic import to avoid SSR issues
      const freighterApi = await import('@stellar/freighter-api');

      // Check if Freighter is installed
      const isConnected = await freighterApi.isConnected();
      if (!isConnected) {
        window.open('https://www.freighter.app/', '_blank');
        set({ isConnecting: false });
        return;
      }

      // Request access
      const addressObj = await freighterApi.requestAccess();
      if (addressObj.error) {
        console.error('Freighter access denied:', addressObj.error);
        set({ isConnecting: false });
        return;
      }

      set({
        publicKey: addressObj.address,
        isConnected: true,
        isConnecting: false,
      });

      // Best-effort: link the wallet address to the user's Supabase profile
      // so RLS policies that check profiles.stellar_address will pass for
      // subsequent SELECT/UPDATE operations on participants.
      ensureProfileWalletLinked(addressObj.address).catch(() => {
        // Non-critical — migration 006 makes INSERT permissive for authed users.
        // The link is needed for SELECT/UPDATE but we don't block the flow.
      });
    } catch (error) {
      console.error('Wallet connection failed:', error);
      set({ isConnecting: false });
    }
  },

  disconnect: () => {
    set({ publicKey: null, isConnected: false });
  },
}));
