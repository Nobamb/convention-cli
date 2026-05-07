const MOCK_COMMIT_MESSAGE = 'chore: update project files';

/**
 * Mock AI Provider입니다.
 * 외부 API 호출 없이 commit flow를 검증할 수 있도록 항상 고정 메시지를 반환합니다.
 */
export async function generateCommitMessage() {
  return MOCK_COMMIT_MESSAGE;
}

export async function listModels() {
  return ['mock'];
}

export function validateConfig() {
  return true;
}

// 기존 1차 MVP 호출부와 외부 테스트가 깨지지 않도록 유지하는 compatibility alias입니다.
export async function generate() {
  return generateCommitMessage();
}

export { MOCK_COMMIT_MESSAGE };
