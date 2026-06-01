import { execFileSync } from "node:child_process";
import {
  error as logError,
  info as logInfo,
  success as logSuccess,
  warn as logWarn,
} from "../utils/logger.js";

// Git 명령을 실행할 때 공통으로 사용하는 child_process 옵션입니다.
// encoding을 utf8로 고정해 한글, 일본어, 중국어, emoji가 포함된 Git 출력과 커밋 메시지를 문자열로 다룹니다.
// stdin은 사용하지 않고, stdout/stderr는 pipe로 받아 호출자가 필요할 때 결과나 실패 정보를 처리할 수 있게 합니다.
const GIT_COMMAND_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
};

/**
 * error 객체의 status가 1이고 stdout이 문자열일 때 true 반환
 * git diff --no-index 명령에서 untracked file을 diff 할 때
 * 발생할 수 있는 오류를 처리하기 위해 사용됩니다.
 *
 * @param {Error} error - error 객체
 * @returns {boolean} - error.status가 1이고 error.stdout이 문자열일 때 true 반환
 */
function isGitDiffExit(error) {
  return error?.status === 1 && typeof error.stdout === "string";
}

// git status --porcelain v1에서 untracked 파일이 시작되는 라인 패턴
const UNTRACKED_STATUS_LINE_PATTERN = /^\?\? /m;
// 완전한 40자리 16진수 해시 패턴
const FULL_COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/i;

/**
 * Git 명령 실행을 한 곳으로 모은 내부 helper입니다.
 * 모든 Git 명령은 shell 문자열이 아니라 argv 배열로 실행해
 * 파일명, 경로, 커밋 메시지에 포함된 공백과 특수문자를 안전하게 전달합니다.
 *
 * @param {string[]} args - git 명령어 인자
 * @returns {string} - 표준 출력
 **/
function runGit(args) {
  return execFileSync("git", args, GIT_COMMAND_OPTIONS);
}

/**
 * 사용자에게 보여줘도 되는 브랜치 이름만 가져옵니다.
 * remote URL, credential helper 출력, 인증 실패 stderr는 포함하지 않도록
 * stdout만 읽고 stderr는 버립니다.
 *
 * @returns {string} - 현재 브랜치 이름
 */
export function getCurrentBranchName() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // 오류 발생 시 빈 문자열 반환
  } catch {
    return "";
  }
}

/**
 * 현재 브랜치에 upstream이 설정되어 있는지 확인합니다.
 * upstream 이름(origin/main 같은 ref 이름)은 안내에 사용할 수 있지만,
 * 원격 URL은 절대 조회하거나 출력하지 않습니다.
 *
 * @returns {string} - 현재 브랜치에 설정된 upstream 이름
 */
