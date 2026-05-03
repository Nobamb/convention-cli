import { SUPPORTED_MODES } from '../config/defaults.js';

// 1차 MVP에서 CLI 기본 실행 모드로 허용하는 값인지 확인합니다.
// --set-mode는 step 또는 batch만 저장할 수 있어야 합니다.
export function isValidMode(mode) {
  return SUPPORTED_MODES.includes(mode);
}
