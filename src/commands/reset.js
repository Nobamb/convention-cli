import { getCurrentHead, isGitRepository, resetToCommit } from "../core/git.js";
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
 * 마지막 convention 실행 transaction 전체를 취소하는 reset command flow입니다.
 *
 * FIX-RS 개편 이후 `convention --reset`은 더 이상 `HEAD~1`로 추정 reset하지 않습니다.
 * commit flow가 `.git/convention/last-run.json`에 저장한 beforeHead/afterHead를 검증하고,
 * 현재 HEAD가 afterHead와 정확히 일치할 때만 beforeHead로 mixed reset합니다.
 *
 * @returns {Promise<void>} - reset command flow
 */
export async function runReset() {
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
    info(
      "기존 방식으로 최근 commit 1개만 취소하려면 git reset HEAD~1을 직접 실행하세요.",
    );
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
