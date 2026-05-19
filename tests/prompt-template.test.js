import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  buildCommitPrompt,
  buildGroupCommitPrompt,
  buildSummaryCommitPrompt,
} from "../src/core/prompt.js";

const MOCK_DIFF = [
  "diff --git a/src/app.js b/src/app.js",
  "@@ -1 +1 @@",
  "-old",
  "+new",
].join("\n");

let originalLog;
let originalError;
let originalWarn;
let logCalls;
let errorCalls;
let warnCalls;

beforeEach(() => {
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;
  logCalls = [];
  errorCalls = [];
  warnCalls = [];

  console.log = (message) => {
    logCalls.push(message);
  };
  console.error = (message) => {
    errorCalls.push(message);
  };
  console.warn = (message) => {
    warnCalls.push(message);
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

test("buildCommitPrompt keeps legacy prompt behavior when template is omitted", () => {
  const prompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "en",
    mode: "batch",
  });

  assert.match(
    prompt,
    /Allowed types: feat, fix, refactor, docs, style, test, chore/,
  );
  assert.match(prompt, /Use the Conventional Commits format:/);
  assert.match(prompt, /<type>: <subject>/);
  assert.match(prompt, /Write the commit subject in English/);
  assert.match(prompt, /whole working tree change/);
  assert.doesNotMatch(prompt, /Template rules:/);
  assert.doesNotMatch(prompt, /Keep the commit subject within 72 characters/);
});

test("buildCommitPrompt applies template allowed types, format, and maxLength", () => {
  const prompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "ko",
    mode: "batch",
    template: {
      types: ["feat", "fix", "docs"],
      format: "{type}: {message}",
      language: "en",
      rules: { maxLength: 50 },
    },
  });

  assert.match(prompt, /Allowed types: feat, fix, docs/);
  assert.doesNotMatch(prompt, /Allowed types: .*refactor/);
  assert.match(prompt, /Template rules:/);
  assert.match(
    prompt,
    /Follow this output format exactly: \{type\}: \{message\}/,
  );
  assert.match(prompt, /within 50 characters/);
  assert.match(prompt, /Write the commit subject in English/);
});

test("buildCommitPrompt requires scope when template format and rules require it", () => {
  const prompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "ko",
    mode: "step",
    template: {
      types: ["feat"],
      format: "{type}({scope}): {message}",
      rules: { requireScope: true, maxLength: 72 },
    },
  });

  assert.match(
    prompt,
    /Follow this output format exactly: \{type\}\(\{scope\}\): \{message\}/,
  );
  assert.match(prompt, /scope is required/);
  assert.match(prompt, /single file or one file-level change/);
});

test("buildCommitPrompt resolves language by template, config, then ko", () => {
  const templateLanguagePrompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "ko",
    template: { language: "en" },
  });
  const configLanguagePrompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "jp",
    template: {},
  });
  const defaultLanguagePrompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "bad",
    template: { language: "bad" },
  });

  assert.match(templateLanguagePrompt, /Write the commit subject in English/);
  assert.match(configLanguagePrompt, /Write the commit subject in Japanese/);
  assert.match(defaultLanguagePrompt, /Write the commit subject in Korean/);
});

test("buildCommitPrompt falls back safely for invalid template fields", () => {
  const prompt = buildCommitPrompt({
    diff: MOCK_DIFF,
    language: "cn",
    template: {
      types: ["unknown"],
      format: "{message}",
      rules: { maxLength: -1 },
    },
  });

  assert.match(
    prompt,
    /Allowed types: feat, fix, refactor, docs, style, test, chore/,
  );
  assert.doesNotMatch(prompt, /Follow this output format exactly/);
  assert.match(prompt, /within 72 characters/);
  assert.match(prompt, /Write the commit subject in Chinese/);
});

test("buildCommitPrompt does not log raw diff or secrets while building prompt", () => {
  const diffWithSecret = [
    "diff --git a/.env b/.env",
    "@@ -1 +1 @@",
    "+API_KEY=test-value",
  ].join("\n");

  buildCommitPrompt({
    diff: diffWithSecret,
    language: "ko",
    template: { types: ["chore"], format: "{type}: {message}" },
  });

  assert.deepEqual(logCalls, []);
  assert.deepEqual(errorCalls, []);
  assert.deepEqual(warnCalls, []);
});

test("summary and group commit prompts apply template rules", () => {
  const template = {
    language: "en",
    types: ["docs"],
    format: "{type}: {message}",
    rules: {
      maxLength: 60,
      requireScope: false,
      allowEmoji: false,
    },
  };

  const summaryPrompt = buildSummaryCommitPrompt({
    summary: "Updated documentation.",
    language: "ko",
    mode: "batch",
    template,
  });
  const groupPrompt = buildGroupCommitPrompt({
    groupName: "docs",
    type: "docs",
    files: ["README.md"],
    summary: "Updated docs.",
    diff: MOCK_DIFF,
    language: "ko",
    template,
  });

  for (const prompt of [summaryPrompt, groupPrompt]) {
    assert.match(prompt, /Allowed types: docs/);
    assert.match(prompt, /Follow this output format exactly: \{type\}: \{message\}/);
    assert.match(prompt, /within 60 characters/);
    assert.match(prompt, /Write the commit subject in English/);
  }
});
