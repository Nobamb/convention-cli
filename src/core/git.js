import { execFileSync } from 'node:child_process';
import { error as logError } from '../utils/logger.js';

// Git 명령을 실행할 때 공통으로 사용하는 child_process 옵션입니다.
// encoding을 utf8로 고정해 한글, 일본어, 중국어, emoji가 포함된 Git 출력과 커밋 메시지를 문자열로 다룹니다.
// stdin은 사용하지 않고, stdout/stderr는 pipe로 받아 호출자가 필요할 때 결과나 실패 정보를 처리할 수 있게 합니다.
const GIT_COMMAND_OPTIONS = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
};

// Git 명령 실행을 한 곳으로 모은 내부 helper입니다.
// 모든 Git 명령은 shell 문자열이 아니라 argv 배열로 실행해 파일명, 경로, 커밋 메시지에 포함된 공백과 특수문자를 안전하게 전달합니다.
function runGit(args) {
  return execFileSync('git', args, GIT_COMMAND_OPTIONS);
}

// diff를 AI prompt로 보내기 전에 제외해야 하는 민감 파일명 후보입니다.
// 경로 전체가 아니라 basename 기준으로 비교하므로 하위 폴더에 있는 .env, credentials.json 등도 제외할 수 있습니다.
// id_* 항목은 OpenSSH가 관례적으로 사용하는 개인키 파일명입니다.
const SENSITIVE_FILE_NAMES = new Set([
  '.env',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'credentials.json',
  'secrets.json',
]);

// Windows 경로 구분자인 역슬래시를 Git pathspec에서 다루기 쉬운 슬래시 형태로 바꿉니다.
// 이후 basename 추출과 민감 파일 판별을 OS별 경로 표기 차이에 덜 의존하게 만드는 역할입니다.
function normalizeGitPath(file) {
  return file.replaceAll('\\', '/');
}

// 파일 경로에서 마지막 파일명 부분만 추출합니다.
// 예를 들어 "config/.env.local"은 ".env.local"로 바꿔 민감 파일명 규칙을 일관되게 적용할 수 있게 합니다.
function getBaseName(file) {
  const normalized = normalizeGitPath(file);
  const parts = normalized.split('/');
  return parts.at(-1) ?? normalized;
}

// diff 추출 대상에서 제외해야 하는 민감 파일 경로인지 판별합니다.
// .env 계열, pem/key 파일, credentials/secrets 파일, 개인키 파일이 AI prompt나 로그에 섞이지 않도록 막는 보안 gate입니다.
function isSensitiveDiffPath(file) {
  if (typeof file !== 'string' || file.length === 0) {
    return false;
  }

  const baseName = getBaseName(file).toLowerCase();

  return (
    SENSITIVE_FILE_NAMES.has(baseName) ||
    baseName.startsWith('.env.') ||
    baseName.endsWith('.pem') ||
    baseName.endsWith('.key')
  );
}

// git status --porcelain 출력에서 따옴표로 감싸진 경로를 원래 경로 문자열로 되돌립니다.
// 공백이나 특수문자가 있는 파일명이 "file name.js"처럼 표시되는 경우, 후속 git diff/add pathspec에 그대로 넣을 수 있게 정리합니다.
function unquoteGitPath(file) {
  if (file.startsWith('"') && file.endsWith('"')) {
    return file.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
  }

  return file;
}

// git status --porcelain 한 줄에서 변경된 파일 경로만 추출합니다.
// porcelain v1은 앞 2글자가 상태, 3번째 글자가 공백, 그 뒤가 경로이므로 line.slice(3)을 사용합니다.
// rename 출력은 "old -> new" 형태이므로 실제 diff/add 대상이 되는 새 경로만 반환합니다.
function parseChangedFileLine(line) {
  const rawPath = line.slice(3);
  const renameSeparator = ' -> ';

  if (rawPath.includes(renameSeparator)) {
    return unquoteGitPath(rawPath.split(renameSeparator).pop());
  }

  return unquoteGitPath(rawPath);
}

// 특정 파일 하나의 HEAD 대비 diff를 가져옵니다.
// core.quotepath=false를 지정해 한글 등 non-ASCII 파일명이 escape되지 않게 하고, "--" 뒤에 파일 경로를 단일 인자로 전달합니다.
function getDiffForFile(file) {
  return runGit(['-c', 'core.quotepath=false', 'diff', 'HEAD', '--', file]);
}

// 현재 작업 디렉터리가 Git 저장소 내부인지 확인합니다.
// 사용자에게 직접 출력하지 않고 boolean만 반환해 command layer가 상황에 맞는 안내를 결정할 수 있게 합니다.
export function isGitRepository() {
  try {
    const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      ...GIT_COMMAND_OPTIONS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output.trim() === 'true';
  } catch {
    return false;
  }
}

