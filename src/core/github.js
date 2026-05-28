import { execFileSync } from "node:child_process";
import { redactSecrets } from "../utils/logger.js";

// GitHub PR 연동에서 사용하는 명령 실행 옵션입니다.
// stdout/stderr를 pipe로 받아 원문 stderr가 사용자 로그로 직접 흘러가지 않도록 호출자가 통제합니다.
const COMMAND_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
};

/**
 * GitHub repository 이름에서 .git suffix를 제거합니다.
 *
 * @param {string} repo - remote URL에서 추출한 repo 후보
 * @returns {string} 정규화된 repo 이름
 */
function stripGitSuffix(repo) {
  return repo.replace(/\.git$/iu, "");
}

/**
 * owner/repo 값이 GitHub path로 사용하기에 충분히 안전한지 확인합니다.
 *
 * @param {string} owner - GitHub owner 후보
 * @param {string} repo - GitHub repo 후보
 * @returns {boolean} 유효하면 true
 */
function isValidOwnerRepo(owner, repo) {
  // GitHub owner/repo에는 공백이나 slash가 들어갈 수 없으므로 최소한의 방어 검증을 수행합니다.
  const safeSegment = /^[A-Za-z0-9_.-]+$/u;
  return safeSegment.test(owner) && safeSegment.test(repo);
}

/**
 * remote URL에 포함된 credential을 제거합니다.
 *
 * @param {unknown} remoteUrl - Git remote URL
 * @returns {string} credential이 제거된 URL
 */
export function redactRemoteUrl(remoteUrl) {
  // git remote URL을 string으로 변환하고 trim
  // remoteUrl이 존재하지 않으면 빈 문자열 반환
  const value = String(remoteUrl ?? "").trim();

  // git remote URL이 없으면 빈 문자열 반환
  if (!value) {
    return "";
  }

  try {
    // URL을 파싱하여 credential을 제거
    const parsed = new URL(value);
    // username, password, search, hash를 빈 문자열로 처리
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    // 정규화된 URL 반환
    return parsed.toString();
  } catch {
    // scp-style SSH URL(git@github.com:owner/repo.git)은 URL 생성자가 처리하지 못하므로
    // logger의 공통 redaction을 한 번 더 통과시켜 token 형태의 노출을 막습니다.
    return redactSecrets(value);
  }
}

/**
 * GitHub remote URL에서 owner/repo를 추출합니다.
 *
 * @param {unknown} remoteUrl - HTTPS 또는 SSH GitHub remote URL
 * @returns {{ owner: string, repo: string, urlType: string } | null}
 */
export function parseGitHubRemoteUrl(remoteUrl) {
  // git remote URL을 string으로 변환하고 trim
  // remoteUrl이 존재하지 않으면 빈 문자열 반환
  const value = String(remoteUrl ?? "").trim();

  // git remote URL이 없으면 null 반환
  if (!value) {
    return null;
  }

  // git@github.com:owner/repo.git 형태의 scp-style SSH remote를 먼저 처리합니다.
  // 이 형식은 URL 표준 파서로 안전하게 분해하기 어렵기 때문입니다.
  const scpMatch = value.match(/^git@github\.com:([^/\s]+)\/([^/\s]+)$/iu);
  // scpMatch가 존재하면
  if (scpMatch) {
    // owner와 repo 추출
    const owner = scpMatch[1];
    const repo = stripGitSuffix(scpMatch[2]);
    // 유효한 owner/repo이면
    // owner와 repo를 포함한 객체 반환 및 urlType 값을 ssh로 지정
    // 그 외에는 null 반환
    return isValidOwnerRepo(owner, repo)
      ? { owner, repo, urlType: "ssh" }
      : null;
  }

  try {
    // URL 표준 파서로 URL을 파싱
    const parsed = new URL(value);
    // hostname을 소문자로 변환
    const host = parsed.hostname.toLowerCase();

    // hostname이 github.com이 아니면 null 반환
    if (host !== "github.com") {
      return null;
    }

    // pathname을 "/" 기준으로 분리하고 빈 문자열 제거
    const parts = parsed.pathname.split("/").filter(Boolean);

    // parts의 길이가 2 미만이면 null 반환
    if (parts.length < 2) {
      return null;
    }

    // owner와 repo 추출
    // parts 배열에 있는 첫 번째 요소가 owner
    const owner = parts[0];
    // parts 배열에 있는 두 번째 요소에서 .git suffix를 제거한 값을 repo로 설정
    const repo = stripGitSuffix(parts[1]);
    // urlType을 프로토콜에 따라 ssh 또는 https로 설정
    // ssh로 설정되어있다면 ssh, 그 외에는 https
    const urlType = parsed.protocol === "ssh:" ? "ssh" : "https";

    // 유효한 owner/repo이면
    // owner와 repo를 포함한 객체 반환 및 urlType 값을 ssh로 지정
    // 그 외에는 null 반환
    return isValidOwnerRepo(owner, repo) ? { owner, repo, urlType } : null;
  } catch {
    // URL 파싱에 실패하면 null 반환
    return null;
  }
}

