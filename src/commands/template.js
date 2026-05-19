import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { createDefaultTemplate } from "../templates/schema.js";
import { loadValidatedTemplate } from "../templates/loader.js";
import { info, redactSecrets, success, warn } from "../utils/logger.js";

// 지원하는 템플릿 명령어 목록
// init: 템플릿 초기화
// show: 현재 적용될 템플릿 표시
// validate: 현재 적용될 템플릿 검증
const TEMPLATE_ACTIONS = ["init", "show", "validate"];

/**
 * 템플릿 명령은 commit flow와 완전히 분리된 관리 명령이다.
 * action이 없으면 현재 적용될 템플릿을 요약해서 보여주고, 알 수 없는 action은
 * commit flow로 넘기지 않고 명확한 오류로 중단한다.
 *
 * @param {Object} templateCommand 커맨드
 * @param {string} templateCommand.init 템플릿 초기화
 * @param {string} templateCommand.show 템플릿 요약
 * @param {string} templateCommand.validate 템플릿 검증
 */
export async function runTemplateCommand(action) {
  // action이 없거나 true이면 현재 적용될 템플릿을 요약해서 보여줍니다.
  if (action === true || action === undefined) {
    // 현재 적용될 템플릿을 요약해서 보여줍니다.
    await showTemplate();
    // 사용 가능한 템플릿 action을 안내합니다.
    printTemplateHelp();
    return;
  }

  // action이 string이고 지원하지 않는 action이면 오류를 발생시킵니다.
  if (typeof action !== "string" || !TEMPLATE_ACTIONS.includes(action)) {
    throw new Error(
      `지원하지 않는 template action입니다: ${String(action)}. 사용 가능: ${TEMPLATE_ACTIONS.join(", ")}`,
    );
  }

  // init 적용시, template.json 파일에 기본 템플릿을 생성합니다.
  if (action === "init") {
    await initTemplate();
    return;
  }

  // show 적용시, 현재 적용될 템플릿을 요약해서 보여줍니다.
  if (action === "show") {
    await showTemplate();
    return;
  }

  // validate 적용시, 현재 적용될 템플릿을 요약해서 보여줍니다.
  await validateCurrentTemplate();
}

/**
 * 프로젝트 루트의 .convention/template.json에 기본 템플릿을 생성한다.
 * 기존 파일이 있으면 사용자 데이터 보호를 위해 자동으로 덮어쓰지 않는다.
 */
export async function initTemplate() {
  // 프로젝트 루트 경로를 가져옵니다.
  const projectRoot = getGitProjectRoot();

  // 프로젝트 루트 경로를 가져오지 못하면 오류를 발생시킵니다.
  if (!projectRoot) {
    throw new Error(
      "Git 저장소 안에서만 프로젝트 템플릿을 초기화할 수 있습니다.",
    );
  }

  // 템플릿 디렉토리를 설정합니다.
  const templateDir = path.join(projectRoot, ".convention");
  // 템플릿 파일 경로를 설정합니다.
  const templatePath = path.join(templateDir, "template.json");

  // 템플릿 파일이 이미 있으면 오류를 발생시킵니다.
  if (fs.existsSync(templatePath)) {
    warn(`이미 템플릿 파일이 있습니다. 덮어쓰지 않았습니다: ${templatePath}`);
    return;
  }

  // 디렉토리가 존재하지 않으면 생성합니다.
  fs.mkdirSync(templateDir, { recursive: true });
  // 템플릿 파일을 생성합니다.
  fs.writeFileSync(
    templatePath,
    `${JSON.stringify(createDefaultTemplate(), null, 2)}\n`,
    "utf8",
  );

  // 성공 로그를 출력합니다.
  success(`프로젝트 템플릿을 생성했습니다: ${templatePath}`);
}

