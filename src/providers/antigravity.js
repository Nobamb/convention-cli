import { createProviderHTTPError } from "./errors.js";

// 기본 타임아웃 60초
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Antigravity API를 호출하여 AI 기반 커밋 메시지를 생성합니다.
 *
 * @param {object} params
 * @param {string} params.prompt - AI에게 전달할 프롬프트
 * @param {object} params.config - 사용자 설정
 * @param {object} params.headers - OAuth Authorization 헤더를 포함한 HTTP 요청 헤더 객체
 * @returns {Promise<string>} 생성된 커밋 메시지
 */
export async function generateCommitMessage({ prompt, config = {}, headers = {} }) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  // baseURL이 없을 경우 기본 공식 도메인 API endpoint 사용
  const baseURL = config.baseURL ? config.baseURL.replace(/\/+$/u, "") : "https://api.antigravity.ai/v1";
  const modelVersion = config.modelVersion || "antigravity-1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        model: modelVersion,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createProviderHTTPError({
        provider: "Antigravity",
        action: "commit message",
        response,
      });
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message?.content;

    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error("Antigravity response did not include a commit message.");
    }

    return message.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Antigravity API로부터 사용 가능한 모델 목록을 조회합니다.
 *
 * @param {object} config - 사용자 설정
 * @param {object} options
 * @param {object} options.headers - OAuth Authorization 헤더를 포함한 HTTP 요청 헤더 객체
 * @returns {Promise<string[]>} 모델 목록 배열
 */
export async function listModels(config = {}, { headers = {} } = {}) {
  const baseURL = config.baseURL ? config.baseURL.replace(/\/+$/u, "") : "https://api.antigravity.ai/v1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseURL}/models`, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createProviderHTTPError({
        provider: "Antigravity",
        action: "model list",
        response,
      });
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];

    return models
      .map((model) => (typeof model === "string" ? model : model?.id))
      .filter((model) => typeof model === "string" && model.trim().length > 0);
  } finally {
    clearTimeout(timeout);
  }
}
