import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import prompts from 'prompts';

import { runReset } from '../src/commands/reset.js';
import { getResetStatePath, saveLastConventionRun } from '../src/core/resetState.js';

const gitAvailable = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const skipWithoutGit = gitAvailable ? false : 'git is not available in this environment';

function runGit(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function writeFile(repoDir, relativePath, content) {
  const filePath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createTempRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-reset-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Convention Test']);
  writeFile(repoDir, 'README.md', 'initial readme\n');
  runGit(repoDir, ['add', '-A']);
  runGit(repoDir, ['commit', '-m', 'chore: initial commit']);
  writeFile(repoDir, 'README.md', 'second readme\n');
  runGit(repoDir, ['add', 'README.md']);
  runGit(repoDir, ['commit', '-m', 'chore: second commit']);

  return repoDir;
}

function cleanupTempRepo(repoDir) {
  const resolvedRepo = path.resolve(repoDir);
  const resolvedTemp = path.resolve(os.tmpdir());

  if (!resolvedRepo.startsWith(resolvedTemp)) {
    throw new Error(`Refusing to remove non-temp test directory: ${resolvedRepo}`);
  }

  fs.rmSync(resolvedRepo, { recursive: true, force: true });
}

async function withRepo(callback) {
  const originalCwd = process.cwd();
  const repoDir = createTempRepo();

  try {
    process.chdir(repoDir);
    return await callback(repoDir);
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(repoDir);
    prompts.inject([]);
  }
}

function getLastCommitMessage(repoDir) {
  return runGit(repoDir, ['log', '-1', '--pretty=%s']).trim();
}

function getStatus(repoDir) {
  return runGit(repoDir, ['-c', 'core.quotepath=false', 'status', '--porcelain']);
}

function saveConventionState(repoDir, overrides = {}) {
  // 테스트 저장소의 reset 시작점으로 사용할 이전 HEAD를 계산합니다.
  const beforeHead = runGit(repoDir, ['rev-parse', 'HEAD~1']).trim();
  // 테스트 저장소의 reset 종료점으로 사용할 현재 HEAD를 계산합니다.
  const afterHead = runGit(repoDir, ['rev-parse', 'HEAD']).trim();
  // 대부분의 reset 테스트에서 공통으로 사용할 정상 transaction 기본값을 구성합니다.
  const defaultTransaction = {
    // reset 상태 파일의 schema 버전입니다.
    schemaVersion: 1,
    // 과거 버전 호환성을 확인하기 위해 입력 transaction에는 repoRoot를 넣습니다.
    // saveLastConventionRun()은 이 값을 새 상태 파일에 저장하지 않아야 합니다.
    repoRoot: repoDir,
    // 테스트에서 값 비교가 흔들리지 않도록 고정된 시작 시각을 사용합니다.
    startedAt: '2026-05-28T00:00:00.000Z',
    // 테스트에서 값 비교가 흔들리지 않도록 고정된 종료 시각을 사용합니다.
    finishedAt: '2026-05-28T00:00:01.000Z',
    // 기본 테스트 transaction은 batch commit 1개를 되돌리는 형태입니다.
    mode: 'batch',
    // resetToCommit()이 최종적으로 이동해야 하는 commit hash입니다.
    beforeHead,
    // runReset()이 현재 HEAD와 비교해야 하는 commit hash입니다.
    afterHead,
    // convention 실행으로 만들어진 commit 목록입니다.
    commits: [
      {
        // 정상 transaction에서는 마지막 commit hash가 afterHead와 같습니다.
        hash: afterHead,
        // reset preview에 표시될 commit message입니다.
        message: 'chore: second commit',
        // reset preview에 표시될 파일 metadata입니다.
        files: ['README.md'],
      },
    ],
  };

  // 각 테스트가 필요한 일부 필드만 덮어쓸 수 있도록 기본 transaction과 override를 병합합니다.
  saveLastConventionRun({
    ...defaultTransaction,
    ...overrides,
  });
}

test('runReset does not reset when user rejects confirmation', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveConventionState(repoDir);
    prompts.inject([false]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset does not reset when confirmation prompt is canceled', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveConventionState(repoDir);
    prompts.inject([new Error('user canceled prompt')]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset treats an undefined confirmation response as rejection', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveConventionState(repoDir);
    prompts.inject([undefined]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset resets the last convention transaction after confirmation and keeps changes in working tree', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveConventionState(repoDir);
    prompts.inject([true]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('saveLastConventionRun does not persist absolute repoRoot metadata', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    // legacy 입력처럼 repoRoot가 포함된 transaction을 저장합니다.
    saveConventionState(repoDir);

    // 실제 저장된 reset 상태 파일 원문을 읽어 절대 경로가 남았는지 확인합니다.
    const rawState = fs.readFileSync(getResetStatePath(), 'utf8');
    // JSON 필드 단위로 repoRoot 속성 존재 여부도 확인하기 위해 파싱합니다.
    const parsedState = JSON.parse(rawState);

    // 새 schema 저장 결과에는 repoRoot 필드가 없어야 합니다.
    assert.equal(Object.hasOwn(parsedState, 'repoRoot'), false);
    // 상태 파일 원문에도 테스트 저장소의 절대 경로가 포함되면 안 됩니다.
    assert.equal(rawState.includes(repoDir), false);
  });
});

test('runReset does not fall back to HEAD~1 when convention state is missing', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    prompts.inject([true]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset refuses to reset when recorded last commit does not match afterHead', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    // 실제 afterHead가 아닌 이전 commit hash를 가져와 잘못된 마지막 기록 commit으로 사용합니다.
    const beforeHead = runGit(repoDir, ['rev-parse', 'HEAD~1']).trim();
    // 마지막 기록 commit과 afterHead가 불일치하는 손상 transaction을 저장합니다.
    saveConventionState(repoDir, {
      commits: [
        {
          // 이 hash는 afterHead가 아니므로 graph 검증에서 거부되어야 합니다.
          hash: beforeHead,
          // preview 전에 중단되므로 message는 reset 실행에 영향을 주지 않습니다.
          message: 'chore: wrong recorded commit',
          // 파일 metadata는 정상 상대 경로로 둬 형식 검증은 통과하게 합니다.
          files: ['README.md'],
        },
      ],
    });
    // 사용자가 승인하더라도 graph 검증 실패가 먼저 reset을 막아야 합니다.
    prompts.inject([true]);

    // reset command를 실행합니다.
    await runReset();

    // reset이 실행되지 않았으므로 마지막 commit은 그대로 유지되어야 합니다.
    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    // reset이 실행되지 않았으므로 working tree도 clean 상태여야 합니다.
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset refuses to reset when beforeHead is not an ancestor of afterHead', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    // orphan branch 생성 후 원래 branch로 돌아오기 위해 현재 branch 이름을 저장합니다.
    const currentBranch = runGit(repoDir, ['branch', '--show-current']).trim();
    // reset command가 현재 HEAD와 비교할 정상 afterHead를 저장합니다.
    const afterHead = runGit(repoDir, ['rev-parse', 'HEAD']).trim();

    // 현재 히스토리와 연결되지 않은 별도 root commit을 만들기 위해 orphan branch를 생성합니다.
    runGit(repoDir, ['checkout', '--orphan', 'unrelated-reset-source']);
    // orphan branch에 commit할 파일을 작성합니다.
    writeFile(repoDir, 'ORPHAN.md', 'unrelated history\n');
    // orphan branch commit에 파일을 stage합니다.
    runGit(repoDir, ['add', '-A']);
    // 원래 branch와 ancestor 관계가 없는 commit을 생성합니다.
    runGit(repoDir, ['commit', '-m', 'chore: unrelated root']);
    // 손상 transaction의 beforeHead로 사용할 unrelated commit hash를 저장합니다.
    const unrelatedHead = runGit(repoDir, ['rev-parse', 'HEAD']).trim();
    // reset 실행 위치를 원래 branch로 되돌립니다.
    runGit(repoDir, ['checkout', currentBranch]);

    // beforeHead가 afterHead의 ancestor가 아닌 손상 transaction을 저장합니다.
    saveConventionState(repoDir, {
      beforeHead: unrelatedHead,
      afterHead,
    });
    // 사용자가 승인하더라도 ancestor 검증 실패가 먼저 reset을 막아야 합니다.
    prompts.inject([true]);

    // reset command를 실행합니다.
    await runReset();

    // reset이 실행되지 않았으므로 마지막 commit은 그대로 유지되어야 합니다.
    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    // reset이 실행되지 않았으므로 working tree도 clean 상태여야 합니다.
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset refuses to reset when recorded commits differ from actual Git range', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    // 실제 Git 범위의 시작 commit을 가져옵니다.
    const beforeHead = runGit(repoDir, ['rev-parse', 'HEAD~1']).trim();
    // 실제 Git 범위의 종료 commit을 가져옵니다.
    const afterHead = runGit(repoDir, ['rev-parse', 'HEAD']).trim();

    // beforeHead..afterHead 실제 범위에는 afterHead 1개만 있지만, 기록에는 2개를 넣어 불일치를 만듭니다.
    saveConventionState(repoDir, {
      commits: [
        {
          // 범위에 포함되면 안 되는 beforeHead를 기록 commit 목록에 섞습니다.
          hash: beforeHead,
          // 잘못 섞인 commit의 표시용 메시지입니다.
          message: 'chore: unexpected extra commit',
          // 형식 검증은 통과하도록 정상 상대 경로를 사용합니다.
          files: ['README.md'],
        },
        {
          // 마지막 commit은 afterHead로 맞춰 마지막 hash 검증은 통과하게 합니다.
          hash: afterHead,
          // 실제 convention commit처럼 보이는 표시용 메시지입니다.
          message: 'chore: second commit',
          // 형식 검증은 통과하도록 정상 상대 경로를 사용합니다.
          files: ['README.md'],
        },
      ],
    });
    // 사용자가 승인하더라도 rev-list 범위 검증 실패가 먼저 reset을 막아야 합니다.
    prompts.inject([true]);

    // reset command를 실행합니다.
    await runReset();

    // reset이 실행되지 않았으므로 마지막 commit은 그대로 유지되어야 합니다.
    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    // reset이 실행되지 않았으므로 working tree도 clean 상태여야 합니다.
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset refuses to reset when current HEAD differs from recorded afterHead', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveConventionState(repoDir);
    writeFile(repoDir, 'manual.md', 'manual commit\n');
    runGit(repoDir, ['add', 'manual.md']);
    runGit(repoDir, ['commit', '-m', 'docs: manual commit']);
    prompts.inject([true]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'docs: manual commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset does not execute git reset outside a git repository', { skip: skipWithoutGit }, async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-reset-non-repo-'));

  try {
    process.chdir(tempDir);
    prompts.inject([true]);

    await runReset();
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(tempDir);
    prompts.inject([]);
  }
});
