'use client';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';

export const createNotificationSlice = (set, get) => ({
  // State
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  toastHistory: [],
  unsubscribeNotifications: null,
  hasUnreadNotifications: false,
  unreadScenarioSessions: new Set(),

  // Actions
  deleteNotification: async (notificationId) => {
    const user = get().user;
    if (!user) return;

    if (typeof notificationId !== 'string' || !notificationId) {
        console.error("Delete failed: Invalid notificationId provided.", notificationId);
        get().showToast("Failed to delete notification due to an invalid ID.", "error");
        return;
    }

    try {
        const notificationRef = doc(get().db, "users", user.uid, "notifications", notificationId);
        await deleteDoc(notificationRef);
    } catch (error) {
        console.error("Error deleting notification from Firestore:", error);
        get().showToast("Failed to delete notification.", "error");
    }
  },
  
  // --- 👇 [수정] conversationId 파라미터 추가 ---
  showToast: (message, type = 'info', scenarioSessionId = null, conversationId = null) => {
    set({ toast: { id: Date.now(), message, type, visible: true } });

    const dataToSave = { 
        message, 
        type, 
        createdAt: serverTimestamp(), 
        read: false,
        scenarioSessionId,
        conversationId, // conversationId 저장
    };
    get().saveNotification(dataToSave); 

    setTimeout(() => set(state => ({ toast: { ...state.toast, visible: false } })), 3000);
  },

  saveNotification: async (toastData) => {
    const user = get().user;
    if (!user) return;
    try {
      const notificationsCollection = collection(get().db, "users", user.uid, "notifications");
      await addDoc(notificationsCollection, toastData);
    } catch (error) {
      console.error("Error saving notification to Firestore:", error);
    }
  },

  loadNotifications: (userId) => {
    const q = query(collection(get().db, "users", userId, "notifications"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const hasUnread = notifications.some(n => !n.read);
      
      const unreadSessions = new Set(
        notifications
          .filter(n => !n.read && n.scenarioSessionId)
          .map(n => n.scenarioSessionId)
      );
      
      set({ 
          toastHistory: notifications, 
          hasUnreadNotifications: hasUnread,
          unreadScenarioSessions: unreadSessions,
      });

    }, (error) => {
        console.error("Error listening to notification changes:", error);
    });
    set({ unsubscribeNotifications: unsubscribe });
  },
  
  markNotificationAsRead: async (notificationId) => {
    const user = get().user;
    if (!user) return;

    const notificationRef = doc(get().db, "users", user.uid, "notifications", notificationId);
    try {
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  // --- 👇 [수정] conversationId 파라미터 추가 ---
  handleEvents: (events, scenarioSessionId = null, conversationId = null) => {
      if (!events || !Array.isArray(events)) return;
      events.forEach(event => {
        if (event.type === 'toast') {
          get().showToast(event.message, event.toastType, scenarioSessionId, conversationId);
        }
      });
  },
  
  closeNotificationModal: () => {
    set({ isNotificationModalOpen: false });
  },
});