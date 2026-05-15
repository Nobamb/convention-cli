import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { info, warn } from "./logger.js";

// commit preview 이후 사용자가 선택할 수 있는 내부 decision 값입니다.
// 화면 텍스트와 실제 분기 값을 분리해 다국어 UI로 바뀌어도 command flow가 깨지지 않게 합니다.
export const COMMIT_DECISIONS = Object.freeze({
  // 현재 메시지로 staging과 commit을 진행합니다.
  COMMIT: "commit",
  // 같은 diff로 AI 메시지를 다시 생성합니다.
  REGENERATE: "regenerate",
  // 사용자가 커밋 메시지를 직접 수정합니다.
  EDIT: "edit",
  // staging/commit 없이 안전하게 종료합니다.
  CANCEL: "cancel",
});

/**
 * 로딩 표시 spinner 생성
 * @param {string} text 로딩 표시할 텍스트
 * @returns {ora.Ora}
 */
export function createSpinner(text) {
  // ora 객체 반환
  // text: 로딩 표시할 텍스트
  // color: 로딩 표시할 색상
  return ora({
    text,
    color: "cyan",
  });
}

/**
 * 커밋 메시지 생성 후 커밋 여부 확인
 * @param {string} message 커밋 메시지
 * @param {object} options 옵션
 * @param {string} options.file 파일명
 * @returns {Promise<boolean>}
 */
export async function confirmCommit(message, { file } = {}) {
  // 커밋 메시지 생성 후 커밋 여부 확인
  const displayMessage = file
    ? `\n${chalk.bold.cyan(`[${file}]`)} 커밋 메시지:\n${chalk.green(message)}\n\n이 메시지로 커밋할까요?`
    : `\n커밋 메시지:\n${chalk.green(message)}\n\n이 메시지로 커밋할까요?`;

  // 커밋 메시지 생성 후 커밋 여부 확인
  const response = await prompts({
    type: "confirm",
    name: "confirmed",
    message: displayMessage,
    initial: true,
  });

  // true 반환
  return response.confirmed === true;
}

/**
 * Show a safe preview of the generated commit message before staging or commit.
 *
 * This intentionally prints only metadata, file names, and the final message.
 * It must never receive or print raw diff contents.
 *
 * @param {object} options
 * @param {string} options.message
 * @param {string[]} [options.files]
 * @param {string} [options.mode]
 * @param {string} [options.provider]
 * @param {string} [options.modelVersion]
 */
export function previewCommitMessage({
  message,
  files = [],
  mode,
  provider,
  modelVersion,
} = {}) {
  // 메시지가 비어 있어도 preview 함수 자체는 터지지 않게 표시용 fallback을 사용합니다.
  // 실제 commit 여부는 command flow에서 빈 메시지 검증으로 차단합니다.
  const displayMessage =
    typeof message === "string" && message.trim().length > 0
      ? message.trim()
      : "(empty commit message)";
  // 파일 목록은 문자열이고 비어 있지 않은 값만 표시합니다.
  // diff 원문은 절대 받거나 출력하지 않고 파일명 metadata만 보여줍니다.
  const displayFiles = Array.isArray(files)
    ? files.filter((file) => typeof file === "string" && file.trim().length > 0)
    : [];
  // provider와 modelVersion이 있을 때만 "provider / model" 형태로 노출합니다.
  // config 전체를 출력하지 않아 baseURL/API key 같은 민감 정보가 섞이지 않게 합니다.
  const modelLabel = [provider, modelVersion].filter(Boolean).join(" / ");

  // logger.info는 내부에서 secret-like 값을 redact하므로 파일명/메시지에 민감 패턴이 있어도 마스킹됩니다.
  info("Commit preview");
  info(`Message: ${displayMessage}`);

  if (displayFiles.length > 0) {
    info("Files:");
    for (const file of displayFiles) {
      // 변경 파일은 사용자가 커밋 범위를 확인할 수 있도록 한 줄씩 출력합니다.
      info(`- ${file}`);
    }
  } else {
    info("Files: none");
  }

  if (mode) {
    info(`Mode: ${mode}`);
  }

  if (modelLabel) {
    info(`AI: ${modelLabel}`);
  }
}

