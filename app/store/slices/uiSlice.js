import { doc, setDoc } from 'firebase/firestore';
import { locales } from '../../lib/locales';

const getInitialMessages = (lang = 'ko') => {
  return [{ id: 'initial', sender: 'bot', text: locales[lang].initialBotMessage }];
};

export const createUISlice = (set, get) => ({
  // State
  theme: 'light',
  fontSize: 'default',
  language: 'ko',
  isProfileModalOpen: false,
  isSearchModalOpen: false,
  isScenarioModalOpen: false,
  isDevBoardModalOpen: false,
  isNotificationModalOpen: false,
  isManualModalOpen: false,
  isHistoryPanelOpen: false,
  activePanel: 'main',
  focusRequest: 0,
  shortcutMenuOpen: null, // --- 👈 [추가] 숏컷 메뉴 상태
  ephemeralToast: {
    visible: false,
    message: '',
    type: 'info',
  },

  // Actions
  setShortcutMenuOpen: (menuName) => set({ shortcutMenuOpen: menuName }), // --- 👈 [추가] 숏컷 메뉴 제어 함수

  showEphemeralToast: (message, type = 'info') => {
    set({ ephemeralToast: { visible: true, message, type } });
    setTimeout(() => {
      set(state => ({ ephemeralToast: { ...state.ephemeralToast, visible: false } }));
    }, 3000);
  },
  hideEphemeralToast: () => {
     set(state => ({ ephemeralToast: { ...state.ephemeralToast, visible: false } }));
  },
  
  toggleTheme: async () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
    const user = get().user;
    if (user) {
      try {
        const userSettingsRef = doc(get().db, 'settings', user.uid);
        await setDoc(userSettingsRef, { theme: newTheme }, { merge: true });
      } catch (error) {
        console.error("Error saving theme to Firestore:", error);
      }
    }
  },

  setFontSize: async (size) => {
    set({ fontSize: size });
    if (typeof window !== 'undefined') {
      localStorage.setItem('fontSize', size);
    }
    const user = get().user;
    if (user) {
      try {
        const userSettingsRef = doc(get().db, 'settings', user.uid);
        await setDoc(userSettingsRef, { fontSize: size }, { merge: true });
      } catch (error) {
        console.error("Error saving font size to Firestore:", error);
      }
    }
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
    const user = get().user;
    if (user) {
      try {
        const userSettingsRef = doc(get().db, 'settings', user.uid);
        await setDoc(userSettingsRef, { language: lang }, { merge: true });
      } catch (error) {
        console.error("Error saving language to Firestore:", error);
      }
    }
    const { currentConversationId, messages } = get();
    if (!currentConversationId || messages.length <= 1) {
      set({ messages: getInitialMessages(lang) });
    }
  },

  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  openSearchModal: () => set({ isSearchModalOpen: true, searchResults: [], isSearching: false }),
  closeSearchModal: () => set({ isSearchModalOpen: false }),
  openScenarioModal: () => set({ isScenarioModalOpen: true }),
  closeScenarioModal: () => set({ isScenarioModalOpen: false }),
  openDevBoardModal: () => set({ isDevBoardModalOpen: true }),
  closeDevBoardModal: () => set({ isDevBoardModalOpen: false }),
  openNotificationModal: () => set({ isNotificationModalOpen: true }),
  closeNotificationModal: () => set({ isNotificationModalOpen: false }),
  openManualModal: () => set({ isManualModalOpen: true }),
  closeManualModal: () => set({ isManualModalOpen: false }),

  toggleHistoryPanel: () => set(state => ({ isHistoryPanelOpen: !state.isHistoryPanelOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  focusChatInput: () => set(state => ({ focusRequest: state.focusRequest + 1 })),
});