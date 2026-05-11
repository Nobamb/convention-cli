import { getApiKey } from "../auth/apiKey.js";

// 기본 gemini 모델 버전
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
// 기본 타임아웃 시간
const DEFAULT_TIMEOUT_MS = 60000;
// gemini api base url
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * gemini 모델 버전을 가져오는 함수.
 * @param {*} config
 * @returns {string}
 */
function getModelVersion(config = {}) {
  // config에 modelVersion이 설정되어 있지 않으면
  // DEFAULT_GEMINI_MODEL(gemini-3.0-flash) 반환
  return config.modelVersion || DEFAULT_GEMINI_MODEL;
}

/**
 * GEMINI API 키를 가져오는 함수.
 *
 * @param {*} config
 * @returns {string}
 */
function getRequiredApiKey(config = {}) {
  const apiKey = config.apiKey ?? getApiKey("gemini");

  // API 키가 없으면 에러를 throw 한다.
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("Gemini API Key is required.");
  }

  // 공백을 제거하여 api 키 반환
  return apiKey.trim();
}

/**
 * gemini generateContent url을 만드는 함수.
 *
 * @param {*} modelVersion
 * @returns
 */

function buildGenerateURL(modelVersion) {
  // modelVersion을 url encode
  const encodedModel = encodeURIComponent(modelVersion);
  // gemini generateContent url 반환
  return `${GEMINI_API_BASE_URL}/models/${encodedModel}:generateContent`;
}

/**
 * gemini listModels url을 만드는 함수.
 *
 * @returns
 */

function buildListModelsURL() {
  return `${GEMINI_API_BASE_URL}/models`;
}

/**
 * gemini api 키와 헤더를 만드는 함수.
 *
 * @param {*} apiKey
 * @param {*} extraHeaders
 * @returns
 */

function buildApiKeyHeaders(apiKey, extraHeaders = {}) {
  return {
    ...extraHeaders,
    "x-goog-api-key": apiKey,
  };
}

/**
 * gemini api 요청 실패 시 메시지를 만드는 함수.
 *
 * @param {*} action
 * @param {*} response
 * @returns
 */

function buildRequestFailureMessage(action, response) {
  // response status가 정수이면 상태 코드와 함께 메시지를 만듦
  const status = Number.isInteger(response?.status)
    ? ` with status ${response.status}`
    : "";
  // gemini api 요청 실패 시 메시지를 반환
  return `Gemini ${action} request failed${status}.`;
}

/**
 * gemini api 응답에서 텍스트를 추출하는 함수.
 *
 * @param {*} payload
 * @returns
 */

function extractText(payload) {
  // payload에서 candidates의 첫 번째 요소의 content의 parts를 추출
  const parts = payload?.candidates?.[0]?.content?.parts;

  // parts가 배열이 아니면 빈 문자열 반환
  if (!Array.isArray(parts)) {
    return "";
  }

  // parts에서 텍스트를 추출하여 합친 후 반환
  return parts
    .map((part) => part?.text)
    .filter((text) => typeof text === "string" && text.trim().length > 0)
    .join("\n")
    .trim();
}

/**
 * gemini api 설정 검증 함수.
 *
 * @param {*} config
 * @returns
 */

export function validateConfig(config = {}) {
  // api 키를 가져와서 유효성을 검증
  getRequiredApiKey(config);
  return true;
}

/**
 * gemini api를 사용하여 commit 메시지를 생성하는 함수.
 *
 * @param {*} prompt
 * @param {*} config
 * @returns
 */

export async function generateCommitMessage({ prompt, config = {} }) {
  // prompt가 문자열이 아니거나 빈 문자열이면 에러를 throw 한다.
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("prompt must be a non-empty string");
  }

  // api 키, 모델 버전을 가져옴
  const apiKey = getRequiredApiKey(config);
  const modelVersion = getModelVersion(config);
  // controller, 타임아웃을 설정
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // fetch를 사용하여 gemini api 호출
  try {
    // gemini api 호출
    const response = await fetch(buildGenerateURL(modelVersion), {
      // POST 메서드(전송)
      method: "POST",
      // 헤더 설정(api 키, 콘텐츠 타입)
      headers: buildApiKeyHeaders(apiKey, {
        "content-type": "application/json",
      }),
      // 바디 설정(prompt, temperature)
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        // generationConfig를 사용하여 temperature를 0.2로 설정
        generationConfig: {
          temperature: 0.2,
        },
      }),
      //
      signal: controller.signal,
    });

    // 응답이 정상이 아닐 때 에러를 throw 한다.
    if (!response.ok) {
      throw new Error(buildRequestFailureMessage("commit message", response));
    }

    // 응답을 JSON으로 파싱
    const payload = await response.json();
    // 파싱한 응답에서 텍스트를 추출
    const message = extractText(payload);

    // 텍스트가 없으면 에러를 throw 한다.
    if (!message) {
      throw new Error("Gemini response did not include a commit message.");
    }

    // 추출된 텍스트를 반환
    return message;
  } finally {
    // 타임아웃을 클리어
    clearTimeout(timeout);
  }
}

/**
 * gemini api를 사용하여 모델 목록을 가져오는 함수.
 *
 * @param {*} config
 * @returns
 */

export async function listModels(config = {}) {
  // api 키를 가져옴
  const apiKey = getRequiredApiKey(config);
  // controller를 생성
  const controller = new AbortController();
  // 타임아웃을 설정
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // fetch를 사용하여 gemini api 호출
  try {
    // gemini api 호출
    const response = await fetch(buildListModelsURL(), {
      // GET 메서드(가져오기)
      method: "GET",
      // 헤더 설정(api 키, 콘텐츠 타입)
      headers: buildApiKeyHeaders(apiKey, { accept: "application/json" }),
      // abort 시그널
      signal: controller.signal,
    });

    // 응답이 정상이 아닐 때 에러를 throw 한다.
    if (!response.ok) {
      throw new Error(buildRequestFailureMessage("model list", response));
    }

    // 응답을 JSON으로 파싱
    const payload = await response.json();
    // 모델 목록을 가져옴
    const models = Array.isArray(payload?.models) ? payload.models : [];

    // 모델 목록을 반환
    return models
      .map((model) => model?.name?.replace(/^models\//u, ""))
      .filter((model) => typeof model === "string" && model.trim().length > 0);
  } finally {
    // 타임아웃을 클리어
    clearTimeout(timeout);
  }
}