export function getCurrentUpstreamName() {
  try {
    return execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      {
        ...GIT_COMMAND_OPTIONS,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    // 오류 발생 시 빈 문자열 반환
    return "";
  }
}

/**
 * Git push 실패 시 표시할 메시지를 생성합니다.
 * 원격 저장소 정보는 포함하지 않으며, 보안을 위해 숨김 처리합니다.
 *
 * @param {string} branchName - 현재 브랜치 이름
 * @param {string} upstreamName - upstream 브랜치 이름
 * @returns {string} - push 실패 메시지
 */
function buildPushFailureMessage(branchName, upstreamName) {
  // 현재 브랜치 이름 또는 "current branch"로 표시
  const branchLabel = branchName || "current branch";
  // upstream 브랜치 이름이 있으면 표시,
  // 없으면 안내 문구 표시
  const upstreamHint = upstreamName
    ? `Upstream: ${upstreamName}.`
    : "No upstream branch was detected. You may need to set an upstream first.";

  // 원격 저장소 URL과 인증 정보는 숨김 처리한 채로 git push 실패 시 표시할 메시지를 반환
  return `Failed to push ${branchLabel}. ${upstreamHint} Remote URL and authentication details were hidden.`;
}

/**
 * 현재 저장소에 등록된 remote 이름만 반환합니다.
 *
 * remote URL은 인증 토큰이나 사용자명이 포함될 수 있으므로 조회하지 않습니다. `git remote`가
 * 반환한 이름만 push 대상 선택과 검증에 사용합니다.
 *
 * @returns {string[]} 등록된 remote 이름 목록
 */
export function getRemotes() {
  try {
    const output = execFileSync("git", ["remote"], {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output.split(/\r?\n/u).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * push UX 판단에 필요한 Git 상태만 안전하게 모읍니다.
 *
 * branch/upstream/remote 이름은 Git이 반환한 값만 사용하고, remote URL이나 stderr는 노출하지 않습니다.
 * command 계층은 이 값을 보고 일반 push, upstream 설정 push, 또는 안전 중단을 결정합니다.
 *
 * @returns {{branchName: string, upstreamName: string, remotes: string[]}} push 대상 상태
 */
export function getPushTargetStatus() {
  return {
    branchName: getCurrentBranchName(),
    upstreamName: getCurrentUpstreamName(),
    remotes: getRemotes(),
  };
}

/**
 * 등록된 remote에 현재 branch의 upstream을 설정하며 push합니다.
 *
 * remote 이름은 반드시 `git remote` 결과에 포함되어야 합니다. branch 이름은 사용자 입력을 받지 않고
 * 현재 Git 상태에서 감지한 값만 전달받아 detached HEAD나 빈 branch 상태에서 자동 upstream 설정을 막습니다.
 *
 * @param {string} remoteName 등록된 remote 이름
 * @param {string} branchName 현재 branch 이름
 * @returns {void}
 */
export function pushWithUpstream(remoteName, branchName) {
  const remotes = getRemotes();

  if (!remotes.includes(remoteName)) {
    throw new Error("Remote is not registered.");
  }

  if (typeof branchName !== "string" || branchName.trim().length === 0) {
    throw new Error("Current branch name could not be detected.");
  }

  try {
    runGit(["push", "-u", remoteName, branchName]);
    logSuccess(
      `Pushed branch ${branchName} and set upstream to ${remoteName}/${branchName}.`,
    );
  } catch {
    const message = buildPushFailureMessage(
      branchName,
      `${remoteName}/${branchName}`,
    );
    logError(message);
    throw new Error(message);
  }
}

// diff를 AI prompt로 보내기 전에 제외해야 하는 민감 파일명 후보입니다.
// 경로 전체가 아니라 basename 기준으로 비교하므로 하위 폴더에 있는 .env, credentials.json 등도 제외할 수 있습니다.
// id_* 항목은 OpenSSH가 관례적으로 사용하는 개인키 파일명입니다.
const SENSITIVE_FILE_NAMES = new Set([
  ".env",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
  "credentials.json",
  "secrets.json",
]);
/**
 * Windows 경로 구분자인 역슬래시를 Git pathspec에서 다루기 쉬운 슬래시 형태로 바꿉니다.
 * 이후 basename 추출과 민감 파일 판별을 OS별 경로 표기 차이에 덜 의존하게 만드는 역할을 합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {string} - 정규화된 파일 경로
 */
function normalizeGitPath(file) {
  return file.replaceAll("\\", "/");
}

/**
 * 파일 경로에서 마지막 파일명 부분만 추출합니다.
 * 예를 들어 "config/.env.local"은 ".env.local"로 바꿔
 * 민감 파일명 규칙을 일관되게 적용할 수 있게 합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {string} - 파일명
 */
function getBaseName(file) {
  // 파일 경로를 정규화
  const normalized = normalizeGitPath(file);
  // 경로를 /로 분리
  const parts = normalized.split("/");
  // 마지막 부분 반환
  return parts.at(-1) ?? normalized;
}

/**
 * diff 추출 대상에서 제외해야 하는 민감 파일 경로인지 판별합니다.
 * .env 계열, pem/key 파일, credentials/secrets 파일, 개인키 파일이
 * AI prompt나 로그에 섞이지 않도록 막는 보안 gate입니다.
 *
 * @param {string} file - 파일 경로
 * @returns {boolean} - 민감 파일 경로인지 여부
 */
function isSensitiveDiffPath(file) {
  // 문자열이 아니거나 빈 문자열이면 false 반환
  if (typeof file !== "string" || file.length === 0) {
    return false;
  }

  // 파일명의 마지막 부분만 추출해 민감 파일인지 확인합니다.
  const baseName = getBaseName(file).toLowerCase();

  // .env, .env.local, .pem, .key 로 시작하는 파일은 민감한 파일로 취급합니다.
  return (
    SENSITIVE_FILE_NAMES.has(baseName) ||
    baseName.startsWith(".env.") ||
    baseName.endsWith(".pem") ||
    baseName.endsWith(".key")
  );
}

/**
 * git status --porcelain 출력에서 따옴표로 감싸진 경로를 원래 경로 문자열로 되돌립니다.
 * 공백이나 특수문자가 있는 파일명이 "file name.js"처럼 표시되는 경우, 후속 git diff/add pathspec에 그대로 넣을 수 있게 정리합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {string} - 정규화된 파일 경로
 */
function unquoteGitPath(file) {
  // 따옴표로 감싸진 경로라면 해당 경로를 원래 경로 문자열로 되돌림
  if (file.startsWith('"') && file.endsWith('"')) {
    return file.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }

  // 따옴표로 감싸지지 않은 경로는 그대로 반환
  return file;
}

/**
 * git status --porcelain 한 줄에서 변경된 파일 경로만 추출합니다.
 * porcelain v1은 앞 2글자가 상태, 3번째 글자가 공백, 그 뒤가 경로이므로 line.slice(3)을 사용합니다.
 * rename 출력은 "old -> new" 형태이므로 실제 diff/add 대상이 되는 새 경로만 반환합니다.
 *
 * @param {string} line - git status --porcelain 출력 라인
 * @returns {string} - 정규화된 파일 경로
 */
function parseChangedFileLine(line) {
  // 출력 라인에서 3번째 글자부터 자름
  const rawPath = line.slice(3);
  // 화살표 문자열 지정
  const renameSeparator = " -> ";

  // rawpath에 화살표 문자열이 포함되어 있다면 rename된 경우
  if (rawPath.includes(renameSeparator)) {
    // " " 뒤에 오는 파일 경로를 반환합니다.
    return unquoteGitPath(rawPath.split(renameSeparator).pop());
  }

  // 일반적인 경우 " " 뒤에 오는 파일 경로를 반환합니다.
  return unquoteGitPath(rawPath);
}

/**
 * 특정 파일 하나의 HEAD 대비 diff를 가져옵니다.
 * core.quotepath=false를 지정해 한글 등 non-ASCII 파일명이 escape되지 않게 하고, "--" 뒤에 파일 경로를 단일 인자로 전달합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {string} - diff 문자열
 */
function getDiffForTrackedFile(file) {
  // 특정 파일 하나의 HEAD 대비 diff를 가져옵니다.
  // core.quotepath=false를 지정해 한글 등 non-ASCII 파일명이 escape되지 않게 하고, "--" 뒤에 파일 경로를 단일 인자로 전달합니다.
  // Git은 "--" 뒤의 값도 `:(glob)**` 같은 pathspec magic으로 해석할 수 있습니다.
  // 파일 경로는 argv 배열로 전달하더라도 pathspec 확장까지 막아야 민감 파일 제외 정책이 우회되지 않습니다.
  return runGit([
    "--literal-pathspecs",
    "-c",
    "core.quotepath=false",
    "diff",
    "HEAD",
    "--",
    file,
  ]);
}

/**
 * Untracked file을 다룰 때 오류(exit code 1)가 발생하더라도
 * stdout으로 공백 없는 diff 문자열이 오면 그것을 diff로 취급해 반환합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {string} - diff 문자열
 */
function getDiffForUntrackedFile(file) {
  // Untracked file을 다룰 때 오류(exit code 1)가 발생하더라도
  // stdout으로 공백 없는 diff 문자열이 오면 그것을 diff로 취급해 반환합니다.
  try {
    // untracked 파일의 diff를 가져옵니다.
    // --no-index 옵션은 index에 없는 파일을 다룰 때 사용합니다.
    // "/dev/null"은 비교 대상 파일로, untracked 파일과 비교해 diff를 생성합니다.
    return runGit([
      // untracked 파일 diff도 Git pathspec 해석을 거치므로 literal 모드로 고정합니다.
      // 이렇게 해야 파일명이 아니라 pathspec으로 범위가 확장되는 입력을 방지할 수 있습니다.
      "--literal-pathspecs",
      "-c",
      "core.quotepath=false",
      "diff",
      "--no-index",
      "--",
      "/dev/null",
      file,
    ]);
    // error가 발생하더라도 stdout에 공백 없는 diff 문자열이 오면 그것을 diff로 취급해 반환
  } catch (error) {
    if (isGitDiffExit(error)) {
      return error.stdout;
    }
    // 그 외의 오류는 그대로 throw
    throw error;
  }
}

/**
 * 해당 파일이 untracked 파일인지 확인합니다.
 *
 * @param {string} file - 파일 경로
 * @returns {boolean} - untracked 파일 여부
 */
function isUntrackedFile(file) {
  // output은 공백없는 문자열이므로 정규식으로 untracked 파일인지 확인합니다.
  // porcelian v1에서 untracked 파일은 line 시작이 "?? " 입니다.
  const output = execFileSync(
    "git",
    [
      // 단일 파일의 untracked 여부를 확인할 때도 pathspec magic을 비활성화합니다.
      // status 범위가 넓어지면 민감 파일이 diff 후보로 들어올 수 있으므로 조회 단계부터 literal로 제한합니다.
      "--literal-pathspecs",
      "-c",
      "core.quotepath=false",
      "status",
      "--porcelain",
      "--",
      file,
    ],
    {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  // true : untracked file (git status --porcelain 결과가 "?? "로 시작하는 신규 파일)
  // false: tracked file (결과가 비어있거나, " M", "A " 등 다른 상태 코드로 시작하는 기존 파일)
  // test() 메서드는 정규식 패턴("?? ")이 출력 결과에 포함되어 있으면 true를 반환합니다.
  return UNTRACKED_STATUS_LINE_PATTERN.test(output);
}

// untracked file인 경우 git diff --no-index -- /dev/null <file>을 사용해 diff를 가져오고,
// tracked file인 경우 git diff HEAD -- <file>을 사용해 diff를 가져옵니다.
function getDiffForFile(file) {
  if (isUntrackedFile(file)) {
    return getDiffForUntrackedFile(file);
  }

  return getDiffForTrackedFile(file);
}

/**
 * 현재 작업 디렉터리가 Git 저장소 내부인지 확인합니다.
 * 사용자에게 직접 출력하지 않고 boolean만 반환해 command layer가 상황에 맞는 안내를 결정할 수 있게 합니다.
 * @returns {boolean} - Git 저장소 여부
 */
export function isGitRepository() {
  try {
    // rev-parse --is-inside-work-tree는 Git 저장소이면 "true"를, 아니면 "false"를 출력합니다.
    const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    });

    // true : Git 저장소
    // false: Git 저장소가 아님
    return output.trim() === "true";
  } catch {
    // 명령 실행 실패 시 Git 저장소가 아닌 것으로 간주해 false 반환
    return false;
  }
}

/**
 * 현재 Git 저장소에서 변경된 파일 목록을 반환합니다.
 * modified, staged, deleted, untracked, renamed 파일을 status --porcelain 기준으로 수집하고, 출력이 비어 있으면 빈 배열을 반환합니다.
 * @returns {string[]} - 변경된 파일 목록
 */
export function getChangedFiles() {
  // porcelain 모드로 현재 Git 저장소에서 변경된 파일 목록을 가져옵니다.
  // core.quotepath=false 옵션으로 비 ASCII 파일 경로가 escape 되지 않게 하고,
  // status --porcelain 명령어는 변경된 파일 목록을 "<status> <file>" 형식으로 출력합니다.
  const output = execFileSync(
    "git",
    ["-c", "core.quotepath=false", "status", "--porcelain", "-uall"],
    {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  // porcelain 결과가 비어 있으면 빈 배열 반환
  if (!output.trim()) {
    return [];
  }

  // porcelain 결과를 줄 단위로 분리하고, 빈 줄을 제거한 후, 파일 경로만 추출합니다.
  return output.split(/\r?\n/).filter(Boolean).map(parseChangedFileLine);
}

/**
 * 변경된 전체 파일의 diff를 하나의 문자열로 합쳐 반환합니다.
 * 내부적으로 getFileDiffs를 거치므로 민감 파일은 제외되고, untracked-only처럼 diff가 비어 있는 파일도 결과에 포함되지 않습니다.
 * @returns {string} - 전체 diff 문자열
 */
export function getFullDiff() {
  // 변경된 전체 파일의 diff를 하나의 문자열로 합쳐 반환합니다.
  // 내부적으로 getFileDiffs를 거치므로 민감 파일은 제외되고, untracked-only처럼 diff가 비어 있는 파일도 결과에 포함되지 않습니다.
  return getFileDiffs(getChangedFiles())
    .map(({ diff }) => diff)
    .join("");
}

/**
 * 전달받은 파일 목록을 파일별 diff 배열로 변환합니다.
 * 반환 형식은 { file, diff }이며, step 모드에서 파일별 커밋 메시지를 만들 때 사용할 수 있습니다.
 * 잘못된 입력은 TypeError로 중단하고, 빈 경로/비문자열/민감 파일/빈 diff는 결과에서 제외합니다.
 * @param {string[]} files - 파일 경로 배열
 * @returns {{file: string, diff: string}[]} - 파일별 diff 배열
 */
export function getFileDiffs(files) {
  // 입력값이 배열이 아니면 TypeError throw
  if (!Array.isArray(files)) {
    throw new TypeError("files must be an array");
  }

  // 파일별 diff 배열 초기화
  const fileDiffs = [];

  // 각 파일에 대해 순회를 하게 됩니다.
  for (const file of files) {
    // 파일 경로가 유효하지 않거나 민감한 파일이면 continue
    if (
      typeof file !== "string" ||
      file.length === 0 ||
      isSensitiveDiffPath(file)
    ) {
      continue;
    }

    // diff 가져오기
    const diff = getDiffForFile(file);

    // diff가 없으면 continue
    if (!diff.trim()) {
      continue;
    }

    // 파일명과 diff를 push
    fileDiffs.push({ file, diff });
  }

  // 파일별 diff 배열 반환
  return fileDiffs;
}

/**
 * 모든 변경사항을 staging합니다.
 * batch 모드에서 한 번의 커밋으로 전체 변경사항을 묶기 위해 git add -A를 사용하며, 신규/수정/삭제 파일을 모두 포함합니다.
 *
 */
export function addAll() {
  try {
    // git add -A 실행
    runGit(["add", "-A"]);
  } catch (error) {
    // diff 원문이나 파일 경로는 로그에 남기지 않고, 상위 workflow가 실패를 처리할 수 있도록 예외를 다시 던집니다.
    logError("Failed to stage changes.");
    throw error;
  }
}

/**
 * 지정한 파일 하나만 staging합니다.
 * step 모드에서 파일별 커밋을 만들 때 사용하며, 파일 경로가 비어 있거나 문자열이 아니면 Git 실행 전에 차단합니다.
 * @param {string} file - 파일 경로
 */
export function addFile(file) {
  // 파일 경로가 유효하지 않으면 TypeError throw
  if (typeof file !== "string" || file.length === 0) {
    throw new TypeError("file must be a non-empty string");
  }

  try {
    // "--" 뒤의 값은 옵션이 아니라 pathspec으로 해석되므로, 하이픈으로 시작하는 파일명도 안전하게 처리할 수 있습니다.
    // `--`는 옵션 해석만 끝내며 Git pathspec magic 자체를 끄지는 않습니다.
    // `--literal-pathspecs`를 같이 사용해 `:(glob)**` 같은 값이 stage 범위를 넓히지 못하게 합니다.
    runGit(["--literal-pathspecs", "add", "--", file]);
  } catch (error) {
    // Git 실패 stderr에는 환경 정보나 경로가 포함될 수 있어 일반 메시지만 남기고 원본 에러는 호출자에게 전파합니다.
    logError("Failed to stage file.");
    throw error;
  }
}

/**
 * staging된 변경사항을 전달받은 메시지로 커밋합니다.
 * 커밋 메시지는 argv 배열의 단일 인자로 전달하므로 따옴표, 개행, 특수문자, emoji가 shell에서 재해석되지 않습니다.
 * @param {string} message - 커밋 메시지
 * @param {string[]} files - 파일 목록
 */
export function commit(message, files = []) {
  // 커밋 메시지가 유효하지 않으면 TypeError throw
  if (typeof message !== "string" || message.trim().length === 0) {
    throw new TypeError("message must be a non-empty string");
  }

  // 파일 목록이 배열이 아니면 TypeError throw
  if (!Array.isArray(files)) {
    throw new TypeError("files must be an array");
  }

  // 파일 목록 순회
  for (const file of files) {
    // 파일 경로가 유효하지 않으면 TypeError throw
    if (typeof file !== "string" || file.length === 0) {
      throw new TypeError("files must contain only non-empty strings");
    }
  }

  try {
    // 파일 목록이 전달된 경우에는 commit pathspec을 함께 넘겨, 이미 staged 되어 있던 다른 파일이
    // 실수로 같은 커밋에 포함되지 않도록 제한합니다. 특히 command 계층에서 민감 파일을 제외한 뒤에도
    // 사용자가 실행 전에 `.env` 등을 staged 해둔 상태일 수 있으므로, pathspec 제한은 마지막 방어선입니다.
    const args =
      files.length > 0
        ? ["--literal-pathspecs", "commit", "-m", message, "--", ...files]
        : ["commit", "-m", message];
    runGit(args);
  } catch (error) {
    // nothing to commit, Git lock, 권한 문제 같은 실제 Git 실패는 상위 commit workflow에서 사용자 안내를 결정하도록 전파합니다.
    logError("Failed to create commit.");
    throw error;
  }
}

/**
 * 현재 브랜치를 원격 저장소로 전파합니다.
 * 이 함수는 commit flow에서 새 커밋이 만들어진 뒤에만 호출되어야 하며,
 * 자체적으로 git add/commit 같은 다른 히스토리 변경 작업을 하지 않습니다.
 * 보안상 Git stderr를 그대로 출력하지 않습니다.
 * 인증 실패 메시지에는 remote URL, 토큰, 사용자명, credential helper 정보가 섞일 수 있으므로
 * 사용자에게는 브랜치와 upstream 수준의 안전한 안내만 보여주고,
 * 원본 오류는 새 안전한 Error로 대체합니다.
 * @returns {void}
 */
export function push() {
  // 현재 브랜치명 가져오기
  const branchName = getCurrentBranchName();
  // 현재 upstream 브랜치명 가져오기
  const upstreamName = getCurrentUpstreamName();

  // 브랜치명이 있으면
  if (branchName) {
    // 브랜치명과 upstream 브랜치명으로 안내 메시지 출력
    logInfo(
      upstreamName
        ? `Pushing branch ${branchName} to ${upstreamName}.`
        : `Pushing branch ${branchName}. No upstream branch was detected.`,
    );
  } else {
    // 브랜치명을 가져올 수 없는 경우
    // log에 현재 checkout된 브랜치명을 가져와 push를 시도한다는 경고 메시지 출력
    logWarn(
      "Current branch name could not be detected. Trying git push with the current checkout.",
    );
  }

  try {
    // shell 문자열을 사용하지 않고 argv 배열로 실행해
    // 브랜치명, path, 메시지 등이 shell 해석을 거치지 않게 합니다.
    runGit(["push"]);
    // 성공 시 log에 푸시 성공 메시지 출력
    logSuccess(branchName ? `Pushed branch ${branchName}.` : "Push completed.");
  } catch {
    // 실패 시 buildPushFailureMessage로 메시지 생성
    const message = buildPushFailureMessage(branchName, upstreamName);
    // log에 에러 메시지 출력
    logError(message);
    // 에러 throw
    throw new Error(message);
  }
}

/**
 *
 * 현재 HEAD 포인터의 해시를 읽습니다.
 * reset workflow에서 beforeHead/afterHead를 결정하는 기준이 됩니다.
 *
 * @returns {string} - 현재 HEAD의 40자 해시 문자열
 */

export function getCurrentHead() {
  try {
    // 현재 HEAD hash는 FIX-RS transaction의 시작/종료 경계값으로 사용합니다.
    // Git stderr에는 로컬 경로나 환경 정보가 포함될 수 있으므로 사용자에게 그대로 노출하지 않습니다.
    return runGit(["rev-parse", "HEAD"]).trim();
  } catch {
    // 오류 발생시 error를 throw
    throw new Error(
      "Failed to read current HEAD. Git error details were hidden.",
    );
  }
}

/**
 * Git graph 검증에 사용할 commit hash가 안전한 40자리 전체 hash인지 확인합니다.
 *
 * @param {*} commitHash - 사용자가 직접 입력한 값이 아니라 reset transaction에서 읽은 commit hash 후보입니다.
 * @returns {boolean} - 값이 문자열이고 40자리 16진수 commit hash 형식이면 true를 반환합니다.
 */
function isFullCommitHash(commitHash) {
  // reset transaction 파일이 수동 편집되었거나 깨진 경우를 대비해 Git 명령 실행 전에 형식을 다시 확인합니다.
  return (
    typeof commitHash === "string" && FULL_COMMIT_HASH_PATTERN.test(commitHash)
  );
}

/**
 * 하나의 commit이 다른 commit의 ancestor인지 확인합니다.
 *
 * @param {string} ancestorHash - reset 시작점으로 기록된 beforeHead hash입니다. 이 commit이 afterHead의 조상이어야 안전한 reset 범위가 됩니다.
 * @param {string} descendantHash - reset 종료점으로 기록된 afterHead hash입니다. 현재 HEAD와 같아야 하고 beforeHead를 포함한 히스토리 위에 있어야 합니다.
 * @returns {boolean} - `ancestorHash`가 `descendantHash`의 ancestor이면 true, 형식 오류나 Git 검증 실패가 있으면 false를 반환합니다.
 */
export function isAncestorCommit(ancestorHash, descendantHash) {
  // 두 hash 모두 40자리 전체 hash일 때만 Git graph 검증을 진행합니다.
  if (!isFullCommitHash(ancestorHash) || !isFullCommitHash(descendantHash)) {
    return false;
  }

  try {
    // `merge-base --is-ancestor A B`는 A가 B의 ancestor이면 exit code 0으로 종료합니다.
    // argv 배열을 사용하므로 hash 문자열이 shell에서 옵션이나 별도 명령으로 재해석되지 않습니다.
    runGit(["merge-base", "--is-ancestor", ancestorHash, descendantHash]);
    // Git 명령이 성공하면 ancestor 관계가 검증된 것입니다.
    return true;
  } catch {
    // exit code 1은 ancestor가 아니라는 의미이고, 그 밖의 Git 오류도 reset을 중단해야 하는 안전 실패로 처리합니다.
    return false;
  }
}

/**
 * 두 commit 사이의 실제 commit hash 목록을 Git graph 기준으로 조회합니다.
 *
 * @param {string} beforeHash - 범위에서 제외되는 시작 commit입니다. reset 실행 시 돌아갈 대상이므로 `rev-list before..after`의 왼쪽 값입니다.
 * @param {string} afterHash - 범위에 포함되는 종료 commit입니다. 마지막 convention commit이므로 `rev-list before..after`의 오른쪽 값입니다.
 * @returns {string[]} - `beforeHash` 이후부터 `afterHash`까지의 commit hash를 오래된 순서에서 최신 순서로 반환합니다. 형식 오류나 Git 오류가 있으면 빈 배열을 반환합니다.
 */
export function getCommitHashesBetween(beforeHash, afterHash) {
  // 두 hash 모두 전체 hash 형식이어야 Git range 문자열을 만들 수 있습니다.
  if (!isFullCommitHash(beforeHash) || !isFullCommitHash(afterHash)) {
    return [];
  }

  try {
    // hash 형식 검증을 끝낸 뒤 `before..after` range를 구성합니다.
    // 이 문자열은 shell이 아니라 Git argv의 단일 인자로 전달되므로 shell injection 경로가 아닙니다.
    const output = runGit(["rev-list", "--reverse", `${beforeHash}..${afterHash}`]);
    // 출력이 비어 있으면 두 commit 사이에 commit이 없다는 뜻이므로 빈 배열을 반환합니다.
    if (!output.trim()) {
      return [];
    }

    // rev-list 출력은 한 줄에 하나의 commit hash가 오므로 줄 단위로 나누고 빈 줄을 제거합니다.
    return output.split(/\r?\n/u).filter(Boolean);
  } catch {
    // 존재하지 않는 hash, 손상된 저장소, Git 오류가 발생하면 reset을 중단할 수 있도록 빈 배열을 반환합니다.
    return [];
  }
}

/**
 * 입력받은 해시로 mixed reset을 실행합니다.
 * 보안상 reset mode 인자는 받지 않고, 오직 beforeHead로만 reset합니다.
 * @param {string} commitHash - 40자 commit 해시 문자열
 */
export function resetToCommit(commitHash) {
  // 입력받은 해시가 40자 commit hash인지 확인
  if (!isFullCommitHash(commitHash)) {
    throw new Error("Reset target must be a full 40-character commit hash.");
  }

  try {
    // transaction에 기록된 beforeHead로만 mixed reset합니다.
    // reset mode를 인자로 받지 않아 --hard 같은 파괴적 옵션이 호출 경로에 들어올 수 없게 합니다.
    runGit(["reset", commitHash]);
  } catch {
    // 오류 발생시 error를 throw
    throw new Error(
      "Failed to reset convention transaction. Git error details were hidden.",
    );
  }
}