/**
 * Ask the user how to proceed after previewing a commit message.
 *
 * @returns {Promise<string>} One of COMMIT_DECISIONS values.
 */
export async function selectCommitDecision() {
  try {
    // prompts select의 반환값은 COMMIT_DECISIONS 값으로 고정합니다.
    // 이렇게 해야 command 계층이 UI 문구가 아니라 안정적인 enum으로 분기할 수 있습니다.
    const response = await prompts(
      {
        type: "select",
        name: "decision",
        message: "How would you like to proceed?",
        choices: [
          { title: "Commit", value: COMMIT_DECISIONS.COMMIT },
          { title: "Regenerate", value: COMMIT_DECISIONS.REGENERATE },
          { title: "Edit manually", value: COMMIT_DECISIONS.EDIT },
          { title: "Cancel", value: COMMIT_DECISIONS.CANCEL },
        ],
        initial: 0,
      },
      {
        // Ctrl+C/ESC 등 취소 상황은 승인으로 취급하지 않고 질문을 중단합니다.
        onCancel: () => false,
      },
    );

    // 예상한 decision 값이면 그대로 반환하고, undefined/이상값이면 안전한 cancel로 처리합니다.
    return Object.values(COMMIT_DECISIONS).includes(response?.decision)
      ? response.decision
      : COMMIT_DECISIONS.CANCEL;
  } catch {
    return COMMIT_DECISIONS.CANCEL;
  }
}

/**
 * Prompt for a manually edited commit message.
 *
 * @param {string} currentMessage
 * @returns {Promise<string|null>} Trimmed message, or null when canceled/blank.
 */
export async function promptCommitMessageEdit(currentMessage = "") {
  try {
    // 기존 AI 메시지를 initial 값으로 넣어 사용자가 필요한 부분만 수정할 수 있게 합니다.
    const response = await prompts(
      {
        type: "text",
        name: "message",
        message: "Edit commit message",
        initial: typeof currentMessage === "string" ? currentMessage : "",
      },
      {
        // 수동 수정 prompt가 취소되면 commit을 진행하지 않도록 null 반환 흐름으로 보냅니다.
        onCancel: () => false,
      },
    );

    // prompts가 취소되면 response.message가 없을 수 있으므로 null로 통일합니다.
    if (typeof response?.message !== "string") {
      return null;
    }

    // 앞뒤 공백만 제거합니다. 실제 AI 응답 정리(cleanAIResponse)는 command flow에서 한 번 더 수행합니다.
    const editedMessage = response.message.trim();
    if (editedMessage.length === 0) {
      // 빈 commit message는 Git에서도 실패하므로 UI 단계에서 먼저 차단합니다.
      warn("Commit message edit was empty. Commit canceled.");
      return null;
    }

    return editedMessage;
  } catch {
    return null;
  }
}

/**
 * 이미 저장된 API Key를 교체할지 확인합니다.
 *
 * 실제 key 값은 credentials 저장소 안에만 두고, 화면에는 provider 이름만 보여줍니다.
 * 사용자가 거절하면 기존 key를 그대로 사용하며 추가 secret 입력 prompt를 띄우지 않습니다.
 */
export async function confirmReplaceApiKey(provider) {
  const response = await prompts({
    type: "confirm",
    name: "replaceApiKey",
    message: `${provider} API Key가 이미 저장되어 있습니다. 새 API Key로 교체할까요?`,
    initial: false,
  });

  return response.replaceApiKey === true;
}

/**
 * HTTP 429(사용량 소진) 또는 연결 실패 같은 AI Provider 오류가 발생했을 때 다음 행동을 선택합니다.
 *
 * @param {object} options
 * @param {string} [options.message] 사용자에게 보여줄 안내 문구 (기본값은 429 기준)
 * @param {boolean} [options.allowApiKey] API Key 교체 선택지를 보여줄지 여부
 * @param {boolean} [options.allowRetry] 현재 설정 그대로 다시 시도할 선택지를 보여줄지 여부
 * @returns {Promise<string>} 선택한 동작 ('retry', 'replaceApiKey', 'switchModel', 'stop')
 */
