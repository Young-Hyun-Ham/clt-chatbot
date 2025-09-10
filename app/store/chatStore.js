import { create } from 'zustand';
import { auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, serverTimestamp, deleteDoc, doc, getDoc, setDoc, updateDoc } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { scenarioTriggers } from '../lib/chatbotEngine';

// --- 👇 [추가된 부분] ---
const initialMessages = {
  ko: { id: 'initial', sender: 'bot', text: '안녕하세요! 무엇을 도와드릴까요?' },
  en: { id: 'initial', sender: 'bot', text: 'Hello! How can I help you?' },
};
// --- 👆 [여기까지] ---

const initialState = {
  messages: [initialMessages.ko], // --- 👈 [수정]
  slots: {},
  isLoading: false,
  user: null,
  conversations: [],
  currentConversationId: null,
  unsubscribeMessages: null,
  unsubscribeConversations: null,
  
  scenarioStates: {},
  activeScenarioId: null,
  isScenarioPanelOpen: false,

  activePanel: 'main', 
  focusRequest: 0,
  isHistoryPanelOpen: false, 
  theme: 'light',
  isScenarioModalOpen: false,
  isSearchModalOpen: false,
  scenarioTriggers: {},
  isSearching: false,
  searchResults: [],
  fontSize: 'default',
  isProfileModalOpen: false,

  isDevBoardModalOpen: false,
  devMemos: [],
  unsubscribeDevMemos: null,
  
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  toastHistory: [],
  isNotificationModalOpen: false,
  unsubscribeNotifications: null,
  language: 'ko',
};