// 현재 Git 저장소에서 변경된 파일 목록을 반환합니다.
// modified, staged, deleted, untracked, renamed 파일을 status --porcelain 기준으로 수집하고, 출력이 비어 있으면 빈 배열을 반환합니다.
export function getChangedFiles() {
  const output = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain'], {
    ...GIT_COMMAND_OPTIONS,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (!output.trim()) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseChangedFileLine);
}

// 변경된 전체 파일의 diff를 하나의 문자열로 합쳐 반환합니다.
// 내부적으로 getFileDiffs를 거치므로 민감 파일은 제외되고, untracked-only처럼 diff가 비어 있는 파일도 결과에 포함되지 않습니다.
export function getFullDiff() {
  return getFileDiffs(getChangedFiles())
    .map(({ diff }) => diff)
    .join('');
}

// 전달받은 파일 목록을 파일별 diff 배열로 변환합니다.
// 반환 형식은 { file, diff }이며, step 모드에서 파일별 커밋 메시지를 만들 때 사용할 수 있습니다.
// 잘못된 입력은 TypeError로 중단하고, 빈 경로/비문자열/민감 파일/빈 diff는 결과에서 제외합니다.
export function getFileDiffs(files) {
  if (!Array.isArray(files)) {
    throw new TypeError('files must be an array');
  }

  const fileDiffs = [];

  for (const file of files) {
    if (typeof file !== 'string' || file.length === 0 || isSensitiveDiffPath(file)) {
      continue;
    }

    const diff = getDiffForFile(file);

    if (!diff.trim()) {
      continue;
    }

    fileDiffs.push({ file, diff });
  }

  return fileDiffs;
}

// 모든 변경사항을 staging합니다.
// batch 모드에서 한 번의 커밋으로 전체 변경사항을 묶기 위해 git add -A를 사용하며, 신규/수정/삭제 파일을 모두 포함합니다.
export function addAll() {
  try {
    runGit(['add', '-A']);
  } catch (error) {
    // diff 원문이나 파일 경로는 로그에 남기지 않고, 상위 workflow가 실패를 처리할 수 있도록 예외를 다시 던집니다.
    logError('Failed to stage changes.');
    throw error;
  }
}

// 지정한 파일 하나만 staging합니다.
// step 모드에서 파일별 커밋을 만들 때 사용하며, 파일 경로가 비어 있거나 문자열이 아니면 Git 실행 전에 차단합니다.
export function addFile(file) {
  if (typeof file !== 'string' || file.length === 0) {
    throw new TypeError('file must be a non-empty string');
  }

  try {
    // "--" 뒤의 값은 옵션이 아니라 pathspec으로 해석되므로, 하이픈으로 시작하는 파일명도 안전하게 처리할 수 있습니다.
    runGit(['add', '--', file]);
  } catch (error) {
    // Git 실패 stderr에는 환경 정보나 경로가 포함될 수 있어 일반 메시지만 남기고 원본 에러는 호출자에게 전파합니다.
    logError('Failed to stage file.');
    throw error;
  }
}

// staging된 변경사항을 전달받은 메시지로 커밋합니다.
// 커밋 메시지는 argv 배열의 단일 인자로 전달하므로 따옴표, 개행, 특수문자, emoji가 shell에서 재해석되지 않습니다.
export function commit(message, files = []) {
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new TypeError('message must be a non-empty string');
  }

  if (!Array.isArray(files)) {
    throw new TypeError('files must be an array');
  }

  for (const file of files) {
    if (typeof file !== 'string' || file.length === 0) {
      throw new TypeError('files must contain only non-empty strings');
    }
  }

  try {
    // 파일 목록이 전달된 경우에는 commit pathspec을 함께 넘겨, 이미 staged 되어 있던 다른 파일이
    // 실수로 같은 커밋에 포함되지 않도록 제한합니다. 특히 command 계층에서 민감 파일을 제외한 뒤에도
    // 사용자가 실행 전에 `.env` 등을 staged 해둔 상태일 수 있으므로, pathspec 제한은 마지막 방어선입니다.
    const args = files.length > 0 ? ['commit', '-m', message, '--', ...files] : ['commit', '-m', message];
    runGit(args);
  } catch (error) {
    // nothing to commit, Git lock, 권한 문제 같은 실제 Git 실패는 상위 commit workflow에서 사용자 안내를 결정하도록 전파합니다.
    logError('Failed to create commit.');
    throw error;
  }
}
