// app/store/slices/scenarioHandlers.js
// 시나리오 이벤트 및 상호작용 핸들링 함수들

import { locales } from "../../lib/locales";
import { getErrorKey } from "../../lib/errorHandler";
import { logger } from "../../lib/logger";
import { FASTAPI_BASE_URL } from "../../lib/constants";

// ✅ 헬퍼 함수: 노드 ID로 노드 찾기
const getNodeById = (nodes, nodeId) => {
  return nodes?.find(n => n.id === nodeId);
};

// ✅ 헬퍼 함수: 현재 노드에서 다음 노드 결정 (로컬 처리)
const getNextNode = (nodes, edges, currentNodeId, sourceHandle = null) => {
  if (!nodes || !edges || !currentNodeId) return null;
  
  // 현재 노드에서 출발하는 엣지 찾기
  const outgoingEdges = edges.filter(e => e.source === currentNodeId);
  
  if (outgoingEdges.length === 0) {
    console.log(`[getNextNode] No outgoing edges from node ${currentNodeId}`);
    return null;
  }
  
  // Case 1: 단순 흐름 (엣지가 1개)
  if (outgoingEdges.length === 1) {
    const nextNodeId = outgoingEdges[0].target;
    return getNodeById(nodes, nextNodeId);
  }
  
  // Case 2: 분기 (sourceHandle로 구분)
  if (sourceHandle) {
    const selectedEdge = outgoingEdges.find(e => e.sourceHandle === sourceHandle);
    if (selectedEdge) {
      return getNodeById(nodes, selectedEdge.target);
    }
  }
  
  // Case 3: 기본값 (첫 번째 엣지)
  const nextNodeId = outgoingEdges[0].target;
  return getNodeById(nodes, nextNodeId);
};

// ✅ 헬퍼 함수: 노드가 사용자 입력을 기다리는지 판정
const isInteractiveNode = (node) => {
  if (!node) return false;
  return (
    node.type === 'slotfilling' ||
    node.type === 'form' ||
    node.type === 'message' ||
    node.type === 'branch' ||
    (node.type === 'branch' && node.data?.evaluationType !== 'CONDITION')
  );
};

// ✅ 헬퍼 함수: 노드가 자동으로 진행되는 노드인지 판정
const isAutoPassthroughNode = (node) => {
  if (!node) return false;
  return (
    node.type === 'setSlot' ||
    node.type === 'set-slot' ||
    node.type === 'delay' ||
    node.type === 'api' ||
    node.type === 'llm'
  );
};

