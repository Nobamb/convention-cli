/**
 * 커밋 관련 명령어 로직을 담당합니다.
 * Phase C에서는 호출 여부 확인을 위한 로그만 출력합니다.
 */

export const runDefaultCommit = async () => {
  console.log("[DEBUG] runDefaultCommit 호출됨 (기본 모드 실행)");
};

export const runStepCommit = async () => {
  console.log("[DEBUG] runStepCommit 호출됨 (개별 파일 커밋)");
};

export const runBatchCommit = async () => {
  console.log("[DEBUG] runBatchCommit 호출됨 (통합 커밋)");
};
