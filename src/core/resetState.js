import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// 40자 해시 패턴
const HASH_PATTERN = /^[0-9a-f]{40}$/i;
// convention 상태 디렉터리 이름
const STATE_DIR_NAME = "convention";
// 마지막 실행 기록 파일 이름
const LAST_RUN_FILE_NAME = "last-run.json";

// git 명령 실행 시 encoding 방식 및 stdio 설정 모음
const GIT_COMMAND_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
};

/**
 * git 실행 함수
 *
 * @param {*} args - git 명령어 인자 배열입니다. shell 문자열을 만들지 않고 `execFileSync("git", args)`의 두 번째 인자로 그대로 전달합니다.
 * @returns {string} - Git 명령의 표준 출력 문자열입니다. stderr는 호출자가 사용자에게 직접 보여주지 않도록 pipe로만 받습니다.
 */
function runGit(args) {
  // Git 명령은 shell을 거치지 않고 argv 배열로 실행하여 인자 재해석이나 shell injection 가능성을 줄입니다.
  return execFileSync("git", args, GIT_COMMAND_OPTIONS);
}

/**
 * git 저장소의 .git 디렉터리 경로를 반환합니다.
 *
 * @returns {string} - .git 디렉터리 경로
 */
function getGitDir() {
  // `rev-parse --git-dir`는 현재 위치가 저장소 루트가 아닌 하위 디렉터리여도 실제 Git dir 위치를 알려줍니다.
  const gitDir = runGit(["rev-parse", "--git-dir"]).trim();
  // Git이 절대 경로를 반환하면 그대로 사용하고, 상대 경로를 반환하면 현재 작업 디렉터리 기준 절대 경로로 변환합니다.
  // 이 절대 경로는 상태 파일을 쓰기 위한 내부 경로 계산에만 쓰고, last-run.json 내용에는 저장하지 않습니다.
  return path.isAbsolute(gitDir) ? gitDir : path.resolve(process.cwd(), gitDir);
}

/**
 * 해시 값 유효성 검사
 * @param {*} value - 해시 값
 * @returns {boolean} - 유효성 여부
 */
