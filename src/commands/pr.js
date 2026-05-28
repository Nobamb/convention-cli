import { execFileSync } from "node:child_process";
import {
  DEFAULT_CONFIG,
  DEFAULT_LOCAL_LLM_BASE_URL,
} from "../config/defaults.js";
import { loadConfig } from "../config/store.js";
import { buildPrPrompt } from "../core/prPrompt.js";
import {
  assertSafePrContent,
  cleanPrTitle,
  generatePrBody,
  generatePrTitle,
} from "../core/pr.js";
import {
  checkGhAuth,
  createPullRequest,
  detectGitHubRemote,
  isGhCliAvailable,
} from "../core/github.js";
import { getChangedFiles, getFileDiffs, isGitRepository } from "../core/git.js";
import { error, info, success, warn } from "../utils/logger.js";
import {
  PR_PREVIEW_DECISIONS,
  confirmExternalProviderRequest,
  editPrManually,
  printPrPreview,
  selectPrPreviewAction,
} from "../utils/ui.js";

// Git 명령 공통 옵션입니다.
// stderr는 pipe로 받되 사용자에게 그대로 보여주지 않아 remote credential이나 인증 세부 정보 노출을 막습니다.
const GIT_COMMAND_OPTIONS = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
};

// 로컬 LLM으로 간주할 hostname 목록입니다.
// commit flow의 외부 전송 판정과 같은 기준을 사용해 원격 localLLM endpoint는 외부 전송 확인 대상으로 봅니다.
const LOCAL_LLM_LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

/**
 * Git 명령을 argv 배열 방식으로 실행합니다.
 *
 * @param {string[]} args - git 인자 배열
 * @returns {string} stdout
 */
function runGit(args) {
  return execFileSync("git", args, GIT_COMMAND_OPTIONS);
}

/**
 * 문자열을 줄 단위 배열로 정리합니다.
 *
 * @param {string} value - git 출력
 * @returns {string[]} 비어 있지 않은 줄 배열
 */
