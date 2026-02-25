// app/lib/llm.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { locales } from './locales';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// 스트리밍 응답 전용 모델
const streamingModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash"
});


/**
 * 선택된 LLM 공급자에 따라 API를 호출하고, 분석된 응답과 슬롯을 JSON으로 반환하는 함수
 * @param {string} prompt - 사용자 입력 메시지
 * @param {string} language - 응답 언어 ('ko' 또는 'en')
 * @param {Array} shortcuts - 숏컷 목록
 * @param {string} llmProvider - 사용할 LLM ('gemini' or 'flowise')
 * @param {string} flowiseApiUrl - Flowise API URL
 * @returns {Promise<ReadableStream|object>} - Gemini/Flowise 스트림의 경우 ReadableStream, 에러 시 표준 에러 JSON 객체({ type: 'error', message: '...' })를 반환
 */
export async function getLlmResponse(prompt, language = 'ko', shortcuts = [], llmProvider, flowiseApiUrl) {
    console.log(`[getLlmResponse] Provider selected: ${llmProvider}`);
    if (llmProvider === 'flowise') {
        return getFlowiseStreamingResponse(prompt, flowiseApiUrl, language);
    }

    // Gemini 스트리밍 응답을 기본으로 사용
    return getGeminiStreamingResponse(prompt, language, shortcuts);
}


/**
 * Flowise API에 스트리밍 요청을 보내고, 응답 스트림(ReadableStream)을 반환합니다.
 * @param {string} prompt - 사용자 입력 메시지
 * @param {string} apiUrl - Flowise API URL
 * @param {string} language - 오류 메시지 언어 설정용
 * @returns {Promise<ReadableStream|object>} - Flowise의 SSE 스트림 또는 표준 에러 객체 { type: 'error', message: '...' }
 */
async function getFlowiseStreamingResponse(prompt, apiUrl, language = 'ko') {
    console.log(`[getFlowiseStreamingResponse] Called with apiUrl: ${apiUrl}`);

    if (!apiUrl) {
        console.error("[getFlowiseStreamingResponse] Error: Flowise API URL is not set.");
        // --- 👇 [수정] URL 부재 시 errorLLMFail 메시지 사용 ---
        const message = locales[language]?.['errorLLMFail'] || 'Flowise API is not configured. Please try again later.';
        return {
            type: 'error',
            message: message
        };
        // --- 👆 [수정] ---
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃 설정

    try {
        const requestBody = { question: prompt, streaming: true };
        console.log(`[getFlowiseStreamingResponse] Sending request to Flowise: ${apiUrl}`, requestBody);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`[getFlowiseStreamingResponse] Received response status: ${response.status}`);

        if (!response.ok) {
            let errorBody = await response.text();
            try {
                const errorJson = JSON.parse(errorBody);
                errorBody = errorJson.message || errorBody;
            } catch (e) { /* ignore json parse error */ }
            console.error(`[getFlowiseStreamingResponse] Flowise API Error (${response.status}):`, errorBody);
            // --- 👇 [수정] HTTP 오류 시 errorLLMFail 메시지 사용 ---
            const message = locales[language]?.['errorLLMFail'] || 'Flowise API request failed. Please try again later.';
            return {
                type: 'error',
                message: message
            };
            // --- 👆 [수정] ---
        }

        console.log("[getFlowiseStreamingResponse] Response OK. Returning response body (stream).");
        return response.body;

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("[getFlowiseStreamingResponse] API call failed:", error);

        // --- 👇 [수정] fetch 오류 시 errorLLMFail 메시지 사용 ---
        const message = locales[language]?.['errorLLMFail'] || 'Failed to call Flowise API. Please try again later.';
        return {
            type: 'error',
            message: message
        };
        // --- 👆 [수정] ---
    }
}


// Gemini 스트리밍 응답 함수
async function getGeminiStreamingResponse(prompt, language = 'ko', shortcuts = []) {
  console.log(`[getGeminiStreamingResponse] Called.`);
  try {
    const languageInstruction = language === 'en'
        ? "Please construct your 'response' field in English."
        : "반드시 'response' 필드는 한국어로 작성해주세요.";

    const shortcutList = shortcuts.length > 0
      ? `Here is a list of available shortcuts the user can use:\n${JSON.stringify(shortcuts, null, 2)}`
      : "There are no shortcuts available.";

    const systemInstruction = `You are a powerful AI assistant. Your task is to analyze user input and generate a response in two parts, separated by '|||'.
1.  **First Part (JSON object for slots)**: Analyze the user's prompt to identify key entities (like locations, dates, times, names, etc.). Create a JSON object with a single key "slots" containing these key-value-pairs. If no specific entities are found, the value should be an empty object {}. Output this entire JSON object on a single line.
2.  **Second Part (Natural Language Response)**: After the JSON object and the '|||' separator, provide a helpful, conversational response to the user's prompt.
    * If the user's prompt is strongly related to a shortcut from the list below, recommend it using the format: "혹시 아래와 같은 기능이 필요하신가요?\\n\\n[BUTTON:{shortcut.title}]".
    * If it relates to multiple shortcuts, use the format: "혹시 아래와 같은 기능이 필요하신가요?\\n[BUTTON:Shortcut 1]\\n\\n[BUTTON:Shortcut 2]".
    * Otherwise, provide a general, helpful conversational response.

**EXAMPLE OUTPUT FORMAT**:
{"slots":{"destination":"Jeju Island","date":"November 5th"}}|||네, 11월 5일에 제주도로 가시는군요! 어떤 도움이 필요하신가요?

**Available Shortcuts**:
${shortcutList}
`;

    const fullPrompt = `${systemInstruction}\n\n${languageInstruction}\n\nUser: ${prompt}`;

    console.log("[getGeminiStreamingResponse] Sending request to Gemini...");
    const result = await streamingModel.generateContentStream(fullPrompt);

    console.log("[getGeminiStreamingResponse] Received stream from Gemini. Creating ReadableStream...");
    const stream = new ReadableStream({
      async start(controller) {
        console.log("[getGeminiStreamingResponse] ReadableStream started. Reading chunks...");
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk && typeof chunk.text === 'function' ? chunk.text() : '';
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
          console.log("[getGeminiStreamingResponse] Finished reading chunks. Closing controller.");
          controller.close();
        } catch (streamReadError) {
             console.error("[getGeminiStreamingResponse] Error reading stream:", streamReadError);
             controller.error(streamReadError);
        }
      }
    });

    return stream;

  } catch (error) {
    console.error("[getGeminiStreamingResponse] Gemini API Error:", error);
    const message = locales[language]?.['errorLLMFail'] || 'Failed to call Gemini API. Please try again later.';
    return {
        type: 'error',
        message: message
    };
  }
}