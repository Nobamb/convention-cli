import {
  getCommitHashesBetween,
  getCurrentHead,
  isAncestorCommit,
  isGitRepository,
  resetToCommit,
} from "../core/git.js";
import {
  clearLastConventionRun,
  loadLastConventionRun,
} from "../core/resetState.js";
import { error, info, success, warn } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

/**
 * Reset preview 메시지 포맷
 * 마지막 convention을 실행한 시점에서의 beforeHead와 afterHead를 비교하여
 * 현재 HEAD가 afterHead와 정확히 일치할 때만 beforeHead로 mixed reset합니다.
 *
 * @param {import("../core/resetState.js").ResetTransaction} transaction - 마지막 convention 실행 트랜잭션
 * @returns {string} - Reset preview 메시지
 */
function formatResetPreview(transaction) {
  // 마지막 convention 실행에서 생성된 commit 개수와 각 commit의 메시지, 파일을 리스트로 보여줌
  const lines = [
    `마지막 convention 실행에서 생성된 ${transaction.commits.length}개 commit을 취소합니다.`,
    "",
  ];

  // 트랜잭션 내의 커밋들을 순회하면서 리스트로 추가
  for (const commit of transaction.commits) {
    // 커밋 메시지 또는 해시 추가
    const message = commit.message || commit.hash;
    // 메시지 추가
    lines.push(`- ${message}`);

    // 커밋된 파일들 추가
    for (const file of commit.files) {
      lines.push(`  files: ${file}`);
    }
  }

  // reset 명령 정보 추가
  lines.push("");
  lines.push("실행 명령: git reset <beforeHead>");
  lines.push("변경사항은 삭제되지 않고 working tree에 남습니다.");

  // 줄바꿈으로 연결된 문자열 반환
  return lines.join("\n");
}

/**
 * reset transaction이 현재 Git graph와 정확히 일치하는지 검증합니다.
 *
 * @param {import("../core/resetState.js").ResetTransaction} transaction - `.git/convention/last-run.json`에서 읽은 마지막 convention 실행 기록입니다.
 * @returns {{ valid: boolean, reason: string }} - reset을 계속 진행해도 되면 `{ valid: true, reason: "" }`를 반환하고, 중단해야 하면 `{ valid: false, reason }`을 반환합니다.
 */
function validateResetTransactionGraph(transaction) {
  // transaction.commits는 reset으로 되돌릴 convention commit들의 기록입니다.
  const recordedCommits = transaction.commits;
  // 마지막 기록 commit은 reset 직전 HEAD와 같아야 하는 afterHead 후보입니다.
  const lastRecordedCommit = recordedCommits.at(-1);

  // transaction 파일이 형식 검증은 통과했더라도 논리적으로 마지막 commit이 afterHead와 다르면 reset 범위가 불명확합니다.
  if (lastRecordedCommit.hash !== transaction.afterHead) {
    return {
      valid: false,
      reason: "기록된 마지막 commit hash와 afterHead가 일치하지 않습니다.",
    };
  }

  // beforeHead가 afterHead의 ancestor인지 확인해 reset 대상 범위가 같은 Git 히스토리 선상에 있는지 검증합니다.
  if (!isAncestorCommit(transaction.beforeHead, transaction.afterHead)) {
    return {
      valid: false,
      reason: "beforeHead가 afterHead의 ancestor가 아닙니다.",
    };
  }

  // Git이 실제로 계산한 beforeHead..afterHead 범위의 commit 목록을 가져옵니다.
  const actualCommitHashes = getCommitHashesBetween(
    transaction.beforeHead,
    transaction.afterHead,
  );
  // transaction에 기록된 commit hash 목록만 추출해 Git graph 결과와 비교할 준비를 합니다.
  const recordedCommitHashes = recordedCommits.map((commit) => commit.hash);

  // commit 개수가 다르면 convention 실행 범위를 정확히 되돌린다고 보장할 수 없습니다.
  if (actualCommitHashes.length !== recordedCommitHashes.length) {
    return {
      valid: false,
      reason: "기록된 commit 개수와 실제 Git 범위 commit 개수가 일치하지 않습니다.",
    };
  }

  // 각 commit hash가 같은 순서로 정확히 일치하는지 확인합니다.
  const allHashesMatch = actualCommitHashes.every(
    (hash, index) => hash === recordedCommitHashes[index],
  );

  // 순서 또는 값이 하나라도 다르면 다른 commit이 섞였거나 상태 파일이 잘못된 것으로 보고 reset을 중단합니다.
  if (!allHashesMatch) {
    return {
      valid: false,
      reason: "기록된 commit 목록과 실제 Git 범위 commit 목록이 일치하지 않습니다.",
    };
  }

  // 모든 검증이 통과되면 reset 대상 범위가 transaction 기록과 Git graph 모두에서 일치합니다.
  return { valid: true, reason: "" };
}