export const useChatStore = create((set, get) => {
  const responseHandlers = {
    'scenario_start': (data) => {
      get().addMessage('bot', data.nextNode);
      set({ scenarioState: data.scenarioState });
    },
    'scenario': (data) => {
      responseHandlers.scenario_start(data);
    },
    'scenario_end': (data) => {
      get().addMessage('bot', { text: data.message });
      set({ scenarioState: null });
    },
    'scenario_list': (data) => {
      get().addMessage('bot', { text: data.message, scenarios: data.scenarios });
      set({ scenarioState: data.scenarioState });
    },
    'canvas_trigger': (data) => {
      get().addMessage('bot', { text: `'${data.scenarioId}' 시나리오를 시작합니다.`});
      get().openScenarioPanel(data.scenarioId);
    },
    'toast': (data) => {
      get().showToast(data.message, data.toastType);
    },
  };

  return {
    ...initialState,

    setLanguage: async (lang) => {
        set({ language: lang });
        if (typeof window !== 'undefined') {
            localStorage.setItem('language', lang);
        }
        const user = get().user;
        if (user) {
            try {
                const userSettingsRef = doc(db, 'settings', user.uid);
                await setDoc(userSettingsRef, { language: lang }, { merge: true });
            } catch (error) {
                console.error("Error saving language to Firestore:", error);
            }
        }
        // --- 👇 [추가] 언어 변경 시, 현재 대화가 없는 경우 초기 메시지 업데이트 ---
        const { currentConversationId } = get();
        if (!currentConversationId) {
            set({ messages: [initialMessages[lang]] });
        }
    },

    showToast: (message, type = 'info') => {
      const newToast = { id: Date.now(), message, type, createdAt: serverTimestamp() };
      
      set(state => ({
        toast: { ...newToast, visible: true },
        toastHistory: [
            {...newToast, id: newToast.id.toString(), createdAt: { toDate: () => new Date(newToast.id) } }, 
            ...state.toastHistory
        ].sort((a, b) => b.id - a.id)
      }));
      
      get().saveNotification(newToast); 

      setTimeout(() => get().hideToast(), 3000);
    },
    hideToast: () => set(state => ({ toast: { ...state.toast, visible: false } })),
    
    saveNotification: async (toastData) => {
        const user = get().user;
        if (!user) return;
        try {
            const notificationsCollection = collection(db, "users", user.uid, "notifications");
            const { visible, ...dataToSave } = toastData;
            await addDoc(notificationsCollection, dataToSave);
        } catch (error) {
            console.error("Error saving notification:", error);
        }
    },

    loadNotifications: (userId) => {
        const q = query(collection(db, "users", userId, "notifications"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            set({ toastHistory: notifications });
        });
        set({ unsubscribeNotifications: unsubscribe });
    },

    openNotificationModal: () => set({ isNotificationModalOpen: true }),
    closeNotificationModal: () => set({ isNotificationModalOpen: false }),

    handleEvents: (events) => {
      if (!events || !Array.isArray(events)) return;
      const { showToast } = get();
      events.forEach(event => {
        if (event.type === 'toast') {
          showToast(event.message, event.toastType);
        }
      });
    },

    openSearchModal: () => set({ isSearchModalOpen: true, searchResults: [], isSearching: false }),
    closeSearchModal: () => set({ isSearchModalOpen: false }),

    searchConversations: async (searchQuery) => {
        if (!searchQuery.trim()) {
            set({ searchResults: [], isSearching: false });
            return;
        }
        set({ isSearching: true, searchResults: [] });

        const user = get().user;
        const conversations = get().conversations;
        if (!user || !conversations) {
            set({ isSearching: false });
            return;
        }

        const results = [];
        const lowerCaseQuery = searchQuery.toLowerCase();

        for (const convo of conversations) {
            const messagesCollection = collection(db, "chats", user.uid, "conversations", convo.id, "messages");
            const messagesSnapshot = await getDocs(messagesCollection);
            
            let foundInConvo = false;
            const matchingMessages = [];

            messagesSnapshot.forEach(doc => {
                const message = doc.data();
                const content = message.text || message.node?.data?.content || '';
                if (content.toLowerCase().includes(lowerCaseQuery)) {
                    foundInConvo = true;
                    const snippetIndex = content.toLowerCase().indexOf(lowerCaseQuery);
                    const start = Math.max(0, snippetIndex - 20);
                    const end = Math.min(content.length, snippetIndex + 20);
                    const snippet = `...${content.substring(start, end)}...`;
                    matchingMessages.push(snippet);
                }
            });

            if (foundInConvo) {
                results.push({
                    id: convo.id,
                    title: convo.title || 'Untitled Conversation',
                    snippets: matchingMessages.slice(0, 3)
                });
            }
        }
        
        set({ searchResults: results, isSearching: false });
    },

    openDevBoardModal: () => set({ isDevBoardModalOpen: true }),
    closeDevBoardModal: () => set({ isDevBoardModalOpen: false }),

    loadDevMemos: (userId) => {
        const q = query(collection(db, "dev-board"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const memos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            set({ devMemos: memos });
        });
        set({ unsubscribeDevMemos: unsubscribe });
    },

    addDevMemo: async (text) => {
        const user = get().user;
        if (!user) return;
        await addDoc(collection(db, "dev-board"), {
            text,
            authorName: user.displayName,
            authorUid: user.uid,
            createdAt: serverTimestamp(),
        });
    },

    deleteDevMemo: async (memoId) => {
        const memoRef = doc(db, "dev-board", memoId);
        await deleteDoc(memoRef);
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
                const userSettingsRef = doc(db, 'settings', user.uid);
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
                const userSettingsRef = doc(db, 'settings', user.uid);
                await setDoc(userSettingsRef, { fontSize: size }, { merge: true });
            } catch (error) {
                console.error("Error saving font size to Firestore:", error);
            }
        }
    },

    openProfileModal: () => set({ isProfileModalOpen: true }),
    closeProfileModal: () => set({ isProfileModalOpen: false }),

    openScenarioModal: () => set({ isScenarioModalOpen: true }),
    closeScenarioModal: () => set({ isScenarioModalOpen: false }),
    loadScenarioTriggers: () => {
        set({ scenarioTriggers });
    },
    
    toggleHistoryPanel: () => set(state => ({ isHistoryPanelOpen: !state.isHistoryPanelOpen })),

    focusChatInput: () => set(state => ({ focusRequest: state.focusRequest + 1 })),
    setActivePanel: (panel) => set({ activePanel: panel }),

    initAuth: () => {
      get().loadScenarioTriggers();
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userSettingsRef = doc(db, 'settings', user.uid);
            const docSnap = await getDoc(userSettingsRef);
            const settings = docSnap.exists() ? docSnap.data() : {};
            
            const theme = settings.theme || localStorage.getItem('theme') || 'light';
            const fontSize = settings.fontSize || localStorage.getItem('fontSize') || 'default';
            const language = settings.language || localStorage.getItem('language') || 'ko';
            
            // --- 👇 [수정] settings 로드 시 초기 메시지도 함께 설정 ---
            set({ theme, fontSize, language, messages: [initialMessages[language]] });

          } catch (error) {
            console.error("Error loading settings from Firestore:", error);
            const theme = localStorage.getItem('theme') || 'light';
            const fontSize = localStorage.getItem('fontSize') || 'default';
            const language = localStorage.getItem('language') || 'ko';
            set({ theme, fontSize, language, messages: [initialMessages[language]] });
          }
          set({ user });
          get().unsubscribeAll();
          get().loadConversations(user.uid);
          get().loadDevMemos(user.uid);
          get().loadNotifications(user.uid);
        } else {
          // --- 👇 [수정] 로그아웃 시에도 언어에 맞는 초기 메시지 설정 ---
          get().unsubscribeAll();
          const currentTriggers = get().scenarioTriggers;
          
          let theme = 'light';
          let fontSize = 'default';
          let language = 'ko';

          if (typeof window !== 'undefined') {
             theme = localStorage.getItem('theme') || 'light';
             fontSize = localStorage.getItem('fontSize') || 'default';
             language = localStorage.getItem('language') || 'ko';
          }
          
          set({ 
            ...initialState,
            messages: [initialMessages[language]],
            scenarioTriggers: currentTriggers,
            theme,
            fontSize,
            language,
          });
        }
      });
    },

    login: async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (error) {
        console.error("Login failed:", error);
      }
    },
    logout: async () => {
      await signOut(auth);
    },
    unsubscribeAll: () => {
      get().unsubscribeConversations?.();
      get().unsubscribeMessages?.();
      get().unsubscribeDevMemos?.();
      get().unsubscribeNotifications?.();
      set({ 
          unsubscribeConversations: null, 
          unsubscribeMessages: null, 
          unsubscribeDevMemos: null,
          unsubscribeNotifications: null 
      });
    },
    loadConversations: (userId) => {
      const q = query(collection(db, "chats", userId, "conversations"), orderBy("updatedAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        set({ conversations });
      });
      set({ unsubscribeConversations: unsubscribe });
    },
    loadConversation: (conversationId) => {
      const user = get().user;
      if (!user || get().currentConversationId === conversationId) return;
      get().unsubscribeMessages?.();
      // --- 👇 [수정] 대화 로드 시, 초기 메시지를 현재 언어에 맞게 설정 ---
      const { language } = get();
      set({ currentConversationId: conversationId, isLoading: true, messages: [initialMessages[language]], scenarioStates: {}, activeScenarioId: null, isScenarioPanelOpen: false });
      const q = query(collection(db, "chats", user.uid, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // --- 👇 [수정] 불러온 메시지를 초기 메시지 뒤에 추가 ---
        set({ messages: [initialMessages[language], ...messages], isLoading: false });
      });
      set({ unsubscribeMessages: unsubscribe });
    },
    createNewConversation: () => {
      if (get().currentConversationId === null) return;
      get().unsubscribeMessages?.();
      // --- 👇 [수정] 새 대화 시작 시, 현재 언어에 맞는 초기 메시지로 설정 ---
      const { language } = get();
      set({ messages: [initialMessages[language]], currentConversationId: null, scenarioStates: {}, activeScenarioId: null, isScenarioPanelOpen: false });
    },
    deleteConversation: async (conversationId) => {
      const user = get().user;
      if (!user) return;
      const conversationRef = doc(db, "chats", user.uid, "conversations", conversationId);
      const messagesQuery = query(collection(conversationRef, "messages"));
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.forEach(async (messageDoc) => {
        await deleteDoc(messageDoc.ref);
      });
      await deleteDoc(conversationRef);
      if (get().currentConversationId === conversationId) {
        get().createNewConversation();
      }
    },
    updateConversationTitle: async (conversationId, newTitle) => {
        const user = get().user;
        if (!user || !newTitle.trim()) return;
        const conversationRef = doc(db, "chats", user.uid, "conversations", conversationId);
        await updateDoc(conversationRef, {
            title: newTitle.trim()
        });
    },
    saveMessage: async (message) => {
      const user = get().user;
      if (!user) return;
      let conversationId = get().currentConversationId;
      if (!conversationId) {
        const firstMessageContent = message.text || message.node?.data?.content || '새로운 대화';
        const conversationRef = await addDoc(collection(db, "chats", user.uid, "conversations"), {
          title: firstMessageContent.substring(0, 30),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        conversationId = conversationRef.id;
        set({ currentConversationId: conversationId });
        get().loadConversation(conversationId);
      }
      const { id, ...messageToSave } = message;
      Object.keys(messageToSave).forEach(key => (messageToSave[key] === undefined) && delete messageToSave[key]);
      if (messageToSave.node) {
        const { data, ...rest } = messageToSave.node;
        messageToSave.node = { ...rest, data: { content: data?.content, replies: data?.replies } };
      }
      const messagesCollection = collection(db, "chats", user.uid, "conversations", conversationId, "messages");
      await addDoc(messagesCollection, { ...messageToSave, createdAt: serverTimestamp() });
      await updateDoc(doc(db, "chats", user.uid, "conversations", conversationId), { updatedAt: serverTimestamp() });
    },
    addMessage: (sender, messageData) => {
      let newMessage;
      if (sender === 'user') {
        newMessage = { id: Date.now(), sender, text: messageData.text };
      } else {
        if (messageData.data) {
          newMessage = { id: messageData.id, sender: 'bot', node: messageData };
        } else {
          newMessage = {
            id: messageData.id || Date.now(),
            sender: 'bot',
            text: messageData.text,
            scenarios: messageData.scenarios,
            isStreaming: messageData.isStreaming || false,
            type: messageData.type,
            scenarioId: messageData.scenarioId,
          };
        }
      }
      set(state => ({ messages: [...state.messages, newMessage] }));
      
      if (!newMessage.isStreaming && newMessage.type !== 'scenario_resume_prompt') {
        get().saveMessage(newMessage);
      }
    },
    updateStreamingMessage: (id, chunk) => {
      set(state => ({ messages: state.messages.map(m => m.id === id ? { ...m, text: m.text + chunk } : m) }));
    },
    finalizeStreamingMessage: (id) => {
      set(state => {
        const finalMessage = state.messages.find(m => m.id === id);
        if (finalMessage) {
          const messageToSave = { ...finalMessage, isStreaming: false };
          get().saveMessage(messageToSave);
        }
        return { messages: state.messages.map(m => m.id === id ? { ...m, isStreaming: false } : m) };
      });
    },
    startLoading: () => set({ isLoading: true }),
    stopLoading: () => set({ isLoading: false }),
    handleResponse: async (messagePayload) => {
      const { addMessage, updateStreamingMessage, finalizeStreamingMessage, startLoading, stopLoading, showToast } = get();
      startLoading();
      if (messagePayload.text) {
        addMessage('user', { text: messagePayload.text });
      }
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: messagePayload, 
            scenarioState: null, 
            slots: get().slots,
            language: get().language,
          }),
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          const handler = responseHandlers[data.type];
          if (handler) {
            handler(data);
          } else {
            console.warn(`[ChatStore] Unhandled response type: ${data.type}`);
          }
        } else {
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          const streamingMessageId = Date.now();
          addMessage('bot', { id: streamingMessageId, text: '', isStreaming: true });
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              finalizeStreamingMessage(streamingMessageId);
              break;
            }
            updateStreamingMessage(streamingMessageId, value);
          }
        }
      } catch (error) {
        console.error('Failed to fetch chat response:', error);
        showToast('오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
      } finally {
        stopLoading();
      }
    },
    openScenarioPanel: async (scenarioId) => {
      const { scenarioStates, handleEvents } = get();

      if (scenarioStates[scenarioId]) {
          set({ 
              isScenarioPanelOpen: true, 
              activeScenarioId: scenarioId,
              activePanel: 'scenario' 
          });
          get().focusChatInput();
          return;
      }
      
      set({ 
          isScenarioPanelOpen: true, 
          activeScenarioId: scenarioId,
          activePanel: 'scenario',
          scenarioStates: {
              ...scenarioStates,
              [scenarioId]: {
                  messages: [],
                  state: null,
                  slots: {},
                  isLoading: true,
              }
          }
      });
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { text: scenarioId } }),
        });
        const data = await response.json();
        
        handleEvents(data.events);

        if (data.type === 'scenario_start') {
          const startNode = data.nextNode;
          set(state => ({
            scenarioStates: {
              ...state.scenarioStates,
              [scenarioId]: {
                messages: [{ id: startNode.id, sender: 'bot', node: startNode }],
                state: data.scenarioState,
                slots: data.slots || {},
                isLoading: false,
              },
            },
          }));
          await get().continueScenarioIfNeeded(startNode, scenarioId);
        } else {
          throw new Error("Failed to start scenario properly");
        }
      } catch (error) {
        console.error("Error starting scenario:", error);
        set(state => ({
          scenarioStates: {
            ...state.scenarioStates,
            [scenarioId]: {
              ...state.scenarioStates[scenarioId],
              messages: [{ id: 'error', sender: 'bot', text: '시나리오를 시작하는 중 오류가 발생했습니다.' }],
              isLoading: false,
            },
          },
        }));
      } finally {
        get().focusChatInput();
      }
    },
    endScenario: (scenarioId) => {
      const { scenarioStates, messages } = get();
      const newScenarioStates = { ...scenarioStates };
      delete newScenarioStates[scenarioId];

      set({
        scenarioStates: newScenarioStates,
        isScenarioPanelOpen: false,
        activeScenarioId: null,
        activePanel: 'main',
        messages: messages.filter(msg => msg.type !== 'scenario_resume_prompt' || msg.scenarioId !== scenarioId),
      });
    },
    setScenarioPanelOpen: (isOpen) => {
        const { activeScenarioId } = get();
        
        set(state => {
            let newMessages = state.messages;
            if (!isOpen && activeScenarioId) {
                newMessages = state.messages.filter(msg =>
                    msg.type !== 'scenario_resume_prompt' || msg.scenarioId !== activeScenarioId
                );
                newMessages.push({
                    id: Date.now(),
                    sender: 'bot',
                    type: 'scenario_resume_prompt',
                    scenarioId: activeScenarioId,
                    text: `'${activeScenarioId}' 시나리오 이어하기`,
                });
            }

            return {
                isScenarioPanelOpen: isOpen,
                activePanel: isOpen ? 'scenario' : 'main',
                messages: newMessages,
            };
        });

        get().focusChatInput();
    },
    handleScenarioResponse: async (payload) => {
      const { scenarioId } = payload;
      const { handleEvents, showToast } = get();

      set(state => ({
        scenarioStates: {
          ...state.scenarioStates,
          [scenarioId]: {
            ...state.scenarioStates[scenarioId],
            isLoading: true,
            messages: payload.userInput 
              ? [...state.scenarioStates[scenarioId].messages, { id: Date.now(), sender: 'user', text: payload.userInput }]
              : state.scenarioStates[scenarioId].messages,
          }
        }
      }));
      
      const currentScenario = get().scenarioStates[scenarioId];

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: { 
              sourceHandle: payload.sourceHandle, 
              text: payload.userInput 
            },
            scenarioState: currentScenario.state,
            slots: { ...currentScenario.slots, ...(payload.formData || {}) },
          }),
        });
        const data = await response.json();

        handleEvents(data.events);

        if (data.type === 'scenario') {
          const nextNode = data.nextNode;
          set(state => ({
            scenarioStates: {
                ...state.scenarioStates,
                [scenarioId]: {
                    ...state.scenarioStates[scenarioId],
                    messages: [...state.scenarioStates[scenarioId].messages, { id: nextNode.id, sender: 'bot', node: nextNode }],
                    state: data.scenarioState,
                    slots: data.slots, 
                    isLoading: false,
                }
            }
          }));
          await get().continueScenarioIfNeeded(nextNode, scenarioId);
        } else if (data.type === 'scenario_end') {
           set(state => ({
            scenarioStates: {
                ...state.scenarioStates,
                [scenarioId]: {
                    ...state.scenarioStates[scenarioId],
                    messages: [...state.scenarioStates[scenarioId].messages, { id: 'end', sender: 'bot', text: data.message }],
                    slots: data.slots, 
                    state: null,
                    isLoading: false,
                }
            }
          }));
        } else if (data.type === 'scenario_validation_fail') {
          showToast(data.message, 'error');
          set(state => ({
            scenarioStates: {
              ...state.scenarioStates,
              [scenarioId]: { ...state.scenarioStates[scenarioId], isLoading: false }
            }
          }));
        } else {
          throw new Error("Invalid scenario response type received: " + data.type);
        }
      } catch (error) {
        console.error("Error in scenario conversation:", error);
         set(state => ({
            scenarioStates: {
                ...state.scenarioStates,
                [scenarioId]: {
                    ...state.scenarioStates[scenarioId],
                    messages: [...state.scenarioStates[scenarioId].messages, { id: 'error', sender: 'bot', text: '오류가 발생했습니다.' }],
                    isLoading: false,
                }
            }
          }));
      }
    },
    continueScenarioIfNeeded: async (lastNode, scenarioId) => {
      const isInteractive = lastNode.type === 'slotfilling' || lastNode.type === 'form' || (lastNode.data?.replies && lastNode.data.replies.length > 0);
      if (!isInteractive && lastNode.id !== 'end') {
        await new Promise(resolve => setTimeout(resolve, 500));
        await get().handleScenarioResponse({
          scenarioId: scenarioId,
          currentNodeId: lastNode.id,
          sourceHandle: null,
          userInput: null,
        });
      }
    }
  };
});

useChatStore.getState().initAuth();