// app/store/slices/scenarioSessionSlice.js
// 세션 구독 및 관리 관련 함수들

import { locales } from "../../lib/locales";
import { getErrorKey } from "../../lib/errorHandler";
import { logger } from "../../lib/logger";
import { FASTAPI_BASE_URL } from "../../lib/constants";

export const createScenarioSessionSlice = (set, get) => ({
  subscribeToScenarioSession: (sessionId) => {
    const { user, currentConversationId, unsubscribeScenariosMap, language, showEphemeralToast } = get();
    if (!user || !currentConversationId || unsubscribeScenariosMap[sessionId]) return;

    // 🔴 [NEW] 로컬에 데이터가 있으면 폴링 불필요
    const existingScenario = get().scenarioStates[sessionId];
    console.log(`[subscribeToScenarioSession] Checking local state for ${sessionId}:`, {
      hasMessages: !!existingScenario?.messages,
      messagesCount: existingScenario?.messages?.length,
      hasState: !!existingScenario?.state,
      currentNodeId: existingScenario?.state?.current_node_id,
    });
    
    if (existingScenario?.messages && existingScenario?.state) {
      console.log(`[subscribeToScenarioSession] ✓ Local state already exists, no fetch needed for ${sessionId}`);
      return;
    }

    console.log(`[subscribeToScenarioSession] Local state missing, fetching from server for ${sessionId}`);
    
    // 🟢 [NEW] 재진입 시: 초기 조회만 (폴링 아님)
    const fetchScenarioState = async () => {
      try {
        const response = await fetch(
          `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${sessionId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" }
          }
        );
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`Scenario session ${sessionId} not found or deleted.`);
            get().unsubscribeFromScenarioSession(sessionId);
          }
          return;
        }
        
        const data = await response.json();
        const scenarioData = data.data || data;
        
        console.log(`[subscribeToScenarioSession] ✅ Fetched state for ${sessionId}:`, {
          status: scenarioData.status,
          current_node_id: scenarioData.state?.current_node_id,
          messages_count: scenarioData.messages?.length || 0,
        });
        
        set(state => {
            const currentLocalState = state.scenarioStates[sessionId];
            
            // 🔴 [NEW] 로컬 데이터가 이미 있으면 백엔드 빈 데이터로 덮어쓰지 않음
            if (currentLocalState?.messages && currentLocalState?.state) {
              console.log(`[subscribeToScenarioSession] Local state already exists, not overwriting with server data`);
              return state;
            }
            
            const newScenarioStates = {
                ...state.scenarioStates,
                [sessionId]: {
                    ...(currentLocalState || {}),
                    ...scenarioData  // 로컬 데이터 없을 때만 서버 데이터 적용
                }
            };
            const newActiveSessions = Object.keys(newScenarioStates);

            return {
                scenarioStates: newScenarioStates,
                activeScenarioSessions: newActiveSessions,
            };
        });
      } catch (error) {
        console.error(`Error fetching scenario session ${sessionId}:`, error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || 'Error loading scenario state.';
        showEphemeralToast(message, 'error');
        get().unsubscribeFromScenarioSession(sessionId);
      }
    };
    
    // 초기 조회 실행 (한 번만)
    fetchScenarioState();
    
    // cleanup 함수 저장 (빈 함수, 폴링 없으므로)
    const unsubscribe = () => {
      // 폴링이 없으므로 정리할 것 없음
    };
    
    set(state => ({
        unsubscribeScenariosMap: {
            ...state.unsubscribeScenariosMap,
            [sessionId]: unsubscribe
        }
    }));
  },

  unsubscribeFromScenarioSession: (sessionId) => {
      set(state => {
          const newUnsubscribeMap = { ...state.unsubscribeScenariosMap };
          if (newUnsubscribeMap[sessionId]) {
              newUnsubscribeMap[sessionId]();
              delete newUnsubscribeMap[sessionId];
          }

          const updatedStates = { ...state.scenarioStates };
          delete updatedStates[sessionId];
          const updatedActiveSessions = Object.keys(updatedStates);

          const shouldResetActivePanel = state.activeScenarioSessionId === sessionId || state.lastFocusedScenarioSessionId === sessionId;

          return {
              unsubscribeScenariosMap: newUnsubscribeMap,
              scenarioStates: updatedStates,
              activeScenarioSessions: updatedActiveSessions,
              ...(shouldResetActivePanel ? {
                  activeScenarioSessionId: null,
                  lastFocusedScenarioSessionId: null,
                  activePanel: 'main'
              } : {})
          };
      });
  },

  unsubscribeAllScenarioListeners: () => {
    const { unsubscribeScenariosMap } = get();
    Object.keys(unsubscribeScenariosMap).forEach(sessionId => {
      get().unsubscribeFromScenarioSession(sessionId);
    });
  },

  endScenario: async (scenarioSessionId, status = 'completed') => {
    const { user, currentConversationId, language, showEphemeralToast } = get(); 
    if (!user || !currentConversationId || !scenarioSessionId) return;
    
    try {
        // --- [수정] FastAPI로 업데이트 (정확한 경로: /conversations/{conversation_id}/scenario-sessions/{session_id}) ---
        await fetch(
            `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${scenarioSessionId}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usr_id: user.uid,
                    status: status,
                    state: null
                }),
            }
        ).then(r => {
            if (!r.ok) throw new Error(`Failed to update session: ${r.status}`);
            return r.json();
        });
        // --- [수정] ---
        
        set(state => {
            const updatedState = state.scenarioStates[scenarioSessionId]
                ? { ...state.scenarioStates[scenarioSessionId], status: status, state: null } 
                : { status: status, state: null }; 

            return {
                scenarioStates: {
                    ...state.scenarioStates,
                    [scenarioSessionId]: updatedState
                },
            };
        });

        console.log(`[endScenario] Scenario ${scenarioSessionId} marked as ${status}. Panel will remain open.`);

    } catch (error) {
        console.error(`Error ending scenario ${scenarioSessionId} with status ${status}:`, error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || 'Failed to update scenario status.';
        showEphemeralToast(message, 'error');
    }
  },
});
