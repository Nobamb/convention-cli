import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// 저장소 루트 기준으로 phase9 감사 대상 파일을 읽기 위한 고정 경로입니다.
// 테스트가 다른 working directory에서 실행되더라도 문서 경로가 흔들리지 않도록 process.cwd()를 한 번만 기준점으로 사용합니다.
const ROOT_DIR = process.cwd();

// AS~AV는 init/prompt.md phase9의 45-1~48-1에서 요구한 최종 통합 검증 단계입니다.
// 각 단계가 research/test 문서를 모두 가져야 다음 작업자가 구현 계획과 검증 기준을 함께 추적할 수 있습니다.
const PHASE9_STEPS = ["AS", "AT", "AU", "AV"];

// AV 단계에서 README와 함께 연결되어야 하는 상세 문서 목록입니다.
// GitHub Actions 문서는 기존에 존재했고, model/oauth/templates/pr 문서는 최종 문서화 점검 범위에 새로 포함됩니다.
const REQUIRED_DOCS = [
  "docs/model.md",
  "docs/oauth.md",
  "docs/templates.md",
  "docs/pr.md",
  "docs/github-actions.md",
];

/**
 * 저장소 상대 경로의 UTF-8 텍스트 파일을 읽습니다.
 *
 * @param {string} relativePath - 저장소 루트 기준 상대 경로입니다.
 * @returns {string} UTF-8로 읽은 파일 본문입니다.
 */
function readRepoFile(relativePath) {
  return readFileSync(join(ROOT_DIR, relativePath), "utf8");
}

/**
 * 문서가 특정 단어들을 모두 포함하는지 확인합니다.
 *
 * @param {string} content - 검사할 문서 본문입니다.
 * @param {string[]} keywords - 문서에 반드시 있어야 하는 키워드 배열입니다.
 * @returns {void} 반환값은 없고, 누락 시 assertion error를 발생시킵니다.
 */
function assertIncludesAll(content, keywords) {
  for (const keyword of keywords) {
    assert.match(content, new RegExp(keyword, "iu"));
  }
}

test("Phase 9 AS~AV research/test 문서가 모두 존재하고 올바른 제목을 가진다", () => {
  for (const step of PHASE9_STEPS) {
    const researchPath = `work_process/advanced/${step}/research-${step}.md`;
    const testPath = `work_process/advanced/${step}/test-${step}.md`;

    assert.equal(existsSync(join(ROOT_DIR, researchPath)), true);
    assert.equal(existsSync(join(ROOT_DIR, testPath)), true);
    assert.match(readRepoFile(researchPath), new RegExp(`^# ${step}\\.`, "u"));
    assert.match(readRepoFile(testPath), new RegExp(`^# ${step}\\.`, "u"));
  }
});

test("Phase 9 상세 문서와 README 링크가 AV 문서화 범위를 충족한다", () => {
  const readme = readRepoFile("README.md");

  for (const docPath of REQUIRED_DOCS) {
    assert.equal(existsSync(join(ROOT_DIR, docPath)), true);
    assert.match(readme, new RegExp(`\\(${docPath.replace("/", "\\/")}\\)`, "u"));
  }
});

test("Phase 9 문서는 3차 기능 사용법과 보안 기준을 함께 설명한다", () => {
  assertIncludesAll(readRepoFile("docs/model.md"), [
    "--model",
    "credentials\\.json",
    "confirmExternalTransmission",
    "mock[\\s\\S]*fallback",
  ]);

  assertIncludesAll(readRepoFile("docs/oauth.md"), [
    "state",
    "PKCE",
    "credentials\\.json",
    "token",
  ]);

  assertIncludesAll(readRepoFile("docs/templates.md"), [
    "--template",
    "template\\.json",
    "format",
    "fallback",
  ]);

  assertIncludesAll(readRepoFile("docs/pr.md"), [
    "--pr",
    "--print-only",
    "gh",
    "raw diff",
  ]);

  assertIncludesAll(readRepoFile("docs/github-actions.md"), [
    "--no-interactive",
    "--yes",
    "GitHub Secrets",
    "fork PR",
  ]);
});

test("Phase 9 보안 문서는 위험 명령을 실행 예시로 권장하지 않는다", () => {
  const combinedDocs = REQUIRED_DOCS.map(readRepoFile).join("\n");

  // 금지 항목을 설명하기 위해 문자열이 등장하는 것은 허용하지만, 실행 가능한 run 예시나 bash 명령으로 권장하면 안 됩니다.
  assert.doesNotMatch(combinedDocs, /run:\s*npm\s+publish/iu);
  assert.doesNotMatch(combinedDocs, /```bash[\s\S]*npm\s+publish[\s\S]*```/iu);
  assert.doesNotMatch(combinedDocs, /run:\s*git\s+reset\s+--hard/iu);
  assert.doesNotMatch(combinedDocs, /```bash[\s\S]*git\s+reset\s+--hard[\s\S]*```/iu);
});