function splitLines(value) {
  return String(value ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 현재 branch 이름을 조회합니다.
 *
 * @returns {string} 현재 branch
 */
function getCurrentBranch() {
  const branch = runGit(["branch", "--show-current"]).trim();

  // 현재 branch를 가져오지 못하면 에러
  if (!branch) {
    throw new Error("Current branch could not be detected.");
  }

  return branch;
}

/**
 * 주어진 Git ref가 존재하는지 확인합니다.
 *
 * @param {string} ref - branch 또는 remote ref
 * @returns {boolean} 존재하면 true
 */
function gitRefExists(ref) {
  try {
    runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * origin의 기본 branch를 추정합니다.
 *
 * @returns {string|null} origin/main 같은 remote ref 또는 null
 */
function getOriginDefaultBranch() {
  try {
    const output = runGit([
      "symbolic-ref",
      "--quiet",
      "--short",
      "refs/remotes/origin/HEAD",
    ]).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * PR target으로 사용할 base branch를 결정합니다.
 *
 * @param {string|undefined} requestedBase - CLI 옵션으로 받은 base branch
 * @returns {{ gitRef: string, prBase: string }} Git 비교 ref와 gh PR base 인자
 */
function resolveBaseBranch(requestedBase) {
  // --base 옵션이 있으면 해당 branch를 사용
  if (typeof requestedBase === "string" && requestedBase.trim().length > 0) {
    const gitRef = requestedBase.trim();

    // base branch가 존재하지 않으면 에러
    if (!gitRefExists(gitRef)) {
      throw new Error(`Base branch was not found: ${gitRef}`);
    }

    // origin/main 형식에서 origin/ 접두사를 제거하고 gh pr create에 사용할 기본값으로 준비합니다.
    return {
      gitRef,
      prBase: gitRef.replace(/^origin\//u, ""),
    };
  }

  // --base 옵션이 없으면 기본값 후보들을 순서대로 시도합니다.
  const candidates = [
    getOriginDefaultBranch(),
    "main",
    "master",
    "origin/main",
    "origin/master",
  ].filter(Boolean);

  // candidates를 candidate로 순회
  // 첫 번째로 존재하는 candidate를 사용
  for (const candidate of candidates) {
    // base branch가 존재하면
    if (gitRefExists(candidate)) {
      // gitRef를 base branch로 설정하고
      // prBase를 origin/ 접두사를 제거해서 반환
      return {
        gitRef: candidate,
        prBase: candidate.replace(/^origin\//u, ""),
      };
    }
  }

  // 기본값 후보들이 모두 존재하지 않으면 에러
  throw new Error("Base branch could not be detected. Use --base <branch>.");
}

/**
 * base branch 이후 commit log를 안전한 한 줄 요약 목록으로 수집합니다.
 *
 * @param {string} baseRef - Git 비교 기준 ref
 * @returns {string} commit log
 */
function getCommitLogSinceBase(baseRef) {
  try {
    return runGit(["log", "--oneline", `${baseRef}..HEAD`]).trim();
  } catch {
    // 에러가 발생하면 빈 문자열 반환
    return "";
  }
}

/**
 * base branch와 HEAD 사이의 변경 파일 목록을 수집합니다.
 *
 * @param {string} baseRef - Git 비교 기준 ref
 * @returns {string[]} 파일 목록
 */
function getBranchChangedFiles(baseRef) {
  try {
    return splitLines(
      runGit([
        "-c",
        "core.quotepath=false",
        "diff",
        "--name-only",
        `${baseRef}...HEAD`,
      ]),
    );
  } catch {
    // 에러가 발생하면 빈 배열 반환
    return [];
  }
}

/**
 * 중복 파일명을 제거하되 처음 등장한 순서를 유지합니다.
 *
 * @param {string[]} files - 파일 목록
 * @returns {string[]} 중복 제거 파일 목록
 */
function uniqueFiles(files) {
  // set을 사용해서 중복 제거
  const seen = new Set();
  // 결과를 저장할 배열, 빈 배열로 초기화
  const result = [];

  // files를 순회
  for (const file of Array.isArray(files) ? files : []) {
    // 파일이 유효하고 seen에 없으면
    if (
      typeof file !== "string" ||
      file.trim().length === 0 ||
      seen.has(file)
    ) {
      // 다음 인자로 넘어감
      continue;
    }

    // seen에 추가
    seen.add(file);
    // result에 추가
    result.push(file);
  }

  // 중복 제거된 파일 목록 반환
  return result;
}

/**
 * raw diff 없이 PR prompt에 넣을 변경 요약을 만듭니다.
 *
 * @param {object} params
 * @param {string} params.baseRef - Git 비교 기준 ref
 * @param {Array} params.fileDiffs - working tree 파일별 diff metadata
 * @param {string[]} params.changedFiles - 변경 파일 목록
 * @returns {string} 안전한 변경 요약
 */
function buildSafeDiffSummary({ baseRef, fileDiffs, changedFiles }) {
  // 변경 사항을 담을 빈 배열
  const lines = [];

  try {
    // base와 HEAD 사이의 변경 파일들을 stat으로 수집
    const stat = runGit([
      "-c",
      "core.quotepath=false",
      "diff",
      "--stat",
      `${baseRef}...HEAD`,
    ]).trim();

    // stat이 있으면 lines에 추가
    if (stat) {
      lines.push("Branch diff stat:");
      lines.push(stat);
    }
  } catch {
    // branch diff stat이 실패해도 working tree metadata가 있으면 PR 문서 생성은 계속할 수 있습니다.
  }

  // workigntree diff metadata가 있으면 lines에 추가
  if (Array.isArray(fileDiffs) && fileDiffs.length > 0) {
    lines.push("Working tree diff metadata:");
    // fileDiffs를 순회
    for (const { file, diff } of fileDiffs) {
      // diff 라인 수 계산
      // 만약 diff가 문자열 형태라면 줄 바꿈 문자 기준으로 분리해서 그 길이를 lineCount에 저장
      // 그 외의 경우에는 0으로 저장
      const lineCount =
        typeof diff === "string" ? diff.split(/\r?\n/u).length : 0;
      // lines에 추가
      lines.push(`- ${file}: ${lineCount} diff lines`);
    }
  }

  // 만약 lines 배열의 길이가 0이고 changedFiles 배열의 길이가 0보다 크면 lines 배열에 변경 파일 목록 추가
  if (lines.length === 0 && changedFiles.length > 0) {
    lines.push("Changed files only; raw diff was not included:");
    //changedFiles 배열을 순회하면서 lines에 추가
    for (const file of changedFiles) {
      lines.push(`- ${file}`);
    }
  }

  // lines 배열을 줄 바꿈 문자로 연결
  const summary = lines.join("\n").trim();

  // summary가 없으면 에러
  if (!summary) {
    throw new Error("No PR changes were found.");
  }

  // 작업한 내용을 반환
  return summary;
}

/**
 * 현재 설정이 외부 AI 전송 확인이 필요한 provider인지 판단합니다.
 *
 * @param {object} config - 런타임 설정
 * @returns {boolean} 외부 전송 확인 대상이면 true
 */
function isExternalAIProvider(config = {}) {
  // gemini, openaiCompatible, codex-mcp이면 외부 전송 확인 대상
  if (
    config.provider === "gemini" ||
    config.provider === "openaiCompatible" ||
    config.provider === "codex-mcp"
  ) {
    return true;
  }

  // localLLM이면 외부 전송 확인 대상
  if (config.provider === "localLLM") {
    try {
      // baseURL이 있으면 해당 URL을 사용하고, 없으면 DEFAULT_LOCAL_LLM_BASE_URL을 사용
      const parsed = new URL(config.baseURL || DEFAULT_LOCAL_LLM_BASE_URL);
      // hostname이 LOCAL_LLM_LOCAL_HOSTNAMES에 없으면 true 반환
      return !LOCAL_LLM_LOCAL_HOSTNAMES.has(parsed.hostname);
    } catch {
      // 에러 발생시 true 반환
      return true;
    }
  }

  // false 반환
  return false;
}

/**
 * PR 제목/본문 생성을 위해 Git 컨텍스트와 안전한 prompt를 준비합니다.
 *
 * @param {object} options - CLI 옵션
 * @param {object} config - 런타임 설정
 * @returns {object} PR 생성 컨텍스트
 */
function collectPrContext(options, config) {
  // head가 있으면 head를 사용하고, 없으면 getCurrentBranch()를 사용
  const currentBranch = options.head || getCurrentBranch();
  // base가 있으면 base를 사용하고, 없으면 resolveBaseBranch()를 사용
  const base = resolveBaseBranch(options.base);
  // base와 head 사이의 변경 파일들을 가져옴
  const branchFiles = getBranchChangedFiles(base.gitRef);
  // workingTree의 변경 파일들을 가져옴
  const workingTreeFiles = getChangedFiles();
  // branchFiles와 workingTreeFiles를 합치고 중복을 제거한 파일 목록을 가져옴
  const changedFiles = uniqueFiles([...branchFiles, ...workingTreeFiles]);

  // 만약 changedFiles의 길이가 0이면 에러 반환
  if (changedFiles.length === 0) {
    throw new Error("No changes were found for PR generation.");
  }

  // workingTreeFiles의 diff 수집
  const fileDiffs = getFileDiffs(workingTreeFiles);
  // base와 head 사이의 커밋 로그 수집
  const commitLog = getCommitLogSinceBase(base.gitRef);
  // base와 head 사이의 변경 요약 수집
  const diffSummary = buildSafeDiffSummary({
    baseRef: base.gitRef,
    fileDiffs,
    changedFiles,
  });
  // prompt 생성
  const prompt = buildPrPrompt({
    currentBranch,
    baseBranch: base.prBase,
    commitLog,
    diffSummary,
    changedFiles,
    language: config.language || "ko",
    template: config.prTemplate,
  });

  // 수집한 컨텍스트 반환
  return {
    currentBranch,
    baseBranch: base.prBase,
    baseRef: base.gitRef,
    changedFiles,
    commitLog,
    diffSummary,
    prompt,
  };
}

/**
 * PR preview 선택 결과에 따라 print/create/edit/cancel 흐름을 처리합니다.
 *
 * @param {object} params
 * @param {string} params.title - PR 제목
 * @param {string} params.body - PR 본문
 * @param {object} params.context - branch/file 컨텍스트
 * @param {object} params.options - CLI 옵션
 * @param {Function} params.create - PR 생성 함수
 * @returns {Promise<{created: boolean, printed: boolean, canceled: boolean}>}
 */
export async function handlePrPreview({
  title,
  body,
  context,
  options = {},
  create,
} = {}) {
  // title과 body 초기화
  let currentTitle = title;
  let currentBody = body;

  // while true로 무한 루프
  while (true) {
    // PR preview 출력
    printPrPreview({
      title: currentTitle,
      body: currentBody,
      base: context?.baseBranch,
      head: context?.currentBranch,
      changedFiles: context?.changedFiles,
    });

    // printOnly 옵션이 있으면 print만 하고 종료
    if (options.printOnly) {
      return { created: false, printed: true, canceled: false };
    }

    // yes 옵션이 있으면 바로 생성
    if (options.yes) {
      // title과 body가 안전한지 확인
      assertSafePrContent({ title: currentTitle, body: currentBody });
      // gh CLI 미설치 또는 인증 실패처럼 실제 PR이 생성되지 않은 경우 create()가 false를 반환합니다.
      // 이 값을 그대로 반영해야 상위 흐름과 테스트가 "생성 시도"와 "생성 성공"을 혼동하지 않습니다.
      const created =
        (await create({ title: currentTitle, body: currentBody })) !== false;
      return { created, printed: false, canceled: false };
    }

    // print/create/edit/cancel 중 하나를 선택
    const decision = await selectPrPreviewAction();

    // print를 선택하면 print만 하고 종료
    if (decision === PR_PREVIEW_DECISIONS.PRINT) {
      return { created: false, printed: true, canceled: false };
    }

    // cancel을 선택하면 취소
    if (decision === PR_PREVIEW_DECISIONS.CANCEL) {
      warn("PR creation canceled.");
      return { created: false, printed: false, canceled: true };
    }

    // edit을 선택하면 편집
    if (decision === PR_PREVIEW_DECISIONS.EDIT) {
      // PR 제목과 본문 편집작업
      const edited = await editPrManually({
        title: currentTitle,
        body: currentBody,
      });

      // 편집이 제대로 안 이루어지면 취소
      if (!edited) {
        return { created: false, printed: false, canceled: true };
      }

      // title과 body 정리
      currentTitle = cleanPrTitle(edited.title);
      currentBody = edited.body;
      // 편집 결과가 안전한지 확인
      assertSafePrContent({ title: currentTitle, body: currentBody });
      // while true 루프 계속
      continue;
    }

    // create를 선택하면 생성
    if (decision === PR_PREVIEW_DECISIONS.CREATE) {
      assertSafePrContent({ title: currentTitle, body: currentBody });
      // 사용자가 Create PR을 선택했더라도 gh 준비 상태가 부족하면 실제 생성은 건너뜁니다.
      // create()의 boolean 결과를 따라가면 UI 안내 이후에도 상태 보고가 정확하게 유지됩니다.
      const created =
        (await create({ title: currentTitle, body: currentBody })) !== false;
      return { created, printed: false, canceled: false };
    }
  }
}

/**
 * `convention --pr` 명령 흐름을 실행합니다.
 *
 * @param {object} [options] - CLI 옵션
 */
export async function runPrCommand(options = {}) {
  // 현재 실행한 작업이 git 저장소가 아니면 에러 메시지 출력 후 종료
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  // 기본 설정과 사용자 설정을 합침
  const config = {
    ...DEFAULT_CONFIG,
    ...loadConfig(),
  };

  // PR 컨텍스트 수집 작업
  const context = collectPrContext(options, config);

  // 외부 ai 사용 여부 확인
  if (isExternalAIProvider(config) && !options.yes) {
    // 외부 ai 사용 승인
    const approved = await confirmExternalProviderRequest({
      provider: config.provider,
      action: "generate PR title/body from Git metadata",
      baseURL: config.baseURL,
    });

    // 외부 ai 사용 승인이 안 이루어지면 경고문 출력 후 취소
    if (!approved) {
      warn("PR title/body generation canceled before external AI request.");
      return;
    }
  }

  // PR 제목 생성 작업
  const title = await generatePrTitle({
    prompt: context.prompt,
    summary: context.diffSummary,
    commitLog: context.commitLog,
    config,
  });
  // PR 본문 생성 작업
  const body = await generatePrBody({
    prompt: context.prompt,
    summary: context.diffSummary,
    changedFiles: context.changedFiles,
    commitLog: context.commitLog,
    tests: options.tests,
    securitySummary:
      "Secret-like values are masked and raw diff content is excluded.",
    config,
  });

  // github remote 감지 작업
  const remote = detectGitHubRemote({
    preferredRemote: options.remote || "origin",
  });

  // github remote이 없으면 경고문 출력 후 종료
  if (!remote) {
    warn("GitHub remote을 찾지 못했습니다. PR 문서만 출력합니다.");
    printPrPreview({
      title,
      body,
      base: context.baseBranch,
      head: context.currentBranch,
      changedFiles: context.changedFiles,
    });
    return;
  }

  // PR 생성 작업
  const create = async ({ title: prTitle, body: prBody }) => {
    // gh cli가 설치되어 있는지 확인
    // 설치되어 있지 않다면 경고문 출력 후 종료
    if (!isGhCliAvailable()) {
      warn(
        "gh CLI가 설치되어 있지 않아 PR을 생성하지 않았습니다. 출력된 PR 문서를 사용해 수동 생성하세요.",
      );
      return false;
    }

    // gh cli 인증이 되어 있는지 확인
    // 인증이 안 되어 있다면 경고문 출력 후 종료
    if (!checkGhAuth()) {
      warn(
        "gh CLI 인증이 확인되지 않아 PR을 생성하지 않았습니다. gh auth login 후 다시 시도하세요.",
      );
      return false;
    }

    // PR 생성 시도
    const output = createPullRequest({
      title: prTitle,
      body: prBody,
      base: context.baseBranch,
      head: context.currentBranch,
      draft: options.draft === true,
    });

    // PR 생성 성공 메시지 출력
    success(
      output || `Pull Request created for ${remote.owner}/${remote.repo}.`,
    );
    return true;
  };

  // PR 미리보기 출력 및 처리 작업
  const result = await handlePrPreview({
    title,
    body,
    context,
    options,
    create,
  });

  // PR 문서 출력만 진행한 경우
  if (result.printed) {
    info("PR 문서 출력만 완료했습니다.");
  }
}
