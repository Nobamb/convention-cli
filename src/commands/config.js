import { loadConfig, saveConfig } from "../config/store.js";
import { error, info, success } from "../utils/logger.js";
import {
  selectConfirmBeforeCommit,
  selectConfirmExternalTransmission,
} from "../utils/ui.js";
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
 * 커밋 전 확인 질문 및 외부 전송 확인 여부를 설정합니다.
 *
 * @param {Object} options 설정 옵션
 * @param {boolean} [options.confirmBeforeCommit] 커밋 전 확인 질문 여부
 * @param {string} [options.confirmExternalTransmission] 외부 전송 확인 여부
 */
export const setQuestion = ({
  confirmBeforeCommit,
  confirmExternalTransmission,
}) => {
  const config = loadConfig();
  const newConfig = { ...config };

  if (typeof confirmBeforeCommit === "boolean") {
    newConfig.confirmBeforeCommit = confirmBeforeCommit;
  }

  if (
    ["always", "once", "never"].includes(confirmExternalTransmission)
  ) {
    newConfig.confirmExternalTransmission = confirmExternalTransmission;
  }

  saveConfig(newConfig);

  success("질문 관련 설정이 갱신되었습니다.");
  if (typeof confirmBeforeCommit === "boolean") {
    info(
      `- 커밋 전 확인: ${confirmBeforeCommit ? "사용함" : "사용 안 함 (바로 커밋)"}`,
    );
  }
  if (confirmExternalTransmission) {
    info(`- 외부 AI 전송 확인: ${confirmExternalTransmission}`);
  }
};

/**
 * 저장된 설정을 불러와 커밋 전 확인 질문 및 외부 전송 확인 설정을 대화형으로 진행합니다.
 */
export async function runQuestionSetup() {
  const config = loadConfig();

  // 1. 커밋 전 확인 질문 여부
  const confirmBeforeCommit = await selectConfirmBeforeCommit(
    config.confirmBeforeCommit,
  );

  // 2. 외부 AI 전송 확인 여부
  const confirmExternalTransmission = await selectConfirmExternalTransmission(
    config.confirmExternalTransmission,
  );

  // 설정 저장
  setQuestion({ confirmBeforeCommit, confirmExternalTransmission });

  return {
    ...config,
    confirmBeforeCommit,
    confirmExternalTransmission,
  };
}
