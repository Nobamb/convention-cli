import { getApiKey } from "../auth/apiKey.js";
import { isValidBaseURL } from "../utils/validator.js";
import { createProviderHTTPError } from "./errors.js";

// 로컬 서버가 꺼져 있거나 응답이 늦을 경우 CLI가 무한히 대기하는 것을 방지하기 위한 Timeout
// LLM의 생성(Inference) 작업은 시간이 오래 걸릴 수 있으므로 별도의 긴 타임아웃(기본 60초)을 설정합니다.
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * URL의 마지막 슬래시 제거
 * @param {string} value
 * @returns {string}
 */
function trimTrailingSlash(value) {
  return value.replace(/\/+$/u, "");
}

/**
 * OpenAI-compatible 모델 제공자 이름 반환
 * @param {object} config
 * @returns {string}
 */
function getProviderName(config = {}) {
  return config.provider || "openaiCompatible";
}

/**
 * OpenAI-compatible 필수 Base URL 추출
 * @param {object} config
 * @returns {string}
 */
function getRequiredBaseURL(config = {}) {
  // 설정 파일에 baseURL이 없으면
  // error throw
  if (!isValidBaseURL(config.baseURL)) {
    throw new Error("OpenAI-compatible baseURL must be a valid http(s) URL.");
  }

  // URL 파싱
  const parsedURL = new URL(config.baseURL.trim());
  // URL에 username, password, search, hash가 포함되어 있으면
  if (
    // username 추출
    parsedURL.username ||
    // password 추출
    parsedURL.password ||
    // search 추출
    parsedURL.search ||
    // hash 추출
    parsedURL.hash
  ) {
    // error throw
    throw new Error(
      "OpenAI-compatible baseURL must not include credentials, query parameters, or fragments.",
    );
  }

  // origin과 pathname을 합치고
  // 마지막 슬래시 제거
  return trimTrailingSlash(`${parsedURL.origin}${parsedURL.pathname}`);
}

/**
 * OpenAI-compatible 필수 모델 버전 추출
 * @param {object} config
 * @returns {string}
 */
function getRequiredModelVersion(config = {}) {
  // string 타입이 아니거나
  // 빈 문자열이거나
  // 공백만 있는 문자열이면
  // error throw
  if (
    typeof config.modelVersion !== "string" ||
    config.modelVersion.trim().length === 0
  ) {
    throw new Error("OpenAI-compatible modelVersion is required.");
  }

  return config.modelVersion.trim();
}

/**
 * OpenAI-compatible API Key 추출
 * @param {object} config
 * @returns {string | null}
 */
function getApiKeyForConfig(config = {}) {
  // 설정 파일에 apiKey가 없으면
  // getApiKey 함수를 통해
  const apiKey = config.apiKey ?? getApiKey(getProviderName(config));

  // string 타입이 아니거나
  // 빈 문자열이거나
  // 공백만 있는 문자열이면
  // null 반환
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return null;
  }

  // 공백 제거
  return apiKey.trim();
}

/**
 * OpenAI-compatible 헤더 빌드
 * string 타입이 아니거나
 * 빈 문자열이거나
 * 공백만 있는 문자열이면
 * null 반환
 * @param {object} config
 * @returns {object}
 */
function buildHeaders(config = {}) {
  // content-type 헤더
  const headers = { "content-type": "application/json" };
  // apiKey 추출
  const apiKey = getApiKeyForConfig(config);

  // apiKey가 있으면
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * OpenAI-compatible 설정 검증
 * @param {object} config
 * @returns {boolean}
 */
export function validateConfig(config = {}) {
  // baseURL 추출
  getRequiredBaseURL(config);
  // modelVersion 추출
  getRequiredModelVersion(config);
  return true;
}

/**
 * OpenAI-compatible 커밋 메시지 생성
 * @param {object} params
 * @param {string} params.prompt
 * @param {object} params.config
 * @returns {Promise<string>}
 */
export async function generateCommitMessage({ prompt, config = {} }) {
  // prompt가 string 타입이 아니거나
  // 빈 문자열이거나
  // 공백만 있는 문자열이면
  // error throw
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  // baseURL 추출
  const baseURL = getRequiredBaseURL(config);
  // modelVersion 추출
  const modelVersion = getRequiredModelVersion(config);
  // AbortController 생성
  const controller = new AbortController();
  // Timeout 설정
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    // fetch 요청
    const response = await fetch(`${baseURL}/chat/completions`, {
      // method
      method: "POST",
      // headers
      headers: buildHeaders(config),
      // body
      body: JSON.stringify({
        model: modelVersion,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      // signal
      signal: controller.signal,
    });

    // 실패 응답 body는 secret이나 raw prompt 일부를 포함할 수 있으므로 읽지 않고 status만 보존합니다.
    if (!response.ok) {
      throw createProviderHTTPError({
        provider: "OpenAI-compatible",
        action: "commit message",
        response,
      });
    }

    // json 파싱
    const payload = await response.json();
    // message 추출
    const message = payload?.choices?.[0]?.message?.content;

    // message가 string 타입이 아니거나
    // 빈 문자열이거나
    // 공백만 있는 문자열이면
    // error throw
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error(
        "OpenAI-compatible response did not include a commit message.",
      );
    }

    // 공백 제거 후 반환
    return message.trim();
  } finally {
    // Timeout 설정 해제
    clearTimeout(timeout);
  }
}

/**
 * OpenAI-compatible 모델 목록 조회
 * @param {object} config
 * @returns {Promise<string[]>}
 */
export async function listModels(config = {}) {
  // baseURL 추출
  const baseURL = getRequiredBaseURL(config);
  // AbortController 생성
  const controller = new AbortController();
  // Timeout 설정
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    // fetch 요청
    const response = await fetch(`${baseURL}/models`, {
      // method
      // method
      method: "GET",
      // headers
      headers: buildHeaders(config),
      // signal
      signal: controller.signal,
    });

    // 모델 목록 실패도 원문 body를 읽지 않고 status만 안전하게 전달합니다.
    if (!response.ok) {
      throw createProviderHTTPError({
        provider: "OpenAI-compatible",
        action: "model list",
        response,
      });
    }

    // json 파싱
    const payload = await response.json();
    // models 배열 추출
    const models = Array.isArray(payload?.data) ? payload.data : [];

    // model id 추출 후 string 타입이 아니거나 공백만 있는 문자열이면 제거 후 반환
    return models
      .map((model) => (typeof model === "string" ? model : model?.id))
      .filter((model) => typeof model === "string" && model.trim().length > 0);
  } finally {
    // Timeout 설정 해제
    clearTimeout(timeout);
  }
}
