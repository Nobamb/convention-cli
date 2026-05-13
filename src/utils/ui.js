import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";

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
