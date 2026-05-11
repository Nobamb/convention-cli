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
    type: "password",
    name: "secret",
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