export async function selectAIUsageExhaustedAction({
  message = "AI Provider 사용량 한도 또는 rate limit에 도달했습니다. 어떻게 진행할까요?",
  allowApiKey = false,
  allowRetry = false,
} = {}) {
  const choices = [];

  // 로컬 서버 기동 확인 후 바로 다시 찌르고 싶을 때를 위해 '재시도' 옵션을 추가할 수 있습니다.
  if (allowRetry) {
    choices.push({
      title: "현재 설정으로 다시 시도",
      value: "retry",
    });
  }

  // API Key가 필요한 provider(Gemini 등)에서만 "다른 API Key 입력" 선택지를 보여줍니다.
  if (allowApiKey) {
    choices.push({
      title: "다른 API Key 입력 후 재시도",
      value: "replaceApiKey",
    });
  }

  choices.push(
    {
      title: "Provider/모델 설정을 바꾼 뒤 재시도",
      value: "switchModel",
    },
    {
      title: "커밋하지 않고 안전하게 중단",
      value: "stop",
    },
  );

  const response = await prompts({
    type: "select",
    name: "action",
    message,
    choices,
  });

  // 선택이 취소되거나 유효하지 않은 응답인 경우 'stop'을 반환하여 안전하게 종료를 유도합니다.
  return choices.some((choice) => choice.value === response.action)
    ? response.action
    : "stop";
}

/**
 * 일반적인 위험 작업을 실행하기 전에 사용자 확인을 받습니다.
 *
 * commit confirm과 분리해 둔 이유는 reset, push 같은 Git 히스토리 관련 작업이
 * commit message 표시 UI와 다른 문구를 가져야 하기 때문입니다. 기본 선택값은 false로 두어
 * 사용자가 실수로 Enter를 눌렀을 때 reset 같은 작업이 바로 실행되지 않게 합니다.
 *
 * @param {string} message 사용자에게 보여줄 확인 문구
 * @returns {Promise<boolean>} 사용자가 명시적으로 승인하면 true
 */
export async function confirmAction(message) {
  try {
    const response = await prompts(
      {
        type: "confirm",
        name: "confirmed",
        message,
        initial: false,
      },
      {
        // Ctrl+C, ESC, 테스트 주입 Error처럼 prompt가 취소되는 상황은 승인으로 볼 수 없습니다.
        // prompts는 onCancel이 true를 반환하면 질문 흐름을 계속 진행하므로 false를 반환해
        // 지금까지의 응답만 받고 종료시킨 뒤 아래에서 명시적인 true 여부만 확인합니다.
        onCancel: () => false,
      },
    );

    // 응답 객체가 비어 있거나 confirmed가 undefined인 경우도 모두 거부로 처리합니다.
    // reset/push 같은 위험 작업은 사용자가 명확히 Yes를 고른 경우에만 실행되어야 합니다.
    return response?.confirmed === true;
  } catch {
    // prompt 구성 오류나 예외가 발생해도 위험 작업을 진행하지 않도록 안전한 기본값을 반환합니다.
    return false;
  }
}

/**
 * baseURL에서 안전한 endpoint 레이블 생성
 * @param {string} baseURL
 * @returns {string|null}
 */
function safeEndpointLabel(baseURL) {
  // baseURL이 string 타입이 아니거나 빈 문자열이면 null 반환
  if (typeof baseURL !== "string" || baseURL.trim().length === 0) {
    return null;
  }

  try {
    // URL 파싱
    const parsedURL = new URL(baseURL);
    // username, password 제거
    parsedURL.username = "";
    parsedURL.password = "";
    // search 제거
    parsedURL.search = "";
    // hash 제거
    parsedURL.hash = "";
    // 결과 반환
    return parsedURL.toString().replace(/\/$/u, "");
  } catch {
    // 에러 발생 시
    return "configured custom endpoint";
  }
}

