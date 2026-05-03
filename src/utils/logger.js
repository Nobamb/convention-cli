// CLI 성공 메시지를 한 곳에서 관리해 command별 출력 스타일을 통일합니다.
export function success(message) {
  console.log(`✅ ${message}`);
}

// CLI 실패 메시지를 stderr로 분리해 오류 출력 흐름을 명확히 합니다.
export function error(message) {
  console.error(`❌ ${message}`);
}

// CLI 경고 메시지를 경고 스트림으로 분리해 계속 진행 가능한 주의사항을 표시합니다.
export function warn(message) {
  console.warn(`⚠️ ${message}`);
}

// CLI 진행 상태와 일반 안내 메시지를 한 곳에서 관리합니다.
export function info(message) {
  console.log(`ℹ️ ${message}`);
}
