// app/store/slices/authSlice.js
import { locales } from "../../lib/locales";

export const createAuthSlice = (set, get) => ({
  user: null,

  loginWithTestId: (userId) => {
    if (!userId || !userId.trim()) {
      console.error("Test User ID cannot be empty.");
      return;
    }
    const mockUser = {
      uid: userId.trim(),
      displayName: `Test User (${userId.trim()})`,
      email: `${userId.trim()}@test.com`,
      photoURL: "/images/avatar.png",
      isTestUser: true,
    };
    
    if (typeof window !== "undefined") {
      localStorage.setItem("testUser", JSON.stringify(mockUser));
      console.log(`[AuthSlice] Test user saved to localStorage: ${userId}`);
    }
    
    get().setUserAndLoadData(mockUser);
  },

  logout: async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("testUser");
        console.log("[AuthSlice] Test user removed from localStorage");
      }
      
      // 테스트 유저만 사용 - 항상 clearUserAndData 실행
      get().clearUserAndData();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  setUserAndLoadData: async (user) => {
    set({ user, isInitializing: true });

    // 1. 개인 설정 로드 (Await)
    let fontSize = "default",
      language = "ko",
      contentTruncateLimit = 10,
      hideCompletedScenarios = false,
      hideDelayInHours = 0,
      fontSizeDefault = "16px",
      isDevMode = false,
      sendTextShortcutImmediately = false;

    try {
      // localStorage에서 사용자 설정 로드
      const userSettings = JSON.parse(localStorage.getItem("userSettings") || "{}");

      fontSize = userSettings.fontSize || localStorage.getItem("fontSize") || fontSize;
      language = userSettings.language || localStorage.getItem("language") || language;
      contentTruncateLimit =
        typeof userSettings.contentTruncateLimit === "number"
          ? userSettings.contentTruncateLimit
          : contentTruncateLimit;
      hideCompletedScenarios =
        typeof userSettings.hideCompletedScenarios === "boolean"
          ? userSettings.hideCompletedScenarios
          : hideCompletedScenarios;
      hideDelayInHours =
        typeof userSettings.hideDelayInHours === "number"
          ? userSettings.hideDelayInHours
          : hideDelayInHours;
      fontSizeDefault = userSettings.fontSizeDefault || fontSizeDefault;
      isDevMode =
        typeof userSettings.isDevMode === "boolean" ? userSettings.isDevMode : isDevMode;
      
      sendTextShortcutImmediately =
        typeof userSettings.sendTextShortcutImmediately === "boolean"
          ? userSettings.sendTextShortcutImmediately
          : sendTextShortcutImmediately;
      
    } catch (error) {
      console.error("Error loading settings from localStorage:", error);
      fontSize = localStorage.getItem("fontSize") || fontSize;
      language = localStorage.getItem("language") || language;
    } finally {
      set({
        theme: "light",
        fontSize,
        language,
        contentTruncateLimit,
        hideCompletedScenarios,
        hideDelayInHours,
        fontSizeDefault,
        isDevMode,
        sendTextShortcutImmediately,
      });
      get().resetMessages?.(language);
    }
    // 2. 리스너 구독 시작 (No Await)
    get().unsubscribeAll();
    get().loadConversations(user.uid);
    get().subscribeToUnreadStatus(user.uid);
    get().subscribeToUnreadScenarioNotifications(user.uid);

    // 2초 타이머 (Await)
    console.log("Starting 2-second splash screen timer...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log("Timer finished. Hiding splash screen.");

    // 3. 초기화 완료
    set({ isInitializing: false });
  },

  clearUserAndData: () => {
    get().unsubscribeAll();

    let fontSize = "default",
      language = "ko";
    if (typeof window !== "undefined") {
      fontSize = localStorage.getItem("fontSize") || "default";
      language = localStorage.getItem("language") || "ko";
    }

    set({
      user: null,
      theme: "light",
      fontSize,
      language,
      contentTruncateLimit: 10,
      hideCompletedScenarios: false,
      hideDelayInHours: 0,
      fontSizeDefault: "16px",
      isDevMode: false,
      sendTextShortcutImmediately: false,
      conversations: [],
      currentConversationId: null,
      expandedConversationId: null,
      scenariosForConversation: {},
      toastHistory: [],
      hasUnreadNotifications: false,
      unreadScenarioSessions: new Set(),
      unreadConversations: new Set(),
      scenarioStates: {},
      activeScenarioSessionId: null,
      activeScenarioSessions: [],
      lastFocusedScenarioSessionId: null,
      isSearching: false,
      searchResults: [],
      isLoading: false,
      slots: {},
      extractedSlots: {},
      llmRawResponse: null,
      selectedOptions: {},
      lastVisibleMessage: null,
      hasMoreMessages: true,
      isProfileModalOpen: false,
      isScenarioModalOpen: false,
      isNotificationModalOpen: false,
      isManualModalOpen: false,
      confirmModal: {
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: () => {},
        confirmVariant: "default",
      },
      isInitializing: false, 
      activePanel: "main",
    });
    get().resetMessages?.(language);
  },
});