/**
 * http 통신인지 확인
 * @param {string} baseURL
 * @returns {boolean}
 */
function isPlainHttpEndpoint(baseURL) {
  // baseURL을 URL 객체로 변환
  try {
    // http 프로토콜인지 확인
    return new URL(baseURL).protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * 외부 AI 전송 메시지 생성
 * @param {*} param0
 * @param {string} param0.provider
 * @param {string} param0.file
 * @param {string} param0.baseURL
 * @returns {string}
 */
export function buildExternalAITransmissionMessage({
  provider,
  file,
  baseURL,
  warning,
} = {}) {
  // target 정의
  const target = file ? `${chalk.bold.cyan(`[${file}]`)} diff` : "Git diff";
  // provider 이름
  const providerName = provider || "external AI";
  // endpoint
  const endpoint =
    provider === "openaiCompatible" ? safeEndpointLabel(baseURL) : null;
  // endpoint 텍스트
  const endpointText = endpoint ? ` Endpoint: ${endpoint}.` : "";
  // http 경고
  const httpWarning =
    provider === "openaiCompatible" && isPlainHttpEndpoint(baseURL)
      ? " Warning: this endpoint uses unencrypted HTTP."
      : "";
  // 추가 경고 메시지
  const customWarning = warning ? `\n\n  ${chalk.bold.red(warning)}\n\n  ` : "";
  
  // 외부 AI 전송 메시지 반환
  return `${customWarning}Send ${target} to external AI provider "${providerName}"?${endpointText}${httpWarning}`;
}

/**
 * 외부 AI 전송 확인
 *
 * @param {object} options
 * @param {string} options.provider
 * @param {string} [options.file]
 * @param {string} [options.baseURL]
 * @returns {Promise<boolean>}
 */
export async function confirmExternalAITransmission(options = {}) {
  // 외부 AI 전송 메시지 생성
  const response = await prompts({
    type: "confirm",
    name: "confirmed",
    message: buildExternalAITransmissionMessage(options),
    initial: false,
  });
  // 확인된 값 반환
  return response.confirmed === true;
}

/**
 * select choices 변환
 * @param {string[]} values
 * @returns {{title: string, value: string}[]}
 */
export function buildExternalProviderRequestMessage({
  provider,
  action = "request",
  baseURL,
} = {}) {
  // 외부 provider에 대한 요청 메시지
  const providerName = provider || "external AI";
  // endpoint
  const endpoint =
    provider === "openaiCompatible" ? safeEndpointLabel(baseURL) : null;
  // endpoint 텍스트
  const endpointText = endpoint ? ` Endpoint: ${endpoint}.` : "";
  // http 경고
  const httpWarning =
    provider === "openaiCompatible" && isPlainHttpEndpoint(baseURL)
      ? " Warning: this endpoint uses unencrypted HTTP."
      : "";
  // 외부 provider에 대한 요청 메시지 반환
  return `Allow "${providerName}" to ${action}?${endpointText}${httpWarning}`;
}

/**
 * 외부 provider 요청 확인
 * @param {object} options
 * @param {string} options.provider
 * @param {string} [options.action="request"]
 * @param {string} [options.baseURL]
 * @returns {Promise<boolean>}
 */
export async function confirmExternalProviderRequest(options = {}) {
  // 외부 provider 요청 확인
  const response = await prompts({
    // confirm 타입
    type: "confirm",
    // confirm 이름
    name: "confirmed",
    // 메시지
    message: buildExternalProviderRequestMessage(options),
    // 초기값
    initial: false,
  });

  // confirmed값 true 반환
  return response.confirmed === true;
}

/**
 * select choices 변환
 * @param {string[]} values
 * @returns {{title: string, value: string}[]}
 */

export function toSelectChoices(values) {
  // values를 select choices로 변환
  return values.map((value) => ({
    // title: 선택할 때 표시할 텍스트
    // value: 선택한 값
    title: value,
    value,
  }));
}

/**
 * 커밋 메시지 생성 후 커밋 여부를 물어볼지 선택
 *
 * @param {boolean} currentValue 기본값
 * @returns {Promise<boolean>}
 */
export async function selectConfirmBeforeCommit(currentValue = true) {
  // 커밋 메시지 생성 후 커밋 여부를 물어볼지 선택
  const response = await prompts({
    type: "select",
    name: "confirmBeforeCommit",
    message: "커밋 메시지 생성 후 커밋 여부를 물어볼까요?",
    choices: [
      { title: "true - 커밋 전에 물어보기", value: true },
      { title: "false - 묻지 않고 바로 커밋", value: false },
    ],
    initial: currentValue === false ? 1 : 0,
  });

  // boolean 타입이 아니면 에러 발생
  if (typeof response.confirmBeforeCommit !== "boolean") {
    throw new Error("커밋 확인 설정이 취소되었습니다.");
  }

  // boolean 반환
  return response.confirmBeforeCommit;
}
/**
 * 외부 AI 전송 시 사용자 확인 여부를 설정합니다.
 *
 * @param {string} currentValue 기본값
 * @returns {Promise<string>}
 */
export async function selectConfirmExternalTransmission(
  currentValue = "always",
) {
  const response = await prompts({
    type: "select",
    name: "confirmExternalTransmission",
    message: "외부 AI Provider로 코드를 보낼 때 확인 절차를 어떻게 할까요?",
    choices: [
      { title: "always - 매 파일마다 물어보기 (가장 안전)", value: "always" },
      { title: "once   - 첫 파일에서만 물어보기 (추천)", value: "once" },
      { title: "never  - 묻지 않고 바로 전송", value: "never" },
    ],
    initial: ["always", "once", "never"].indexOf(currentValue) || 0,
  });

  if (typeof response.confirmExternalTransmission !== "string") {
    throw new Error("외부 전송 확인 설정이 취소되었습니다.");
  }

  return response.confirmExternalTransmission;
}

/**
 * 사용할 모델 선택
 * @param {string[]} models 모델 목록
 * @returns {Promise<string>} 선택한 모델
 */
export async function selectModelVersion(models) {
  // 모델 목록이 없으면 에러 발생
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("선택할 수 있는 모델 목록이 없습니다.");
  }

  // 사용할 모델 선택
  const response = await prompts({
    type: "select",
    name: "modelVersion",
    message: "사용할 모델을 선택하세요.",
    choices: toSelectChoices(models),
  });

  // 모델 선택이 취소되면 에러 발생
  if (
    typeof response.modelVersion !== "string" ||
    response.modelVersion.trim().length === 0
  ) {
    throw new Error("모델 선택이 취소되었습니다.");
  }

  // string 반환
  return response.modelVersion;
}

/**
 * secret value 입력받기
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function promptSecret(message) {
  // secret value 입력받기
  const response = await prompts({
    // password 타입
    type: "password",
    // 입력값
    name: "secret",
    // 메시지
    message,
  });

  // secret value가 string 타입이 아니거나
  // 빈 문자열이면 에러 발생
  if (
    typeof response.secret !== "string" ||
    response.secret.trim().length === 0
  ) {
    throw new Error("secret value must be a non-empty string");
  }

  // trim 처리 후 반환
  return response.secret.trim();
}

/**
 * 사용할 AI Provider 선택
 * @param {string[]} providers
 * @returns {Promise<string>}
 */
export async function selectProvider(providers) {
  const response = await prompts({
    type: "select",
    name: "provider",
    message: "사용할 AI 에이전트를 선택하세요.",
    choices: toSelectChoices(providers),
  });

  if (typeof response.provider !== "string") {
    throw new Error("Provider 선택이 취소되었습니다.");
  }

  return response.provider;
}

/**
 * 인증 방식 선택
 * @param {string[]} authTypes
 * @returns {Promise<string>}
 */
export async function selectAuthType(authTypes) {
  const response = await prompts({
    type: "select",
    name: "authType",
    message: "인증 방식을 선택하세요.",
    choices: toSelectChoices(authTypes),
  });

  if (typeof response.authType !== "string") {
    throw new Error("인증 방식 선택이 취소되었습니다.");
  }

  return response.authType;
}