/**
 * 마지막 convention 실행 transaction 전체를 취소하는 reset command flow입니다.
 *
 * FIX-RS 개편 이후 `convention --reset`은 더 이상 `HEAD~1`로 추정 reset하지 않습니다.
 * commit flow가 `.git/convention/last-run.json`에 저장한 beforeHead/afterHead를 검증하고,
 * 현재 HEAD가 afterHead와 정확히 일치할 때만 beforeHead로 mixed reset합니다.
 *
 * @param {object} [runtime] - CLI 진입점에서 계산한 실행 환경 옵션입니다. CI 여부와 대화형 입력 가능 여부를 command 계층에 전달하는 역할을 합니다.
 * @param {boolean} [runtime.interactive=true] - 사용자 입력 prompt를 띄울 수 있는 실행인지 나타냅니다. `false`이면 reset 확인 prompt를 호출하지 않고 안전하게 중단합니다.
 * @param {boolean} [runtime.yes=false] - 다른 command에서는 명시 승인으로 쓰일 수 있지만, reset은 Git 히스토리를 이동하는 작업이므로 자동 승인 용도로 사용하지 않습니다.
 * @param {boolean} [runtime.isCI=false] - 현재 실행 환경이 일반 CI인지 나타내는 값입니다. reset 중단 메시지가 자동화 환경에서 발생한 이유를 이해하는 데 필요한 실행 문맥입니다.
 * @param {boolean} [runtime.isGitHubActions=false] - 현재 실행 환경이 GitHub Actions인지 나타내는 값입니다. GitHub Actions에서도 reset은 대화형 확인 없이 실행하지 않습니다.
 * @returns {Promise<void>} - reset command flow가 완료되면 값을 반환하지 않습니다. 안전 조건을 만족하지 못하면 Git 상태를 변경하지 않고 조기 종료합니다.
 */
export async function runReset(runtime = {}) {
  // runtime.interactive는 CLI의 --no-interactive 옵션 또는 CI/GitHub Actions 감지 결과를 반영합니다.
  // undefined인 기존 직접 호출 테스트와 API 사용자는 이전처럼 대화형 reset을 사용할 수 있도록 기본값을 true로 둡니다.
  const { interactive = true } = runtime;

  // Git 저장소 밖에서는 `.git/convention/last-run.json` 위치를 안전하게 계산할 수 없습니다.
  // 따라서 상태 파일을 읽기 전에 먼저 Git working tree 여부를 확인합니다.
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  // 마지막 convention 실행 기록을 로드
  const transaction = loadLastConventionRun();

  // 마지막 convention 실행 기록이 없으면 리셋 종료
  if (!transaction) {
    warn("마지막 convention 실행 기록을 찾을 수 없어 자동 reset을 중단합니다.");
    info("필요하면 git log를 확인한 뒤 되돌릴 범위를 직접 판단해 주세요.");
    info("변경사항은 working tree에 남습니다.");
    return;
  }

  // 현재 HEAD를 가져옴
  const currentHead = getCurrentHead();

  // 현재 HEAD와 기록된 afterHead가 일치하지 않으면 리셋 중단
  if (currentHead !== transaction.afterHead) {
    warn(
      "마지막 convention 실행 이후 다른 commit이 추가되어 자동 reset을 중단합니다.",
    );
    info("현재 HEAD와 기록된 afterHead가 일치하지 않습니다.");
    info("필요하면 git log를 확인한 뒤 수동으로 reset하세요.");
    return;
  }

  // 현재 HEAD가 맞더라도 상태 파일이 수동 편집되었거나 손상되었을 수 있으므로 Git graph 무결성을 추가로 검증합니다.
  const graphValidation = validateResetTransactionGraph(transaction);

  // Git graph 검증이 실패하면 사용자 confirm을 받기 전에 중단하여 잘못된 범위로 reset하지 않습니다.
  if (!graphValidation.valid) {
    warn("convention reset 기록의 Git graph 검증에 실패해 자동 reset을 중단합니다.");
    info(graphValidation.reason);
    info("필요하면 git log를 확인한 뒤 수동으로 reset하세요.");
    return;
  }

  // reset은 Git 히스토리 위치를 이동시키는 명령이므로 자동화 환경에서는 prompt를 띄우지 않고 즉시 중단합니다.
  // --yes는 commit/PR preview 승인에는 사용할 수 있지만, reset 자동 승인으로 해석하지 않아 위험 명령이 CI에서 자동 실행되지 않게 합니다.
  if (!interactive) {
    warn(
      "convention --reset은 Git 히스토리를 이동하는 작업이라 대화형 확인이 필요합니다.",
    );
    info(
      "--no-interactive 또는 CI 환경에서는 reset 확인 prompt를 띄우지 않고 자동 reset도 실행하지 않습니다.",
    );
    info("필요하면 로컬 터미널에서 convention --reset을 다시 실행하세요.");
    return;
  }

  // reset preview 메시지 포맷
  info(formatResetPreview(transaction));

  // reset은 커밋 히스토리를 이동시키는 작업이므로 commit confirm 설정과 무관하게
  // 항상 별도 confirm을 받습니다. 기본값은 false라서 Enter 실수로 실행되지 않습니다.
  const approved = await confirmAction(
    "마지막 convention 실행 전체를 취소할까요?",
  );

  if (!approved) {
    warn("사용자가 reset을 취소했습니다. Git 히스토리는 변경되지 않았습니다.");
    return;
  }

  // resetToCommit()은 40자리 commit hash만 허용하고 기본 mixed reset만 실행합니다.
  // 따라서 --hard 같은 파괴적 옵션이나 임의 ref 문자열이 reset 경로에 들어가지 않습니다.
  resetToCommit(transaction.beforeHead);
  clearLastConventionRun();

  success("마지막 convention 실행에서 생성된 commit을 취소했습니다.");
  info(
    "변경사항은 working tree에 남아 있습니다. 필요하면 내용을 확인한 뒤 다시 commit하세요.",
  );
}
