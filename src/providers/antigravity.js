import { createProviderHTTPError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 60000;
const UNVERIFIED_API_MESSAGE =
  "Antigravity API is experimental and not confirmed to be OpenAI-compatible. Set experimentalAntigravity=true and provide an explicit baseURL to use it.";

/**
 * Antigravity는 공식 API baseURL과 OpenAI-compatible 계약이 아직 검증되지 않았습니다.
 * 그래서 기본 endpoint를 절대 추정하지 않고, 사용자가 실험 기능 opt-in과 baseURL을 둘 다 제공할 때만 요청합니다.
 *
 * @param {object} config
 * @returns {string}
 */
function resolveExperimentalBaseURL(config = {}) {
  if (config.experimentalAntigravity !== true) {
    throw new Error(UNVERIFIED_API_MESSAGE);
  }

  if (typeof config.baseURL !== "string" || config.baseURL.trim().length === 0) {
    throw new Error(UNVERIFIED_API_MESSAGE);
  }

  return config.baseURL.trim().replace(/\/+$/u, "");
}

/**
 * 현재 구현은 사용자가 명시한 endpoint가 OpenAI-compatible이라고 직접 검증한 경우에만 동작합니다.
 * 공식 계약이 나오기 전까지는 baseURL 기본값, 기본 모델명, 안정 기능처럼 보이는 fallback을 제공하지 않습니다.
 *
 * @param {object} params
 * @param {string} params.prompt
 * @param {object} params.config
 * @param {object} params.headers
 * @returns {Promise<string>}
 */
export async function generateCommitMessage({ prompt, config = {}, headers = {} }) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  const baseURL = resolveExperimentalBaseURL(config);
  const modelVersion = config.modelVersion;
  if (typeof modelVersion !== "string" || modelVersion.trim().length === 0) {
    throw new Error("Antigravity experimental requests require an explicit modelVersion.");
  }

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
        model: modelVersion.trim(),
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
 * 모델 목록 조회도 명시 opt-in/baseURL 없이는 외부 요청을 하지 않습니다.
 *
 * @param {object} config
 * @param {object} options
 * @param {object} options.headers
 * @returns {Promise<string[]>}
 */
export async function listModels(config = {}, { headers = {} } = {}) {
  const baseURL = resolveExperimentalBaseURL(config);
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

export function validateConfig(config = {}) {
  resolveExperimentalBaseURL(config);
  return true;
}
