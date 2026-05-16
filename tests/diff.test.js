import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkDiff,
  detectLargeDiff,
  mergeChunkSummaries,
  summarizeDiffChunks,
} from "../src/core/diff.js";
import {
  buildChunkSummaryPrompt,
  buildSummaryCommitPrompt,
} from "../src/core/prompt.js";

function makeDiff(lines) {
  return lines.join("\n");
}

test("detectLargeDiff returns normal below or equal thresholds", () => {
  const config = {
    largeDiffThreshold: {
      maxCharacters: 10,
      maxFiles: 2,
      maxLines: 2,
    },
  };

  const result = detectLargeDiff({
    diff: "1234567890",
    files: ["a.js", "b.js"],
    config,
  });

  assert.equal(result.isLarge, false);
  assert.equal(result.reason, null);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.flow, "normal");
  assert.deepEqual(result.metrics, {
    characters: 10,
    files: 2,
    lines: 1,
  });
});

test("detectLargeDiff reports every exceeded metric in stable order", () => {
  const result = detectLargeDiff({
    diff: makeDiff(["1", "2", "3"]),
    files: ["a.js", "b.js"],
    config: {
      largeDiffThreshold: {
        maxCharacters: 2,
        maxFiles: 1,
        maxLines: 2,
      },
    },
  });

  assert.equal(result.isLarge, true);
  assert.equal(result.reason, "characters");
  assert.deepEqual(result.reasons, ["characters", "files", "lines"]);
  assert.equal(result.flow, "large-diff");
});

test("detectLargeDiff deep merges partial threshold overrides", () => {
  const result = detectLargeDiff({
    diff: "123456",
    files: [],
    config: {
      largeDiffThreshold: {
        maxCharacters: 5,
      },
    },
  });

  assert.equal(result.threshold.maxCharacters, 5);
  assert.equal(result.threshold.maxFiles, 30);
  assert.equal(result.threshold.maxLines, 1200);
  assert.equal(result.isLarge, true);
});

test("chunkDiff creates file chunks and preserves filenames", () => {
  const chunks = chunkDiff([
    { file: "문서/사용자 설정.md", diff: "diff --git a\n+hello\n" },
    { file: "src/Login Form.jsx", diff: "diff --git b\n+world\n" },
  ]);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].index, 1);
  assert.equal(chunks[0].file, "문서/사용자 설정.md");
  assert.deepEqual(chunks[1].files, ["src/Login Form.jsx"]);
  assert.equal(chunks[1].chunkType, "file");
});

test("chunkDiff splits oversized file diffs by line", () => {
  const chunks = chunkDiff(
    [
      {
        file: "src/large.js",
        diff: makeDiff(["diff --git large", "+1", "+2", "+3", "+4"]),
      },
    ],
    { maxChunkLines: 2, maxChunkCharacters: 1000 },
  );

  assert.equal(chunks.length, 3);
  assert.deepEqual(
    chunks.map((chunk) => chunk.part),
    [1, 2, 3],
  );
  assert.equal(chunks[0].totalParts, 3);
  assert.equal(chunks[0].chunkType, "file-part");
  assert.deepEqual(
    chunks.map((chunk) => chunk.index),
    [1, 2, 3],
  );
});

test("chunkDiff splits a single very long line by character limit", () => {
  const chunks = chunkDiff(
    [
      {
        file: "dist/generated.js",
        diff: `+${"x".repeat(120)}`,
      },
    ],
    { maxChunkLines: 50, maxChunkCharacters: 40 },
  );

  assert.equal(chunks.length > 1, true);
  assert.equal(chunks.every((chunk) => chunk.characterCount <= 40), true);
  assert.equal(chunks[0].diff.startsWith("+"), true);
  assert.equal(chunks[1].diff.startsWith("+... "), true);
});

test("chunkDiff removes empty chunks and validates top-level input", () => {
  assert.throws(() => chunkDiff(null), /fileDiffs must be an array/);

  const chunks = chunkDiff([
    { file: "empty.js", diff: "" },
    { file: "space.js", diff: "   \n" },
    { file: "valid.js", diff: "diff --git valid\n+ok\n" },
  ]);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].file, "valid.js");
});

test("buildChunkSummaryPrompt prohibits commit message generation", () => {
  const prompt = buildChunkSummaryPrompt({
    language: "ko",
    chunk: {
      index: 1,
      file: "src/app.js",
      files: ["src/app.js"],
      diff: "diff --git app\n+const value = 1;\n",
    },
  });

  assert.match(prompt, /Do not write a commit message/);
  assert.match(prompt, /Write the commit subject in Korean/);
  assert.match(prompt, /Git diff chunk:/);
});

test("summarizeDiffChunks uses provider routing and returns ordered summaries", async () => {
  const summaries = await summarizeDiffChunks({
    chunks: [
      {
        index: 1,
        file: "src/a.js",
        files: ["src/a.js"],
        diff: "diff --git a\n+one\n",
      },
      {
        index: 2,
        file: "src/b.js",
        files: ["src/b.js"],
        diff: "diff --git b\n+two\n",
      },
    ],
    config: { provider: "mock" },
    language: "ko",
  });

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((summary) => summary.index),
    [1, 2],
  );
  assert.equal(summaries[0].status, "success");
  assert.equal(summaries[0].summary, "chore: update project files");
});

test("summarizeDiffChunks does not fallback to mock for unsupported providers", async () => {
  await assert.rejects(
    () =>
      summarizeDiffChunks({
        chunks: [
          {
            index: 1,
            file: "src/a.js",
            files: ["src/a.js"],
            diff: "diff --git a\n+one\n",
          },
        ],
        config: { provider: "unknown" },
      }),
    /Unsupported provider: unknown/,
  );
});

test("mergeChunkSummaries dedupes, masks secrets, and produces prompt-ready text", () => {
  const merged = mergeChunkSummaries([
    {
      index: 1,
      file: "src/auth.js",
      functionName: "login",
      intent: "feat",
      summary: "로그인 토큰 저장 흐름 추가 TOKEN=secret-value",
    },
    {
      index: 2,
      file: "src/auth.js",
      functionName: "login",
      intent: "feat",
      summary: "로그인 토큰 저장 흐름 추가 TOKEN=another-secret",
    },
    {
      index: 3,
      file: "src/config.js",
      intent: "refactor",
      summary: "설정 로드 경로 정리",
    },
  ]);

  assert.match(merged, /전체 변경 요약:/);
  assert.match(merged, /src\/auth\.js/);
  assert.match(merged, /\[REDACTED\]/);
  assert.doesNotMatch(merged, /secret-value/);
  assert.doesNotMatch(merged, /diff --git/);
});

test("buildSummaryCommitPrompt uses merged summary without raw diff marker", () => {
  const prompt = buildSummaryCommitPrompt({
    summary: "전체 변경 요약:\n- src/app.js / feat: 앱 설정 흐름 추가",
    language: "ko",
    mode: "batch",
    previousMessage: "feat: 기존 메시지",
  });

  assert.match(prompt, /Merged change summary:/);
  assert.match(prompt, /Regenerate the commit message/);
  assert.doesNotMatch(prompt, /Git diff:/);
  assert.doesNotMatch(prompt, /diff --git/);
});