/**
 * 현재 우선순위에 따라 적용될 템플릿을 출력한다.
 * raw JSON 전체를 dump하지 않고 검증된 필드만 요약해 secret 또는 diff 원문 노출을 막는다.
 */
export async function showTemplate() {
  // 템플릿을 로드합니다.
  const result = loadCurrentTemplate();

  // 경고 메시지를 출력합니다.
  for (const warning of result.warnings) {
    warn(warning);
  }

  // 템플릿 출처를 출력합니다.
  info(`템플릿 출처: ${result.source}`);
  // 템플릿 요약을 출력합니다.
  printTemplateSummary(result.template);
}

/**
 * 현재 적용될 템플릿의 검증 결과를 출력한다.
 * invalid 템플릿이 발견되어도 CLI를 죽이지 않고 기본 템플릿 fallback 상태를 알린다.
 */
export async function validateCurrentTemplate() {
  // 템플릿을 로드합니다.
  const result = loadCurrentTemplate();

  // 경고 메시지를 출력합니다.
  for (const warning of result.warnings) {
    warn(warning);
  }

  // 템플릿 검증 실패로 기본 템플릿을 사용합니다.
  if (!result.valid) {
    warn(`템플릿 검증 실패로 기본 템플릿을 사용합니다: ${result.source}`);
    return;
  }

  // 템플릿 검증에 성공 로그를 출력합니다.
  success(`템플릿 검증에 성공했습니다: ${result.source}`);
}

/**
 * 사용 가능한 template action을 안내합니다.
 */
function printTemplateHelp() {
  info("사용 가능한 template action: init, show, validate");
}

/**
 * 템플릿 요약을 출력합니다.
 * @param {Object} template 템플릿
 */
function printTemplateSummary(template) {
  // 템플릿 name을 출력합니다.
  info(`name: ${safeText(template.name)}`);
  // 템플릿 language를 출력합니다.
  info(`language: ${safeText(template.language)}`);
  // 템플릿 format을 출력합니다.
  info(`types: ${template.types.map(safeText).join(", ")}`);
  // 커밋 메시지 최대 길이를 출력합니다.
  info(`rules.maxLength: ${safeText(template.rules.maxLength)}`);
  // 커밋 메시지 스코프 필수 여부를 출력합니다.
  info(`rules.requireScope: ${safeText(template.rules.requireScope)}`);
  // 이모지 사용 가능 여부를 출력합니다.
  info(`rules.allowEmoji: ${safeText(template.rules.allowEmoji)}`);
}

/**
 * 현재 적용될 템플릿을 로드합니다.
 * @returns {Object} 템플릿
 */
function loadCurrentTemplate() {
  // 프로젝트 루트를 가져옵니다.
  const projectRoot = getGitProjectRoot();

  // 템플릿을 로드합니다.
  return loadValidatedTemplate({
    projectRoot: projectRoot ?? process.cwd(),
  });
}

/**
 * Git 프로젝트 루트를 가져옵니다.
 * @returns {string|null} Git 프로젝트 루트
 */
function getGitProjectRoot() {
  try {
    // Git 프로젝트 루트 경로를 가져옵니다.
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    // Git 프로젝트 루트 경로를 반환합니다.
    return root || null;
  } catch {
    // Git 프로젝트 루트 경로를 가져오지 못한 경우 null을 반환합니다.
    return null;
  }
}

/**
 * 입력된 값을 안전한 문자열로 변환한다.
 * 민감한 정보가 포함된 텍스트를 제거한다.
 *
 * @param {*} value
 * @returns {string}
 */
function safeText(value) {
  // 민감한 값이 제거된 텍스트를 반환합니다.
  const text = redactSecrets(String(value ?? ""));

  // PRIVATE KEY가 포함된 텍스트를 제거합니다.
  return text
    .replace(/-----BEGIN PRIVATE KEY-----/giu, "[REDACTED]")
    .replace(/-----END PRIVATE KEY-----/giu, "[REDACTED]");
}