export const createScenarioHandlersSlice = (set, get) => ({
  setScenarioSelectedOption: async (scenarioSessionId, messageNodeId, selectedValue) => {
    const { user, currentConversationId, scenarioStates, language, showEphemeralToast } = get();
    if (!user || !currentConversationId || !scenarioSessionId) return;

    const scenarioState = scenarioStates[scenarioSessionId];
    if (!scenarioState) return;

    const originalMessages = Array.isArray(scenarioState.messages) ? scenarioState.messages : [];
    const updatedMessages = originalMessages.map(msg => {
        if (msg.node && msg.node.id === messageNodeId) {
            return { ...msg, selectedOption: selectedValue };
        }
        return msg;
    });

    set(state => ({
        scenarioStates: {
            ...state.scenarioStates,
            [scenarioSessionId]: {
                ...state.scenarioStates[scenarioSessionId],
                messages: updatedMessages,
            },
        },
    }));

    try {
        await fetch(
            `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${scenarioSessionId}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usr_id: user.uid,
                    messages: updatedMessages
                }),
            }
        ).then(r => {
            if (!r.ok) console.warn(`[setScenarioSelectedOption] Session PATCH failed (${r.status}), continuing...`);
            else return r.json();
        });
    } catch (error) {
      console.error("Error updating scenario selected option via FastAPI:", error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || 'Failed to save selection in scenario.';
        showEphemeralToast(message, 'error');
        set(state => ({
            scenarioStates: {
                ...state.scenarioStates,
                [scenarioSessionId]: {
                  ...state.scenarioStates[scenarioSessionId],
                  messages: originalMessages,
                }
            },
        }));
    }
  },

  openScenarioPanel: async (scenarioId, initialSlots = {}) => {
    const {
      user,
      currentConversationId,
      handleEvents,
      language,
      setActivePanel,
      addMessage,
      setForceScrollToBottom,
      showEphemeralToast,
      showScenarioBubbles,
    } = get();
    if (!user) return;

    let conversationId = currentConversationId;
    let newScenarioSessionId = null;
    let scenarioData = null;

    try {
      // ✅ [NEW] 시나리오 메타데이터 로드 (nodes/edges 포함)
      console.log(`[openScenarioPanel] Loading scenario data for ${scenarioId}...`);
      const scenarioResponse = await fetch(
        `${FASTAPI_BASE_URL}/builder/scenarios/${scenarioId}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!scenarioResponse.ok) {
        throw new Error(`Failed to load scenario: ${scenarioResponse.status}`);
      }

      scenarioData = await scenarioResponse.json();
      console.log(`[openScenarioPanel] Scenario loaded:`, scenarioData);

      if (!scenarioData.nodes || scenarioData.nodes.length === 0) {
        throw new Error("Scenario has no nodes");
      }

      if (!conversationId) {
        const newConversationId = await get().createNewConversation(true);
        if (!newConversationId) {
          throw new Error(
            "Failed to ensure conversation ID for starting scenario."
          );
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timeout waiting for conversation load")),
            5000
          );
          const check = () => {
            if (get().currentConversationId === newConversationId) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
        conversationId = newConversationId;
      }

      // --- [수정] FastAPI로 시나리오 세션 생성 ---
      const createSessionResponse = await fetch(
        `${FASTAPI_BASE_URL}/conversations/${conversationId}/scenario-sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usr_id: user.uid,
            scenario_id: scenarioId,
            slots: initialSlots,
            initial_context: {},
          }),
        }
      );

      if (!createSessionResponse.ok) {
        throw new Error(`Failed to create scenario session: ${createSessionResponse.status}`);
      }

      // 응답에서 session ID 추출
      const sessionData = await createSessionResponse.json();
      newScenarioSessionId = sessionData.id || sessionData.session_id;
      // --- [수정] ---

      setActivePanel("main");
      setForceScrollToBottom(true);

      if (showScenarioBubbles) {
        await addMessage("user", {
          type: "scenario_bubble",
          scenarioSessionId: newScenarioSessionId,
        });
      }

      get().subscribeToScenarioSession(newScenarioSessionId);

      // ✅ [NEW] 프론트엔드에서 첫 번째 노드 결정
      const firstNodeId = scenarioData.start_node_id || scenarioData.nodes[0].id;
      const firstNode = getNodeById(scenarioData.nodes, firstNodeId);
      console.log(`[openScenarioPanel] First node:`, firstNode);

      // ✅ [NEW] 시나리오 상태 초기화 (nodes/edges 포함) - 반드시 setActivePanel 전에!
      set(state => {
        const updatedState = {
          scenarioStates: {
            ...state.scenarioStates,
            [newScenarioSessionId]: {
              id: newScenarioSessionId,
              conversation_id: conversationId,
              scenario_id: scenarioId,
              title: scenarioData.name,
              nodes: scenarioData.nodes,
              edges: scenarioData.edges || [],
              status: 'active',
              slots: initialSlots || {},
              messages: firstNode ? [{
                id: firstNode.id,
                sender: 'bot',
                text: firstNode.data?.content || '',  // ✅ text 필드 추가 (Chat.jsx와 호환)
                node: firstNode,
              }] : [],
              state: {
                scenario_id: scenarioId,
                current_node_id: firstNodeId,
                awaiting_input: isInteractiveNode(firstNode),
              },
              isLoading: false,  // ✅ 로딩 상태 해제
            },
          },
        };
        console.log(`[openScenarioPanel] ✅ Scenario state initialized:`, updatedState.scenarioStates[newScenarioSessionId]);
        return updatedState;
      });

      // ✅ [NEW] 상태 업데이트 완료 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      const savedScenario = get().scenarioStates[newScenarioSessionId];
      console.log(`[openScenarioPanel] ✅ Saved scenario state:`, savedScenario);

      // ✅ [NEW] 상태 초기화 완료 후 패널 활성화
      console.log(`[openScenarioPanel] Activating scenario panel with session ID:`, newScenarioSessionId);
      await setActivePanel("scenario", newScenarioSessionId);
      console.log(`[openScenarioPanel] ✅ Scenario panel activated`);

      // ✅ [NEW] 자동 진행 필요 여부 판정
      if (firstNode && isAutoPassthroughNode(firstNode)) {
        console.log(`[openScenarioPanel] First node is auto-passthrough (${firstNode.type}), continuing...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        await get().continueScenarioIfNeeded(firstNode, newScenarioSessionId);
      } else {
        console.log(`[openScenarioPanel] First node is interactive or terminal, waiting for user.`);
      }

      return;


      // --- [기존 코드 제거] FastAPI /chat 호출 더 이상 불필요 ---

    } catch (error) {
      console.error(`Error opening scenario panel for ${scenarioId}:`, error);
      const errorKey = getErrorKey(error);
      const message =
        locales[language]?.[errorKey] || "Failed to start scenario.";
      showEphemeralToast(message, "error");

      if (user && conversationId && newScenarioSessionId) {
        try {
          // FastAPI로 시나리오 세션 삭제
          await fetch(
            `${FASTAPI_BASE_URL}/conversations/${conversationId}/scenario-sessions/${newScenarioSessionId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ usr_id: user.uid }),
            }
          );

          console.log(
            `Cleaned up failed scenario session: ${newScenarioSessionId}`
          );

          if (showScenarioBubbles) {
            set((state) => ({
              messages: state.messages.filter(
                (msg) =>
                  !(
                    msg.type === "scenario_bubble" &&
                    msg.scenarioSessionId === newScenarioSessionId
                  )
              ),
            }));
            console.log(
              `Removed scenario bubble from main chat for session: ${newScenarioSessionId}`
            );
          }
        } catch (cleanupError) {
          console.error(
            `Error cleaning up failed scenario session ${newScenarioSessionId}:`,
            cleanupError
          );
        }
      }
      setActivePanel("main");
    }
  },

  handleScenarioResponse: async (payload) => {
    const { scenarioSessionId } = payload;
    const { user, currentConversationId, language, endScenario, showEphemeralToast } = get();
    if (!user || !currentConversationId || !scenarioSessionId) return;

    const currentScenario = get().scenarioStates[scenarioSessionId];
    if (!currentScenario) {
        console.warn(`handleScenarioResponse called for non-existent session: ${scenarioSessionId}`);
        showEphemeralToast(locales[language]?.errorUnexpected || 'An unexpected error occurred.', 'error');
        return;
    }

    const { nodes, edges } = currentScenario;
    if (!nodes || !edges) {
      console.warn(`handleScenarioResponse: Scenario session missing nodes/edges.`);
      return;
    }

    const existingMessages = Array.isArray(currentScenario.messages) ? currentScenario.messages : [];
    const currentNodeId = currentScenario.state?.current_node_id;
    const currentNode = getNodeById(nodes, currentNodeId);

    set(state => ({
        scenarioStates: { ...state.scenarioStates, [scenarioSessionId]: { ...currentScenario, isLoading: true } }
    }));

    try {
        let newMessages = [...existingMessages];

        // ✅ [NEW] 사용자 입력 추가
        if (payload.userInput) {
            newMessages.push({ id: `user-${Date.now()}`, sender: 'user', text: payload.userInput });
        }

        // ✅ [NEW] 프론트엔드에서 다음 노드 결정
        const nextNode = getNextNode(nodes, edges, currentNodeId, payload.sourceHandle);
        console.log(`[handleScenarioResponse] Current node: ${currentNodeId}, Next node: ${nextNode?.id || 'END'}`);

        if (!nextNode) {
          // 시나리오 종료
          console.log(`[handleScenarioResponse] ✅ No next node, scenario complete.`);
          newMessages.push({
            id: `bot-complete-${Date.now()}`,
            sender: 'bot',
            text: locales[language]?.scenarioComplete || 'Scenario complete.',
          });

          const updatePayload = {
            messages: newMessages,
            status: 'completed',
            state: null,
            slots: currentScenario.slots,
          };

          await fetch(
              `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${scenarioSessionId}`,
              {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                      usr_id: user.uid,
                      ...updatePayload
                  }),
              }
          ).then(r => {
              if (!r.ok) console.warn(`[handleScenarioResponse] Session PATCH failed (${r.status}), continuing...`);
              else return r.json();
          });

          endScenario(scenarioSessionId, 'completed');
          return;
        }

        // 다음 노드 메시지 추가
        if (nextNode.type !== 'setSlot' && nextNode.type !== 'set-slot') {
          newMessages.push({
            id: nextNode.id,
            sender: 'bot',
            text: nextNode.data?.content || '',  // ✅ text 필드 추가 (Chat.jsx와 호환)
            node: nextNode,
          });
        }

        // ✅ [NEW] 상태 업데이트
        const updatePayload = {
            messages: newMessages,
            status: 'active',
            state: {
              scenario_id: currentScenario.scenario_id,
              current_node_id: nextNode.id,
              awaiting_input: isInteractiveNode(nextNode),
            },
            slots: payload.formData ? { ...currentScenario.slots, ...(payload.formData || {}) } : currentScenario.slots,
        };

        await fetch(
            `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${scenarioSessionId}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usr_id: user.uid,
                    ...updatePayload
                }),
            }
        ).then(r => {
            if (!r.ok) console.warn(`[handleScenarioResponse] Session PATCH failed (${r.status}), continuing...`);
            else return r.json();
        });

        // ✅ [NEW] 다음 노드가 비대화형이면 자동 진행
        if (!isInteractiveNode(nextNode)) {
          await new Promise(resolve => setTimeout(resolve, 300));
          await get().continueScenarioIfNeeded(nextNode, scenarioSessionId);
        }

        set(state => ({
            scenarioStates: {
              ...state.scenarioStates,
              [scenarioSessionId]: {
                ...state.scenarioStates[scenarioSessionId],
                messages: newMessages,
                state: updatePayload.state,
                slots: updatePayload.slots,
                isLoading: false,
              }
            }
        }));

    } catch (error) {
        console.error(`Error handling scenario response for ${scenarioSessionId}:`, error);
        const errorKey = getErrorKey(error);
        const errorMessage = locales[language]?.[errorKey] || 'An error occurred during the scenario.';
        showEphemeralToast(errorMessage, 'error');

        const errorMessages = [...existingMessages, { id: `bot-error-${Date.now()}`, sender: 'bot', text: errorMessage }];
        try {
            await fetch(
                `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/scenario-sessions/${scenarioSessionId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        usr_id: user.uid,
                        messages: errorMessages,
                        status: 'failed',
                        state: null
                    }),
                }
            ).then(r => {
                if (!r.ok) console.warn(`[handleScenarioResponse] Session PATCH failed (${r.status}), continuing...`);
                else return r.json();
            });
            
            endScenario(scenarioSessionId, 'failed');
        } catch (updateError) {
             console.error(`Failed to update scenario status to failed for ${scenarioSessionId}:`, updateError);
              set(state => ({
                scenarioStates: {
                    ...state.scenarioStates,
                    [scenarioSessionId]: {
                        ...(state.scenarioStates[scenarioSessionId] || {}),
                        messages: errorMessages,
                        status: 'failed',
                        state: null,
                        isLoading: false
                    }
                }
             }));
             endScenario(scenarioSessionId, 'failed');
        }
    } finally {
      set(state => {
         if(state.scenarioStates[scenarioSessionId]) {
            return {
                scenarioStates: { ...state.scenarioStates, [scenarioSessionId]: { ...state.scenarioStates[scenarioSessionId], isLoading: false } }
            };
         }
         return state;
      });
    }
  },

  continueScenarioIfNeeded: async (lastNode, scenarioSessionId) => {
    if (!lastNode || !scenarioSessionId) {
      console.warn("continueScenarioIfNeeded: lastNode or scenarioSessionId is missing.");
      return;
    }

    const currentScenario = get().scenarioStates[scenarioSessionId];
    if (!currentScenario) {
      console.warn(`continueScenarioIfNeeded: Scenario session ${scenarioSessionId} not found.`);
      return;
    }

    const { nodes, edges } = currentScenario;
    if (!nodes || !edges) {
      console.warn(`continueScenarioIfNeeded: Scenario session missing nodes/edges.`);
      return;
    }

    console.log(`[continueScenarioIfNeeded] Starting from node: ${lastNode.id} (${lastNode.type})`);

    let currentNode = lastNode;
    let isLoopActive = true;
    let loopCount = 0;
    const MAX_LOOP_ITERATIONS = 100; // 무한 루프 방지

    // ✅ [NEW] 프론트엔드에서 비대화형 노드들을 자동으로 진행
    while (isLoopActive && loopCount < MAX_LOOP_ITERATIONS) {
      loopCount++;
      console.log(`[continueScenarioIfNeeded] Loop iteration ${loopCount}, node: ${currentNode.id} (${currentNode.type})`);

      // 대화형 노드라면 종료 (사용자 입력 대기)
      if (isInteractiveNode(currentNode)) {
        console.log(`[continueScenarioIfNeeded] ✅ Reached interactive node: ${currentNode.id} (${currentNode.type}), stopping.`);
        isLoopActive = false;
        break;
      }

      // 종료 노드라면 시나리오 끝
      if (currentNode.id === 'end' || currentNode.type === 'end') {
        console.log(`[continueScenarioIfNeeded] ✅ Reached end node, scenario complete.`);
        isLoopActive = false;
        break;
      }

      // 자동 진행 노드 처리 (API, LLM 등은 백엔드에서 처리)
      if (isAutoPassthroughNode(currentNode)) {
        console.log(`[continueScenarioIfNeeded] Auto-passthrough node (${currentNode.type}), calling backend...`);
        
        // ✅ [NEW] 백엔드에 이 노드 실행을 요청
        try {
          const { user, currentConversationId, language, showEphemeralToast } = get();
          
          const response = await fetch(`${FASTAPI_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usr_id: user.uid,
              conversation_id: currentConversationId,
              role: "user",
              scenario_session_id: scenarioSessionId,
              content: "",
              type: "text",
              language,
              slots: currentScenario.slots || {},
              source_handle: null,
              current_node_id: currentNode.id,
            }),
          });

          if (!response.ok) {
            throw new Error(`Backend /chat failed: ${response.status}`);
          }

          const data = await response.json();
          console.log(`[continueScenarioIfNeeded] Backend response for node ${currentNode.id}:`, data);

          // 다음 노드 결정
          const nextNodeId = data.nextNode?.id || data.next_node?.id;
          if (nextNodeId) {
            currentNode = getNodeById(nodes, nextNodeId);
            if (!currentNode) {
              console.warn(`[continueScenarioIfNeeded] Next node ${nextNodeId} not found, stopping.`);
              isLoopActive = false;
              break;
            }
          } else {
            console.log(`[continueScenarioIfNeeded] No next node from backend, stopping.`);
            isLoopActive = false;
            break;
          }
        } catch (error) {
          console.error(`[continueScenarioIfNeeded] Error processing auto-passthrough node:`, error);
          const { language, showEphemeralToast, endScenario } = get();
          const errorKey = getErrorKey(error);
          const message = locales[language]?.[errorKey] || 'Scenario auto-continue failed.';
          showEphemeralToast(message, 'error');
          endScenario(scenarioSessionId, 'failed');
          return;
        }
      } else {
        // 그 외 노드는 진행 불가
        console.log(`[continueScenarioIfNeeded] Unknown node type (${currentNode.type}), stopping.`);
        isLoopActive = false;
        break;
      }

      // 지연 처리 (UI 반응성 유지)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (loopCount >= MAX_LOOP_ITERATIONS) {
      console.error(`[continueScenarioIfNeeded] Loop limit reached, potential infinite loop detected!`);
      const { showEphemeralToast, endScenario } = get();
      showEphemeralToast('Scenario loop limit exceeded', 'error');
      endScenario(scenarioSessionId, 'failed');
      return;
    }

    // ✅ [NEW] 최종 상태 업데이트
    set(state => {
      const scenario = state.scenarioStates[scenarioSessionId];
      if (!scenario) return state;

      const messages = [...(scenario.messages || [])];
      if (!messages.find(m => m.node?.id === currentNode.id)) {
        messages.push({
          id: currentNode.id,
          sender: 'bot',
          text: currentNode.data?.content || '',  // ✅ text 필드 추가 (Chat.jsx와 호환)
          node: currentNode,
        });
      }

      return {
        scenarioStates: {
          ...state.scenarioStates,
          [scenarioSessionId]: {
            ...scenario,
            messages,
            state: {
              scenario_id: scenario.scenario_id,
              current_node_id: currentNode.id,
              awaiting_input: isInteractiveNode(currentNode),
            },
          },
        },
      };
    });

    console.log(`[continueScenarioIfNeeded] ✅ Auto-continue complete, stopped at node: ${currentNode.id}`);
  },
});
