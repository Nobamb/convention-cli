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
 * @param {*} args - git 명령어 인자
 * @returns {string} - 표준 출력
 */
function runGit(args) {
  return execFileSync("git", args, GIT_COMMAND_OPTIONS);
}

/**
 * git 저장소의 .git 디렉터리 경로를 반환합니다.
 *
 * @returns {string} - .git 디렉터리 경로
 */
function getGitDir() {
  // 절대 경로 반환
  const gitDir = runGit(["rev-parse", "--git-dir"]).trim();
  // 상대 경로인 경우 절대 경로로 변환
  return path.isAbsolute(gitDir) ? gitDir : path.resolve(process.cwd(), gitDir);
}

/**
 * git 저장소의 루트 디렉터리 경로를 반환합니다.
 * @returns {string} - 루트 디렉터리 경로
 */
function getRepoRoot() {
  // 절대 경로 반환
  return runGit(["rev-parse", "--show-toplevel"]).trim();
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
    schemaVersion: 1,
    repoRoot: getRepoRoot(),
    startedAt: new Date().toISOString(),
    mode,
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
    // 리포지토리 루트
    repoRoot:
      typeof transaction.repoRoot === "string" ? transaction.repoRoot : "",
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
