// CLI 성공 메시지를 한 곳에서 관리해 command별 출력 스타일을 통일합니다.
export function success(message) {
  console.log(`✅ ${message}`);
}

// CLI 실패 메시지를 한 곳에서 관리해 직접 console.log 사용을 줄입니다.
export function error(message) {
  console.error(`❌ ${message}`);
}
