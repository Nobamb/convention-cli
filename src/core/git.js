import { execFileSync } from 'node:child_process';

// diff나 AI prompt로 넘기면 안 되는 민감 파일 후보입니다.
// 경로 전체가 아니라 basename 기준으로 검사해 중첩 폴더 안의 민감 파일도 제외합니다.
// id_* 항목들은 OpenSSH가 관례적으로 사용하는 개인키 파일명입니다.
const SENSITIVE_FILE_NAMES = new Set([
  '.env',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'credentials.json',
  'secrets.json',
]);

function normalizeGitPath(file) {
  // Windows 경로 구분자를 Git pathspec 비교에 쓰기 쉬운 형태로 맞춥니다.
  return file.replaceAll('\\', '/');
}

function getBaseName(file) {
  const normalized = normalizeGitPath(file);
  const parts = normalized.split('/');
  return parts.at(-1) ?? normalized;
}

function isSensitiveDiffPath(file) {
  // 빈 값이나 비문자열은 path로 판단하지 않고 일반 흐름에서 처리하게 둡니다.
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

function unquoteGitPath(file) {
  // 공백이 있는 파일명은 status --porcelain에서 따옴표로 감싸질 수 있어 원래 경로로 복원합니다.
  if (file.startsWith('"') && file.endsWith('"')) {
    return file.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
  }

  return file;
}

function parseChangedFileLine(line) {
  // porcelain v1 형식은 앞 2글자가 상태, 세 번째 글자가 공백이므로 네 번째 글자부터 경로입니다.
  const rawPath = line.slice(3);
  const renameSeparator = ' -> ';

  if (rawPath.includes(renameSeparator)) {
    // rename은 이후 diff/add 대상이 되는 새 경로만 반환합니다.
    return unquoteGitPath(rawPath.split(renameSeparator).pop());
  }

  return unquoteGitPath(rawPath);
}

function getDiffForFile(file) {
  // 파일명은 shell 문자열에 넣지 않고 argv의 단일 인자로 전달해 공백/한글/특수문자를 안전하게 처리합니다.
  return execFileSync('git', ['-c', 'core.quotepath=false', 'diff', 'HEAD', '--', file], {
    encoding: 'utf8',
  });
}

export function isGitRepository() {
  // core 함수는 사용자 메시지를 출력하지 않고, 호출자가 처리할 수 있도록 boolean만 반환합니다.
  try {
    const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output.trim() === 'true';
  } catch {
    return false;
  }
}

export function getChangedFiles() {
  // core.quotepath=false로 한글 등 non-ASCII 파일명이 escape되지 않게 받습니다.
  const output = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain'], {
    encoding: 'utf8',
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

export function getFullDiff() {
  // 전체 diff도 민감 파일 제외 기준을 공유하기 위해 파일별 diff를 합쳐 만듭니다.
  return getFileDiffs(getChangedFiles())
    .map(({ diff }) => diff)
    .join('');
}

export function getFileDiffs(files) {
  // 호출 계약을 명확히 해서 잘못된 입력이 조용히 빈 diff로 처리되지 않게 합니다.
  if (!Array.isArray(files)) {
    throw new TypeError('files must be an array');
  }

  const fileDiffs = [];

  for (const file of files) {
    // 비정상 항목과 민감 파일은 diff 추출 대상에서 제외합니다.
    if (typeof file !== 'string' || file.length === 0 || isSensitiveDiffPath(file)) {
      continue;
    }

    const diff = getDiffForFile(file);

    // untracked-only 파일이나 변경이 없는 파일은 빈 diff가 나오므로 결과에 포함하지 않습니다.
    if (!diff.trim()) {
      continue;
    }

    fileDiffs.push({ file, diff });
  }

  return fileDiffs;
}
