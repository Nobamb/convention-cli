import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";

/**
 * 텍스트를 받아서 로딩 스피너를 생성합니다.
 * @param {string} text
 * @returns
 */
export function createSpinner(text) {
  return ora({
    text,
    color: "cyan",
  });
}

/**
 * 커밋 메시지를 확인하는 함수입니다.
 * @param {string} message - 커밋 메시지
 * @param {string} file - 파일 이름
 * @returns {Promise<boolean>} 커밋 여부
 */
export async function confirmCommit(message, { file } = {}) {
  const displayMessage = file
    ? `\n${chalk.bold.cyan(`[${file}]`)} 커밋 메시지:\n${chalk.green(message)}\n\n이 메시지로 커밋할까요?`
    : `\n커밋 메시지:\n${chalk.green(message)}\n\n이 메시지로 커밋할까요?`;

  // prompts를 사용해서 커밋 메시지를 확인합니다.
  const response = await prompts({
    type: "confirm",
    name: "confirmed",
    message: displayMessage,
    initial: true,
  });

  return response.confirmed === true;
}

/**
 * 배열 형태의 값을 `prompts` 라이브러리의 select 타입에서 사용할 수 있는 choices 형식으로 변환합니다.
 * UI 구현체(prompts)의 데이터 구조를 이 유틸 함수에 격리하여 command 계층의 복잡도를 낮춥니다.
 * @param {string[]} values - 선택할 값들의 배열
 * @returns {object[]} choices 배열
 */
export function toSelectChoices(values) {
  return values.map((value) => ({
    title: value,
    value,
  }));
}

/**
 * 특정 Provider(주로 localLLM)에서 조회한 모델 목록을 사용자에게 보여주고 하나를 선택하게 합니다.
 *
 * [상세 설명]
 * - 방향키로 선택할 수 있는 select UI를 제공합니다.
 * - 선택 결과가 없거나 취소된 경우 명확한 에러를 던져 상위 flow를 중단시킵니다.
 */
export async function selectModelVersion(models) {
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("선택할 수 있는 모델 목록이 없습니다.");
  }

  // prompts를 사용해서 모델 버전을 선택합니다.
  const response = await prompts({
    type: "select",
    name: "modelVersion",
    message: "사용할 로컬 모델을 선택하세요",
    choices: toSelectChoices(models),
  });

  // 사용자가 ESC 등을 눌러 선택을 취소한 경우 처리
  if (
    typeof response.modelVersion !== "string" ||
    response.modelVersion.trim().length === 0
  ) {
    throw new Error("모델 선택이 취소되었습니다.");
  }

  // 모델 버전 반환
  return response.modelVersion;
}
