import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(".");
const CLI_PATH = path.join(REPO_ROOT, "bin", "convention.js");

function makeTempDir(prefix = "convention-template-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCli(args, options = {}) {
  const home = options.home ?? makeTempDir("convention-template-home-");
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
  };

  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env,
    encoding: "utf8",
  });
}

function makeGitRepo() {
  const repo = makeTempDir("convention-template-repo-");

  spawnSync("git", ["init"], {
    cwd: repo,
    encoding: "utf8",
    stdio: "ignore",
  });

  return repo;
}

function writeProjectTemplate(repo, template) {
  const templateDir = path.join(repo, ".convention");
  const templatePath = path.join(templateDir, "template.json");

  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(templatePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

  return templatePath;
}

function validTemplate(overrides = {}) {
  return {
    name: "team-template",
    language: "ko",
    format: "{type}: {message}",
    types: ["feat", "fix", "docs", "chore"],
    rules: {
      maxLength: 72,
      requireScope: false,
      allowEmoji: false,
    },
    ...overrides,
  };
}

test("template command without action shows template status and does not run commit flow", () => {
  const cwd = makeTempDir();
  const result = runCli(["--template"], { cwd });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 0);
  assert.match(output, /default/);
  assert.match(output, /init, show, validate/);
  assert.doesNotMatch(output, /Git diff/);
  assert.doesNotMatch(output, /commit -m/);
});

test("template init creates .convention/template.json in a git repository", () => {
  const repo = makeGitRepo();
  const result = runCli(["--template", "init"], { cwd: repo });
  const templatePath = path.join(repo, ".convention", "template.json");

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(templatePath), true);

  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  assert.equal(template.name, "default");
  assert.equal(template.format, "{type}: {message}");
});

test("template init protects an existing project template from overwrite", () => {
  const repo = makeGitRepo();
  const templatePath = writeProjectTemplate(
    repo,
    validTemplate({ name: "existing-template" }),
  );
  const before = fs.readFileSync(templatePath, "utf8");
  const result = runCli(["--template", "init"], { cwd: repo });
  const after = fs.readFileSync(templatePath, "utf8");
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 0);
  assert.equal(after, before);
  assert.match(output, /덮어쓰지/);
});

test("template show prints project template summary and redacts sensitive values", () => {
  const repo = makeGitRepo();
  writeProjectTemplate(
    repo,
    validTemplate({
      name: "TOKEN=secret-token",
      format: "{type}: {message} PASSWORD=secret-password",
    }),
  );

  const result = runCli(["--template", "show"], { cwd: repo });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 0);
  assert.match(output, /project-template/);
  assert.match(output, /\[REDACTED\]/);
  assert.doesNotMatch(output, /secret-token/);
  assert.doesNotMatch(output, /secret-password/);
});

test("template validate succeeds for a valid project template", () => {
  const repo = makeGitRepo();
  writeProjectTemplate(repo, validTemplate());

  const result = runCli(["--template", "validate"], { cwd: repo });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 0);
  assert.match(output, /검증에 성공/);
  assert.match(output, /project-template/);
});

test("template validate reports invalid template and falls back without raw dump", () => {
  const repo = makeGitRepo();
  writeProjectTemplate(
    repo,
    validTemplate({
      types: ["feature"],
      format: "{type}",
    }),
  );

  const result = runCli(["--template", "validate"], { cwd: repo });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 0);
  assert.match(output, /types must contain only supported commit types/);
  assert.match(output, /기본 템플릿/);
  assert.doesNotMatch(output, /"feature"/);
});

test("unknown template action exits with an error and does not fall back to commit flow", () => {
  const repo = makeGitRepo();
  fs.writeFileSync(path.join(repo, "changed.txt"), "pending\n", "utf8");

  const beforeStatus = spawnSync("git", ["status", "--porcelain"], {
    cwd: repo,
    encoding: "utf8",
  }).stdout;
  const result = runCli(["--template", "unknown"], { cwd: repo });
  const afterStatus = spawnSync("git", ["status", "--porcelain"], {
    cwd: repo,
    encoding: "utf8",
  }).stdout;
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 1);
  assert.match(output, /지원하지 않는 template action/);
  assert.equal(afterStatus, beforeStatus);
});

test("CLI routes template before reset and default commit flows", () => {
  const source = fs.readFileSync(CLI_PATH, "utf8");
  const templateIndex = source.indexOf("if (options.template !== undefined)");
  const resetIndex = source.indexOf("if (options.reset)");
  const defaultCommitIndex = source.indexOf("runDefaultCommit({");

  assert.match(source, /runTemplateCommand/);
  assert.match(source, /options\.template !== undefined/);
  assert.notEqual(templateIndex, -1);
  assert.equal(templateIndex < resetIndex, true);
  assert.equal(templateIndex < defaultCommitIndex, true);
});

test("template mixed with execution options is rejected before push or commit flow", () => {
  const repo = makeGitRepo();
  const result = runCli(["--template", "show", "--push"], { cwd: repo });
  const output = `${result.stdout}${result.stderr}`;

  assert.equal(result.status, 1);
  assert.match(output, /함께 사용할 수 없습니다/);
  assert.doesNotMatch(output, /push 완료/);
});
