import { isGitRepository, resetLastCommit } from "../core/git.js";
import { error, info, success, warn } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

/**
 * 최근 커밋 1개를 취소하는 reset command flow입니다.
 *
 * 이 command layer는 사용자의 의사를 확인하고 안내 메시지를 출력하는 책임만 가집니다.
 * 실제 Git 실행은 `src/core/git.js`의 `resetLastCommit()`에 위임해, 허용된 명령이
 * `git reset HEAD~1` 하나로 유지되도록 중앙에서 통제합니다.
 */
export async function runReset() {
  // Git 저장소 밖에서 reset을 실행하면 사용자가 의도하지 않은 위치의 히스토리를 건드릴 수 있습니다.
  // 따라서 가장 먼저 현재 작업 디렉터리가 Git working tree인지 확인하고, 아니면 아무 Git 명령도 실행하지 않습니다.
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  info("최근 커밋 1개를 취소합니다. 커밋에 포함됐던 변경사항은 working tree에 남습니다.");

  // reset은 커밋 히스토리를 이동시키는 작업이므로, commit flow의 confirm 설정과 무관하게
  // 항상 별도의 사용자 확인을 받습니다. 기본값은 false로 두어 Enter 실수로 실행되지 않게 합니다.
  const approved = await confirmAction(
    "git reset HEAD~1을 실행할까요? 변경사항은 삭제되지 않고 working tree에 남습니다.",
  );

  if (!approved) {
    // confirmAction은 No뿐 아니라 Ctrl+C, ESC, undefined 응답도 모두 false로 돌려줍니다.
    // 따라서 이 분기에서는 resetLastCommit()을 절대 호출하지 않아 Git 히스토리가 그대로 유지됩니다.
    warn("사용자가 reset을 취소했습니다. Git 히스토리는 변경되지 않았습니다.");
    return;
  }

  // 실제 실행은 core wrapper가 담당합니다. wrapper는 shell 문자열이나 임의 ref를 받지 않고
  // argv 배열로 고정된 `git reset HEAD~1`만 실행합니다.
  resetLastCommit();

  success("최근 커밋 1개를 취소했습니다.");
  info("변경사항은 working tree에 남아 있습니다. 필요하면 내용을 확인한 뒤 다시 commit하세요.");
}
