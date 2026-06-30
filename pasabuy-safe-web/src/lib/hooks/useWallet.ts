'use client';

import { create } from 'zustand';

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
    } catch (error) {
      console.error('Wallet connection failed:', error);
      set({ isConnecting: false });
    }
  },

  disconnect: () => {
    set({ publicKey: null, isConnected: false });
  },
}));
