import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDefaultTemplate, DEFAULT_TEMPLATE } from "./schema.js";
import { validateTemplate } from "./validator.js";

export { DEFAULT_TEMPLATE };

/**
 * 템플릿 후보가 실제로 사용할 수 있는 JSON 객체인지 확인한다.
 * 배열, null, 문자열 같은 값은 JSON 파싱에는 성공해도 템플릿 설정으로
 * 병합하거나 검증하기 어렵기 때문에 S 단계에서는 실패 후보로 취급한다.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * fallback 사유를 남길 때 템플릿 파일 원문이나 JSON parse 상세 오류를 출력하지
 * 않는다. parse 오류에는 입력 일부가 섞일 수 있으므로 source/path와 일반화된
 * 사유만 기록한다.
 *
 * @param {object | undefined} logger
 * @param {{ source: string, path: string }} candidate
 * @param {string} reason
 */
function formatFallbackWarning(candidate, reason) {
  return `템플릿 후보를 건너뜁니다. source=${candidate.source}, path=${candidate.path}, reason=${reason}`;
}

/**
 * 로그가 존재할 경우 fallback 경고 메시지를 로깅합니다.
 * @param {object | undefined} logger
 * @param {{ source: string, path: string }} candidate
 * @param {string} reason
 */
function warnFallback(logger, candidate, reason) {
  if (typeof logger?.warn !== "function") {
    return;
  }

  logger.warn(formatFallbackWarning(candidate, reason));
}

/**
 * 정해진 우선순위에 따라 템플릿 후보 경로를 만든다.
 * 홈 디렉터리 전체를 스캔하지 않고, 사용자 입력으로 후보 목록을 확장하지 않으며,
 * 모든 경로는 path.join()으로 조합한다.
 *
 * @param {string} projectRoot
 * @returns {{ source: string, path: string }[]}
 */
function buildTemplateCandidates(projectRoot) {
  return [
    {
      source: "project-template",
      path: path.join(projectRoot, ".convention", "template.json"),
    },
    {
      source: "project-rc",
      path: path.join(projectRoot, ".conventionrc"),
    },
    {
      source: "user-template",
      path: path.join(os.homedir(), ".config", "convention", "template.json"),
    },
  ];
}

/**
 * 템플릿 후보 파일을 읽고 유효성 검사를 수행합니다.
 * @param {{ source: string, path: string }} candidate
 * @param {object | undefined} logger
 * @returns {{ exists: boolean, ok: boolean, template?: object }}
 */
function readTemplateCandidate(candidate, logger) {
  // 템플릿 파일이 존재하지 않으면 false 반환
  if (!fs.existsSync(candidate.path)) {
    return { exists: false };
  }

  // 템플릿 파일 읽기 및 유효성 검사
  try {
    // 템플릿 파일 읽기
    const rawTemplate = fs.readFileSync(candidate.path, "utf8");
    // JSON 파싱
    const template = JSON.parse(rawTemplate);

    //plain 객체 확인
    if (!isPlainObject(template)) {
      // template은 plain 객체여야 합니다.
      warnFallback(logger, candidate, "template must be a JSON object");
      // 유효하지 않은 템플릿 객체 반환
      return { exists: true, ok: false };
    }

    // 유효한 템플릿 객체를 반환합니다.
    return { exists: true, ok: true, template };
  } catch {
    // 템플릿 파일 로드 실패
    warnFallback(logger, candidate, "template file could not be loaded");
    // 유효하지 않은 템플릿 객체 반환
    return { exists: true, ok: false };
  }
}

/**
 * 프로젝트 템플릿, 프로젝트 rc, 사용자 홈 템플릿, 기본 템플릿 순서로 로드한다.
 * 파일 누락은 정상 fallback 상황으로 보고 로그를 남기지 않는다. 파일이 있지만
 * 읽기/파싱/객체 검증에 실패한 경우에만 선택적 logger로 요약 경고를 남긴다.
 *
 * @param {{ projectRoot?: string, logger?: { warn?: (message: string) => void } }} options
 * @returns {{ template: object, source: string, path: string | null }}
 */