function isValidHash(value) {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

/**
 * 안전한 상대 파일 경로인지 검증합니다.
 * @param {*} file - 파일 경로
 * @returns {boolean} - 유효성 여부
 */
function isSafeRelativeFilePath(file) {
  if (typeof file !== "string" || file.trim().length === 0) {
    return false;
  }

  // reset 상태 파일에는 저장소 밖 절대 경로를 남기지 않습니다.
  // 상대 경로만 저장해야 개인 PC 경로나 민감한 디렉터리 구조가 기록되지 않습니다.
  if (path.isAbsolute(file)) {
    return false;
  }

  // 백슬래시를 슬래시로 통일
  const normalized = file.replaceAll("\\", "/");
  // 상위 디렉터리로 이동하는 경로 방지
  return !normalized.split("/").includes("..");
}

/**
 * 커밋 엔트리 정규화
 * @param {*} entry - 커밋 엔트리
 * @returns {Object} - 정규화된 커밋 엔트리
 */
function normalizeCommitEntry(entry) {
  // 엔트리가 객체가 아니면 null 반환
  if (!entry || typeof entry !== "object") {
    return null;
  }

  // 해시 값이 유효하지 않으면 null 반환
  if (!isValidHash(entry.hash)) {
    return null;
  }

  // 파일 배열이 유효하지 않으면 null 반환
  if (
    !Array.isArray(entry.files) ||
    !entry.files.every(isSafeRelativeFilePath)
  ) {
    return null;
  }

  // 유효한 엔트리 반환
  return {
    hash: entry.hash,
    message: typeof entry.message === "string" ? entry.message : "",
    files: entry.files,
  };
}

/**
 * reset 상태 파일 경로 반환
 * @returns {string} - reset 상태 파일 경로
 */
export function getResetStatePath() {
  // reset 상태 파일 경로 반환
  return path.join(getGitDir(), STATE_DIR_NAME, LAST_RUN_FILE_NAME);
}

/**
 * 컨벤션 실행 트랜잭션 생성
 * @param {*} mode - 컨벤션 실행 모드
 * @returns {Object} - 컨벤션 실행 트랜잭션
 */
export function createConventionRunTransaction(mode) {
  // 컨벤션 실행 트랜잭션 생성
  return {
    // schemaVersion은 저장된 reset 상태 파일의 구조를 구분하기 위한 숫자입니다.
    schemaVersion: 1,
    // repoRoot 같은 저장소 절대 경로는 개인정보성 로컬 경로를 포함할 수 있으므로 새 transaction에 저장하지 않습니다.
    // reset에 필요한 경계값은 beforeHead/afterHead와 commit hash 목록뿐입니다.
    // startedAt은 사용자가 preview에서 실행 시점을 추적할 수 있게 하는 메타데이터이며 secret이나 절대 경로를 포함하지 않습니다.
    startedAt: new Date().toISOString(),
    // mode는 step/batch/group 중 어떤 commit flow에서 만들어진 transaction인지 보여주는 표시용 값입니다.
    mode,
    // commits는 실제 commit이 성공한 뒤 recordResetTransactionCommit()에서 채워지는 목록입니다.
    commits: [],
  };
}

/**
 * 마지막 컨벤션 실행 유효성 검사
 * @param {*} transaction - 마지막 컨벤션 실행 트랜잭션
 * @returns {boolean} - 유효성 여부
 */
export function validateLastConventionRun(transaction) {
  // 트랜잭션이 유효하지 않으면 false 반환
  if (!transaction || typeof transaction !== "object") {
    return false;
  }

  // 스키마 버전이 유효하지 않으면 false 반환
  if (transaction.schemaVersion !== 1) {
    return false;
  }

  // beforeHead 또는 afterHead가 유효하지 않으면 false 반환
  if (
    !isValidHash(transaction.beforeHead) ||
    !isValidHash(transaction.afterHead)
  ) {
    return false;
  }

  // 커밋 배열이 유효하지 않으면 false 반환
  if (!Array.isArray(transaction.commits) || transaction.commits.length === 0) {
    return false;
  }

  // 커밋 엔트리가 유효한지 검사
  return transaction.commits.every((entry) => normalizeCommitEntry(entry));
}

/**
 * 마지막 컨벤션 실행 정규화
 * @param {*} transaction - 마지막 컨벤션 실행 트랜잭션
 * @returns {Object} - 정규화된 마지막 컨벤션 실행
 */
export function normalizeLastConventionRun(transaction) {
  // 유효성 검사
  if (!validateLastConventionRun(transaction)) {
    return null;
  }

  // 정규화된 마지막 컨벤션 실행 반환
  return {
    // 스키마 버전
    schemaVersion: 1,
    // 과거 버전 상태 파일에 repoRoot가 들어 있더라도 새로 저장할 때는 의도적으로 제외합니다.
    // repoRoot는 사용자명이나 로컬 디렉터리 구조를 포함할 수 있고, reset 실행에는 필요하지 않습니다.
    // 시작 시간
    startedAt:
      typeof transaction.startedAt === "string" ? transaction.startedAt : "",
    // 종료 시간
    finishedAt:
      typeof transaction.finishedAt === "string" ? transaction.finishedAt : "",
    // 실행 모드
    mode: typeof transaction.mode === "string" ? transaction.mode : "unknown",
    // 이전 헤드
    beforeHead: transaction.beforeHead,
    // 이후 헤드
    afterHead: transaction.afterHead,
    // 커밋 목록
    commits: transaction.commits.map(normalizeCommitEntry),
  };
}

/**
 * 마지막 컨벤션 실행 로드
 * @returns {Object|null} - 마지막 컨벤션 실행 트랜잭션
 */
export function loadLastConventionRun() {
  // 리셋 상태 파일 경로 반환
  const statePath = getResetStatePath();

  // 파일이 존재하지 않으면 null 반환
  if (!fs.existsSync(statePath)) {
    return null;
  }

  // JSON 파싱 및 유효성 검사
  try {
    // JSON 파싱
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    // 유효성 검사
    return normalizeLastConventionRun(parsed);
  } catch {
    // 깨진 JSON이나 예전 schema는 자동 reset 대상으로 삼지 않습니다.
    // 잘못된 상태 파일을 억지로 해석하면 사용자 commit까지 되돌릴 수 있으므로 null로 안전하게 중단시킵니다.
    return null;
  }
}

/**
 * 마지막 컨벤션 실행 저장
 * @param {*} transaction - 마지막 컨벤션 실행 트랜잭션
 */
export function saveLastConventionRun(transaction) {
  // 마지막 컨벤션 실행 정규화
  const normalized = normalizeLastConventionRun(transaction);

  // 유효하지 않은 마지막 컨벤션 실행은 저장하지 않음
  if (!normalized) {
    throw new Error("Invalid convention reset transaction.");
  }

  // reset 상태 파일 경로 반환
  const statePath = getResetStatePath();
  // 임시 파일 경로
  const tempPath = `${statePath}.tmp`;

  // reset 상태 디렉터리 생성
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  // 임시 파일에 마지막 컨벤션 실행 저장
  fs.writeFileSync(
    tempPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );

  // 임시 파일을 reset 상태 파일로 변경
  fs.renameSync(tempPath, statePath);
}

/**
 * 마지막 컨벤션 실행 초기화
 */
export function clearLastConventionRun() {
  // reset 상태 파일 경로 반환
  const statePath = getResetStatePath();

  // reset 상태 파일 삭제
  if (fs.existsSync(statePath)) {
    fs.rmSync(statePath, { force: true });
  }
}