/**
 * `git remote -v` 출력 한 줄에서 remote 이름과 URL을 추출합니다.
 *
 * @param {string} line - git remote -v 한 줄
 * @returns {{ remote: string, url: string } | null}
 */
function parseRemoteLine(line) {
  // git remote -v 출력 한 줄에서 remote 이름과 URL을 추출
  // 예: origin https://github.com/owner/repo.git (fetch)
  const match = String(line).match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/u);

  // 매치가 없으면 null 반환
  if (!match) {
    return null;
  }

  // 매치된 결과 match 배열에서 remote와 url 추출
  // remote는 두번째 배열값
  // url은 세번째 배열값
  return {
    remote: match[1],
    url: match[2],
  };
}

/**
 * Git remote 목록에서 GitHub remote를 감지합니다.
 *
 * @param {object} [options]
 * @param {string} [options.preferredRemote="origin"] - 우선 사용할 remote 이름, 기본값 origin
 * @param {string} [options.remoteOutput] - 테스트용 git remote -v 출력 주입값
 * @returns {{ remote: string, owner: string, repo: string, urlType: string } | null}
 */
export function detectGitHubRemote({
  preferredRemote = "origin",
  remoteOutput,
} = {}) {
  // remoteOutput의 값을 output에 저장
  let output = remoteOutput;

  // remoteOutput이 문자열이 아니면
  if (typeof output !== "string") {
    try {
      // git remote -v 실행
      output = execFileSync("git", ["remote", "-v"], COMMAND_OPTIONS);
    } catch {
      // 에러가 발생하면 에러 던짐
      throw new Error(
        "Unable to inspect Git remotes. Git error details were hidden.",
      );
    }
  }

  // GitHub remote 후보를 저장할 배열
  const candidates = [];
  // 중복 후보를 제거하기 위한 Set
  const seen = new Set();

  // output을 줄 단위 배열로 분리하고 빈 줄 제거
  for (const line of output.split(/\r?\n/u).filter(Boolean)) {
    // git remote -v 출력 한 줄에서 remote 이름과 URL을 추출
    const parsedLine = parseRemoteLine(line);

    // 매치가 없으면 다음 줄로 넘어감
    if (!parsedLine) {
      continue;
    }

    // URL을 파싱하여 GitHub remote인지 확인
    const parsedUrl = parseGitHubRemoteUrl(parsedLine.url);

    // GitHub remote가 아니면 다음 줄로 넘어감
    if (!parsedUrl) {
      continue;
    }

    // 중복 후보를 제거하기 위한 key 생성
    const key = `${parsedLine.remote}:${parsedUrl.owner}/${parsedUrl.repo}`;

    // fetch/push 두 줄이 같은 remote로 반복되므로 중복 후보를 제거합니다.
    if (seen.has(key)) {
      continue;
    }

    // 중복 후보 제거를 위해 Set에 추가
    seen.add(key);
    // GitHub remote 후보 배열에 추가
    candidates.push({
      remote: parsedLine.remote,
      ...parsedUrl,
    });
  }

  // candidates에 값이 없으면 null 반환
  if (candidates.length === 0) {
    return null;
  }

  return (
    // candidates에 preferredRemote가 있으면 해당 remote 반환
    candidates.find((candidate) => candidate.remote === preferredRemote) ??
    // preferredRemote가 없으면 origin이 있으면 origin 반환
    candidates.find((candidate) => candidate.remote === "origin") ??
    // origin이 없으면 upstream이 있으면 upstream 반환
    candidates.find((candidate) => candidate.remote === "upstream") ??
    // upstream이 없으면 candidates[0] 반환
    candidates[0]
  );
}

