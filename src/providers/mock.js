/**
 * Mock AI Provider입니다.
 * 외부 API 호출 없이 커밋 워크플로우를 테스트하거나 시연할 때 사용하며,
 * 항상 고정된 'chore: update project files' 메시지를 반환합니다.
 */
export async function generate() {
  return 'chore: update project files';
}