export function loadTemplate(options = {}) {
  // 프로젝트 루트 가져오기
  const projectRoot = options.projectRoot ?? process.cwd();
  // 템플릿 후보 경로 빌드
  const candidates = buildTemplateCandidates(projectRoot);

  for (const candidate of candidates) {
    // 템플릿 파일 읽기 및 유효성 검사
    const loaded = readTemplateCandidate(candidate, options.logger);

    // 템플릿 파일이 존재하지 않거나 유효하지 않은 경우 다음 후보로 넘어감
    if (!loaded.exists || !loaded.ok) {
      continue;
    }

    // 유효한 템플릿 객체를 반환합니다.
    return {
      template: loaded.template,
      source: candidate.source,
      path: candidate.path,
    };
  }

  // 기본 템플릿 반환
  return {
    template: createDefaultTemplate(),
    source: "default",
    path: null,
  };
}

/**
 * loader의 고정 후보 순서를 그대로 사용하되, schema validator까지 통과한
 * 템플릿만 반환한다. 잘못된 후보가 있으면 다음 후보로 넘어가고, 모두 실패하면
 * 기본 템플릿으로 fallback한다.
 *
 * @param {{ projectRoot?: string }} options
 * @returns {{ template: object, source: string, path: string | null, valid: boolean, fallback: boolean, warnings: string[], errors: string[] }}
 */
export function loadValidatedTemplate(options = {}) {
  // 프로젝트 루트 가져오기
  const projectRoot = options.projectRoot ?? process.cwd();
  // 템플릿 후보 경로 빌드
  const candidates = buildTemplateCandidates(projectRoot);
  // 경고 메시지 배열 초기화
  const warnings = [];
  // 로거 객체 생성
  const logger = {
    warn(message) {
      warnings.push(message);
    },
  };

  // 템플릿 후보 순회
  for (const candidate of candidates) {
    // 템플릿 파일 읽기 및 유효성 검사
    const loaded = readTemplateCandidate(candidate, logger);

    // 템플릿 파일이 존재하지 않거나 유효하지 않은 경우 다음 후보로 넘어감
    if (!loaded.exists || !loaded.ok) {
      continue;
    }

    // 템플릿 유효성 검사
    const validation = validateTemplate(loaded.template);

    // 템플릿 유효성 검사 실패
    if (!validation.valid) {
      // 유효성 검사 실패 사유 조립
      const reason = validation.errors.join("; ");
      // 경고 메시지 추가
      warnings.push(formatFallbackWarning(candidate, reason));
      // 다음 후보로 넘어감
      continue;
    }

    // 유효한 템플릿 객체를 반환합니다.
    // template: 유효한 템플릿 객체
    // source: 템플릿 후보 이름
    // path: 템플릿 파일 경로
    // valid: 유효성 검사 통과 여부
    // fallback: fallback 여부 확인
    // warnings: fallback 경고 메시지 배열
    // errors: 유효성 검사 실패 사유 배열
    return {
      template: validation.template,
      source: candidate.source,
      path: candidate.path,
      valid: true,
      fallback: warnings.length > 0,
      warnings,
      errors: [],
    };
  }

  // 기본 템플릿 반환
  // template: 기본 템플릿 객체
  // source: 기본 템플릿 이름
  // path: 기본 템플릿 파일 경로 없음
  // valid: 유효성 검사 통과 여부 (항상 true)
  // fallback: fallback 여부 확인 (항상 true)
  // warnings: fallback 경고 메시지 배열
  // errors: 유효성 검사 실패 사유 배열
  return {
    template: createDefaultTemplate(),
    source: "default",
    path: null,
    valid: warnings.length === 0,
    fallback: warnings.length > 0,
    warnings,
    errors: warnings.length > 0 ? ["template fallback used"] : [],
  };
}
