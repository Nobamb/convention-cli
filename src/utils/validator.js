import { PROVIDERS, SUPPORTED_LANGUAGES, SUPPORTED_MODES } from '../config/defaults.js';

// 1차 MVP에서 CLI 기본 실행 모드로 허용하는 값인지 확인합니다.
// --set-mode는 step 또는 batch만 저장할 수 있어야 합니다.
export function isValidMode(mode) {
  return SUPPORTED_MODES.includes(mode);
}

// 1차 MVP에서 커밋 메시지 생성 언어로 허용하는 값인지 확인합니다.
// --language는 ko, en, jp, cn 중 하나만 저장할 수 있어야 합니다.
export function isValidLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

// 2차 MVP에서 설정 및 provider routing 대상으로 허용하는 provider 값인지 확인합니다.
export function isValidProvider(provider) {
  return PROVIDERS.includes(provider);
}