/**
 * gh CLI 설치 여부를 확인합니다.
 *
 * @param {Function} [runner=execFileSync] - 테스트 주입용 실행 함수
 * @returns {boolean} gh CLI를 실행할 수 있으면 true
 */
export function isGhCliAvailable(runner = execFileSync) {
  try {
    // gh --version 실행
    runner("gh", ["--version"], COMMAND_OPTIONS);
    // 성공하면 true 반환
    return true;
  } catch {
    // 에러가 발생하면 false 반환
    return false;
  }
}

/**
 * gh CLI 인증 상태를 확인합니다.
 *
 * @param {Function} [runner=execFileSync] - 테스트 주입용 실행 함수
 * @returns {boolean} 인증되어 있으면 true
 */
export function checkGhAuth(runner = execFileSync) {
  // gh auth status 실행
  try {
    runner("gh", ["auth", "status"], COMMAND_OPTIONS);
    // 성공하면 true 반환
    return true;
  } catch {
    // 에러가 발생하면 false 반환
    return false;
  }
}

/**
 * gh CLI를 통해 GitHub Pull Request를 생성합니다.
 *
 * @param {object} params
 * @param {string} params.title - PR 제목
 * @param {string} params.body - PR 본문
 * @param {string} params.base - target branch
 * @param {string} params.head - head branch
 * @param {boolean} [params.draft=false] - draft PR 생성 여부
 * @param {Function} [params.runner=execFileSync] - 테스트 주입용 실행 함수
 * @returns {string} gh CLI가 반환한 안전한 출력
 */
export function createPullRequest({
  title,
  body,
  base,
  head,
  draft = false,
  runner = execFileSync,
} = {}) {
  // title이 유효한 string이 아닐 경우 에러
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new TypeError("title must be a non-empty string");
  }

  // body가 유효한 string이 아닐 경우 에러
  if (typeof body !== "string" || body.trim().length === 0) {
    throw new TypeError("body must be a non-empty string");
  }

  // base가 유효한 string이 아닐 경우 에러
  if (typeof base !== "string" || base.trim().length === 0) {
    throw new TypeError("base must be a non-empty string");
  }

  // head가 유효한 string이 아닐 경우 에러
  if (typeof head !== "string" || head.trim().length === 0) {
    throw new TypeError("head must be a non-empty string");
  }

  // gh pr create에 사용할 인자 배열 생성
  const args = [
    "pr",
    "create",
    "--title",
    title,
    "--body",
    body,
    "--base",
    base,
    "--head",
    head,
  ];

  // draft인 경우 --draft 옵션 추가
  if (draft) {
    args.push("--draft");
  }

  // gh pr create 실행
  try {
    // gh pr create 실행
    const output = runner("gh", args, COMMAND_OPTIONS);
    // 보안을 위해 secrets 제거 후 공백 제거
    return redactSecrets(output).trim();
  } catch {
    // 에러가 발생하면 에러 던짐
    throw new Error(
      "Failed to create GitHub Pull Request. gh output was hidden.",
    );
  }
}
