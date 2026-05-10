import { loadConfig, saveConfig } from "../config/store.js";
import { error, success } from "../utils/logger.js";
import { selectConfirmBeforeCommit } from "../utils/ui.js";
import { isValidLanguage, isValidMode } from "../utils/validator.js";

export const setMode = (mode) => {
  // 1차 MVP에서 허용하는 기본 실행 모드는 step과 batch뿐입니다.
  // 잘못된 값이면 기존 config 파일을 변경하지 않고 안내 메시지만 출력합니다.
  if (!isValidMode(mode)) {
    error("지원하지 않는 mode입니다. 사용 가능 값: step, batch");
    return;
  }

  // 기존 설정을 먼저 불러와 language, provider placeholder 같은 다른 필드를 유지합니다.
  const config = loadConfig();

  // mode 필드만 새 값으로 바꾼 뒤 Phase H의 저장 함수를 통해 config.json에 기록합니다.
  saveConfig({
    ...config,
    mode,
  });

  success(`기본 실행 모드가 ${mode}로 저장되었습니다.`);
};

export const setLanguage = (language) => {
  // 1차 MVP에서 허용하는 커밋 메시지 언어는 ko, en, jp, cn뿐입니다.
  // 잘못된 값이면 기존 config 파일을 변경하지 않고 안내 메시지만 출력합니다.
  if (!isValidLanguage(language)) {
    error("지원하지 않는 language입니다. 사용 가능 값: ko, en, jp, cn");
    return;
  }

  // 기존 설정을 먼저 불러와 mode, provider placeholder 같은 다른 필드를 유지합니다.
  const config = loadConfig();

  // language 필드만 새 값으로 바꾼 뒤 Phase H의 저장 함수를 통해 config.json에 기록합니다.
  saveConfig({
    ...config,
    language,
  });
  // 성공 로그
  success(`커밋 메시지 언어가 ${language}로 저장되었습니다.`);
};

/**
 * 커밋 전 확인 질문을 설정합니다.
 *
 * @param {boolean} confirmBeforeCommit 커밋 전 확인 질문 여부를 설정합니다.
 * @returns
 */
export const setQuestion = (confirmBeforeCommit) => {
  // 입력값이 boolean이 아닐 경우 에러 메시지 출력 후 종료
  if (typeof confirmBeforeCommit !== "boolean") {
    error("confirmBeforeCommit 값은 true 또는 false여야 합니다.");
    return;
  }
  // 기존 설정 파일을 불러와서
  const config = loadConfig();

  // confirmBeforeCommit 필드만 새 값으로 바꾼 뒤 saveConfig 함수를 통해 config.json에 기록합니다.
  saveConfig({
    ...config,
    confirmBeforeCommit,
  });

  // 성공 로그 출력
  success(
    confirmBeforeCommit
      ? "커밋 전 확인 질문을 사용하도록 저장되었습니다."
      : "커밋 전 확인 질문 없이 바로 커밋하도록 저장되었습니다.",
  );
};

/**
 * 저장된 설정을 불러와 커밋 전 확인 질문을 설정합니다.
 * @returns
 */
export async function runQuestionSetup() {
  // 기존 설정 파일을 불러와서
  const config = loadConfig();
  // 대화형 ui를 통해 커밋 전 확인 질문 여부를 설정합니다.
  const confirmBeforeCommit = await selectConfirmBeforeCommit(
    config.confirmBeforeCommit,
  );

  // 설정 값을 저장
  setQuestion(confirmBeforeCommit);

  // 성공적으로 설정된 값을 반환
  return {
    ...config,
    confirmBeforeCommit,
  };
}
