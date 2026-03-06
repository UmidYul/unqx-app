import { create } from 'zustand';

import { NFCTag, NFCState, ScreenTab, ThemeMode } from '@/types';

interface NfcStoreState {
  activeTab: ScreenTab;
  theme: ThemeMode;
  autoTheme: boolean;
  nfcState: NFCState;
  unreadNotifications: number;
  currentTag: NFCTag | null;
  isNotificationsOpen: boolean;
  setActiveTab: (tab: ScreenTab) => void;
  setTheme: (theme: ThemeMode) => void;
  setAutoTheme: (enabled: boolean) => void;
  setNfcState: (state: NFCState) => void;
  setUnreadNotifications: (count: number) => void;
  setCurrentTag: (tag: NFCTag | null) => void;
  setNotificationsOpen: (open: boolean) => void;
}

export const useNfcStore = create<NfcStoreState>((set) => ({
  activeTab: 'home',
  theme: 'light',
  autoTheme: false,
  nfcState: 'idle',
  unreadNotifications: 0,
  currentTag: null,
  isNotificationsOpen: false,
  setActiveTab: (activeTab) => set((state) => (state.activeTab === activeTab ? state : { activeTab })),
  setTheme: (theme) => set((state) => (state.theme === theme ? state : { theme })),
  setAutoTheme: (autoTheme) => set((state) => (state.autoTheme === autoTheme ? state : { autoTheme })),
  setNfcState: (nfcState) => set((state) => (state.nfcState === nfcState ? state : { nfcState })),
  setUnreadNotifications: (unreadNotifications) =>
    set((state) => (state.unreadNotifications === unreadNotifications ? state : { unreadNotifications })),
  setCurrentTag: (currentTag) => set((state) => (state.currentTag === currentTag ? state : { currentTag })),
  setNotificationsOpen: (isNotificationsOpen) =>
    set((state) => (state.isNotificationsOpen === isNotificationsOpen ? state : { isNotificationsOpen })),
}));
