import { loadConfig, saveConfig } from '../config/store.js';
import { error, success } from '../utils/logger.js';
import { isValidMode } from '../utils/validator.js';

export const setMode = (mode) => {
  // 1차 MVP에서 허용하는 기본 실행 모드는 step과 batch뿐입니다.
  // 잘못된 값이면 기존 config 파일을 변경하지 않고 안내 메시지만 출력합니다.
  if (!isValidMode(mode)) {
    error('지원하지 않는 mode입니다. 사용 가능 값: step, batch');
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

export const setLanguage = (lang) => {
  console.log(`[DEBUG] setLanguage 호출됨: ${lang}`);
};
