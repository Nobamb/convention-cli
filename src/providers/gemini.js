import { getApiKey } from "../auth/apiKey.js";

// 기본 모델
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
// 기본 타임아웃 시간
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * 모델 버전을 가져온다.
 * @param {*} config
 * @returns {string}
 */

function getModelVersion(config = {}) {
  return config.modelVersion || DEFAULT_GEMINI_MODEL;
}

/**
 * API 키를 가져온다.
 * config에 apiKey가 설정되어 있지 않으면 "gemini" provider의 API 키를 가져온다.
 * @param {*} config
 * @returns {string}
 */

function getRequiredApiKey(config = {}) {
  // config에 apiKey가 설정되어 있지 않으면 "gemini" provider의 API 키를 가져온다.
  const apiKey = config.apiKey ?? getApiKey("gemini");

  // API 키가 없으면 에러를 throw 한다.
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("Gemini API Key is required.");
  }

  // 공백 제거 후 반환한다.
  return apiKey.trim();
}

/**
 * generate API 호출을 위한 URL을 생성한다.
 * @param {*} modelVersion
 * @param {*} apiKey
 * @returns {string}
 */

function buildGenerateURL(modelVersion, apiKey) {
  // 모델 버전 인코딩
  const encodedModel = encodeURIComponent(modelVersion);
  // API 키 인코딩
  const encodedKey = encodeURIComponent(apiKey);
  // generate API URL 생성
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
}

/**
 * 응답에서 텍스트를 추출한다.
 * payload 구조:
 * ```
 * {
 *  candidates: [
 *   {
 *     content: {
 *       parts: [
 *         { text: "..." },
 *         ...
 *       ]
 *     }
 *   }
 *  ]
 * }
 * ```
 * @param {*} payload
 * @returns {string}
 */

function extractText(payload) {
  // 응답에서 텍스트를 추출한다.
  const parts = payload?.candidates?.[0]?.content?.parts;

  // parts가 배열이 아니면 빈 문자열을 반환한다.
  if (!Array.isArray(parts)) {
    return "";
  }

  // 각 파트에서 텍스트를 추출하고, 공백이 아닌 것만 반환한다.
  return parts
    .map((part) => part?.text)
    .filter((text) => typeof text === "string" && text.trim().length > 0)
    .join("\n")
    .trim();
}

/**
 * 설정이 올바른지 검증한다.
 * @param {*} config
 * @returns {boolean}
 */

export function validateConfig(config = {}) {
  // API 키가 올바른지 검증한다.
  getRequiredApiKey(config);
  // 설정이 올바르면 true를 반환한다.
  return true;
}

/**
 * 프롬프트로 커밋 메시지를 생성한다.
 *
 * @param {*} prompt
 * @param {*} config
 * @returns {Promise<string>}
 */

export async function generateCommitMessage({ prompt, config = {} }) {
  // prompt가 유효한 문자열인지 검증한다.
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("prompt must be a non-empty string");
  }

  // API 키를 가져온다.
  const apiKey = getRequiredApiKey(config);
  // 모델 버전을 가져온다.
  const modelVersion = getModelVersion(config);
  // AbortController를 생성한다.
  const controller = new AbortController();
  // 타임아웃을 설정한다.
  const timeout = setTimeout(
    // 타임아웃이 발생하면 AbortController를 호출하여 요청을 중단한다.
    () => controller.abort(),
    // 타임아웃 시간은 설정에서 가져오고, 없으면 기본값을 사용한다.
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // generate API 호출
  try {
    // generate API 호출
    const response = await fetch(buildGenerateURL(modelVersion, apiKey), {
      // POST 메소드 사용
      method: "POST",
      // 헤더 설정
      headers: { "content-type": "application/json" },
      // 요청 본문
      body: JSON.stringify({
        // 콘텐츠 설정
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        // 생성 설정
        generationConfig: {
          // 온도 설정
          // temperature는 0에서 2 사이의 값으로, 낮을수록 예측 가능하고 일관적인 출력을, 높을수록 창의적이고 다양한 출력을 생성한다.
          // 커밋메세지는 정형화된 답변이 나오도록 낮은 값으로 설정한다.
          temperature: 0.2,
        },
      }),
      // AbortController 설정
      signal: controller.signal,
    });

    // 응답이 성공하지 않으면 에러를 throw 한다.
    if (!response.ok) {
      // 에러 메시지 생성
      const errorText = await response.text();
      throw new Error("Gemini commit message request failed: " + errorText);
    }

    // 응답에서 커밋 메시지를 추출한다.
    const payload = await response.json();
    const message = extractText(payload);

    // 커밋 메시지가 없으면 에러를 throw 한다.
    if (!message) {
      throw new Error("Gemini response did not include a commit message.");
    }

    // 커밋 메시지를 반환한다.
    return message;
  } finally {
    // 타임아웃을 클리어한다.
    clearTimeout(timeout);
  }
}

/**
 * 모델 목록을 가져온다.
 * @param {*} config
 * @returns {Promise<string[]>}
 */

export async function listModels(config = {}) {
  // API 키를 가져온다.
  const apiKey = getRequiredApiKey(config);
  // AbortController를 생성한다.
  const controller = new AbortController();
  // 타임아웃을 설정한다.
  const timeout = setTimeout(
    // 타임아웃이 발생하면 AbortController를 호출하여 요청을 중단한다.
    () => controller.abort(),
    // 타임아웃 시간은 설정에서 가져오고, 없으면 기본값을 사용한다.
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // 모델 목록 API 호출
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        // GET 메소드 사용
        method: "GET",
        // 헤더 설정
        headers: { accept: "application/json" },
        // AbortController 설정
        signal: controller.signal,
      },
    );

    // 응답이 성공하지 않으면 에러를 throw 한다.
    if (!response.ok) {
      // 에러 메시지 생성
      const errorText = await response.text();
      throw new Error("Gemini model list request failed: " + errorText);
    }

    // 응답에서 모델 목록을 추출한다.
    const payload = await response.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];

    // 모델 목록을 반환한다.
    return models
      .map((model) => model?.name?.replace(/^models\//u, ""))
      .filter((model) => typeof model === "string" && model.trim().length > 0);
  } finally {
    // 타임아웃을 클리어한다.
    clearTimeout(timeout);
  }
}
