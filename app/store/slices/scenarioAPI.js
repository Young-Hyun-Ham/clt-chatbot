// app/store/slices/scenarioAPI.js
// FastAPI 호출 관련 함수들

import { locales } from "../../lib/locales";
import { getErrorKey } from "../../lib/errorHandler";
import { logger } from "../../lib/logger";
import { FASTAPI_BASE_URL } from "../../lib/constants";

export const createScenarioAPISlice = (set, get) => ({
  loadAvailableScenarios: async () => {
    try {
        const response = await fetch(`${FASTAPI_BASE_URL}/scenarios`);
        if (response.ok) {
            const scenarios = await response.json();
            console.log('[loadAvailableScenarios] FastAPI 응답:', scenarios);
            
            // API 응답 형식 분석 및 시나리오 정보 추출 (ID, 이름)
            const scenarioMap = {}; // ID -> 이름 매핑
            
            // Case 1: 직접 배열인 경우
            if(Array.isArray(scenarios)) {
                console.log('[loadAvailableScenarios] Case 1: 배열 형식');
                scenarios.forEach(scenario => {
                    // 시나리오가 직접 ID인 경우
                    if (typeof scenario === 'string') {
                        scenarioMap[scenario] = scenario;
                    }
                    // 시나리오가 객체이고 id 필드가 있는 경우
                    else if (scenario && scenario.id) {
                        // title이 있으면 사용, 없으면 id 사용
                        scenarioMap[scenario.id] = scenario.title || scenario.id;
                    }
                    // 카테고리 구조인 경우 - items에서 정보 추출
                    else if (scenario && Array.isArray(scenario.items)) {
                        scenario.items.forEach(item => {
                            if (typeof item === 'string') {
                                scenarioMap[item] = item;
                            } else if (item && item.id) {
                                scenarioMap[item.id] = item.title || item.id;
                            }
                        });
                    }
                    // subCategories가 있는 경우
                    else if (scenario && Array.isArray(scenario.subCategories)) {
                        scenario.subCategories.forEach(subCat => {
                            if (Array.isArray(subCat.items)) {
                                subCat.items.forEach(item => {
                                    if (typeof item === 'string') {
                                        scenarioMap[item] = item;
                                    } else if (item && item.id) {
                                        scenarioMap[item.id] = item.title || item.id;
                                    }
                                });
                            }
                        });
                    }
                });
            }
            // Case 2: 객체인 경우 (scenarios 필드가 있을 수 있음)
            else if (scenarios && scenarios.scenarios && Array.isArray(scenarios.scenarios)) {
                console.log('[loadAvailableScenarios] Case 2: {scenarios: Array} 형식');
                scenarios.scenarios.forEach(scenario => {
                    if (typeof scenario === 'string') {
                        scenarioMap[scenario] = scenario;
                    } else if (scenario && scenario.id) {
                        scenarioMap[scenario.id] = scenario.title || scenario.id;
                    }
                });
            }
            
            console.log('[loadAvailableScenarios] 시나리오 맵:', scenarioMap);
            set({ availableScenarios: scenarioMap });
            return;
        } else {
            throw new Error(`Failed with status ${response.status}`);
        }
    } catch (error) { 
        logger.error('Error loading available scenarios from FastAPI:', error);
        const { language, showEphemeralToast } = get();
        const errorKey = getErrorKey(error);
        const message =
          locales[language]?.[errorKey] || "Failed to load scenario list.";
        showEphemeralToast(message, "error");
        set({ availableScenarios: {} });
    }
  },

  loadScenarioCategories: async () => {
    try {
      // API_DEFAULTS에서 기본값 가져오기
      const { TENANT_ID, STAGE_ID, SEC_OFC_ID } = require("../../lib/constants").API_DEFAULTS;
      
      // 쿼리 파라미터 구성
      const params = new URLSearchParams({
        ten_id: TENANT_ID,
        stg_id: STAGE_ID,
        sec_ofc_id: SEC_OFC_ID,
      });

      // GET /scenarios/categories: 응답 형식 처리
      const response = await fetch(`${FASTAPI_BASE_URL}/scenarios/categories?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[loadScenarioCategories] FastAPI 응답:', data);
        console.log('[loadScenarioCategories] 데이터 타입:', typeof data, '배열 여부:', Array.isArray(data));
        
        // --- [수정] 백엔드 명세에 따라 응답 처리 ---
        // API 응답 구조: {categories: Array of CategoryResponse}
        // CategoryResponse: { id, name, order, subCategories }
        let categoryData = [];
        
        // Case 1: {categories: Array} 형태 (현재 백엔드가 반환하는 형식)
        if (data && data.categories && Array.isArray(data.categories)) {
          categoryData = data.categories;
          console.log('[loadScenarioCategories] Case 1: {categories: Array}에서 추출됨, 길이:', categoryData.length);
        }
        // Case 2: 이미 Array인 경우
        else if (Array.isArray(data)) {
          categoryData = data;
          console.log('[loadScenarioCategories] Case 2: 이미 Array, 길이:', categoryData.length);
        }
        // Case 3: Dictionary 형태
        else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          categoryData = Object.values(data);
          console.log('[loadScenarioCategories] Case 3: Dictionary에서 변환, 길이:', categoryData.length);
        }
        // Case 4: 단일 객체
        else if (typeof data === 'object' && data !== null) {
          categoryData = [data];
          console.log('[loadScenarioCategories] Case 4: 단일 객체 래핑');
        }
        
        console.log('[loadScenarioCategories] 최종 categoryData:', categoryData);
        set({ scenarioCategories: categoryData });
        logger.log("Loaded scenario categories from FastAPI /scenarios/categories");
        return;
      } else {
        throw new Error(`Failed with status ${response.status}`);
      }
    } catch (error) {
      logger.warn("Error loading scenario categories from FastAPI:", error);
      const { language, showEphemeralToast } = get();
      const errorKey = getErrorKey(error);
      const message =
        locales[language]?.[errorKey] || "Failed to load scenario categories.";
      showEphemeralToast(message, "error");
      set({ scenarioCategories: [] });
    }
  },

  saveScenarioCategories: async (newCategories) => {
    try {
      const { TENANT_ID, STAGE_ID, SEC_OFC_ID } = require("../../lib/constants").API_DEFAULTS;
      
      // --- [수정] 백엔드 명세에 따라 요청 본문 구성 ---
      // PUT /scenarios/categories
      // ShortCutInsertRequest: { categories: Array of ShortcutInsertParam }
      // ShortcutInsertParam: { id, name, order, subCategories }
      const payload = {
        categories: newCategories  // 배열 그대로 전달
      };

      console.log('[saveScenarioCategories] FastAPI PUT 요청:', payload);

      const response = await fetch(`${FASTAPI_BASE_URL}/scenarios/categories`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[saveScenarioCategories] FastAPI 저장 성공');
        set({ scenarioCategories: newCategories });
        logger.log("Saved scenario categories to FastAPI /scenarios/categories");
        return true;
      } else {
        throw new Error(`Failed with status ${response.status}`);
      }
    } catch (error) {
      logger.warn("Error saving scenario categories to FastAPI:", error);
      const { language, showEphemeralToast } = get();
      const errorKey = getErrorKey(error);
      const message =
        locales[language]?.[errorKey] || "Failed to save scenario categories.";
      showEphemeralToast(message, "error");
      return false;
    }
  },
});
