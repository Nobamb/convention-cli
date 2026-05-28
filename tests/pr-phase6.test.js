import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach, beforeEach } from 'node:test';
import prompts from 'prompts';

import {
  collectPrContext,
  handlePrPreview,
  shouldConfirmPrExternalProviderRequest,
} from '../src/commands/pr.js';
import {
  assertSafePrContent,
  cleanPrBody,
  cleanPrTitle,
  generatePrBody,
  generatePrTitle,
} from '../src/core/pr.js';
import {
  createPullRequest,
  detectGitHubRemote,
  parseGitHubRemoteUrl,
  redactRemoteUrl,
} from '../src/core/github.js';
import { buildPrPrompt } from '../src/core/prPrompt.js';
import {
  PR_PREVIEW_DECISIONS,
  printPrPreview,
  selectPrPreviewAction,
} from '../src/utils/ui.js';

let originalLog;
let originalWarn;
let logCalls;
let warnCalls;

function runGit(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function createPrTestRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-pr-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Convention Test']);
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n', 'utf8');
  runGit(repoDir, ['add', 'README.md']);
  runGit(repoDir, ['commit', '-m', 'chore: initial commit']);
  runGit(repoDir, ['branch', '-M', 'main']);

  return repoDir;
}

beforeEach(() => {
  originalLog = console.log;
  originalWarn = console.warn;
  logCalls = [];
  warnCalls = [];

  console.log = (message) => {
    logCalls.push(message);
  };
  console.warn = (message) => {
    warnCalls.push(message);
  };
});

afterEach(() => {
  prompts.inject([]);
  console.log = originalLog;
  console.warn = originalWarn;
});

test('Phase 6 AD buildPrPrompt masks secrets and omits raw diff lines', () => {
  const prompt = buildPrPrompt({
    currentBranch: 'feature/pr-flow',
    baseBranch: 'main',
    commitLog: 'abc123 feat: add PR flow TOKEN=hidden',
    diffSummary: [
      'diff --git a/src/core/pr.js b/src/core/pr.js',
      '@@ -1,2 +1,2 @@',
      '-const token = "secret";',
      '+const token = "new-secret";',
      'src/core/pr.js | 2 +-',
      'API_KEY=secret-value',
    ].join('\n'),
    changedFiles: ['src/core/pr.js', '.env', 'docs/pr.md'],
    language: 'en',
  });

  // 외부 AI로 전달될 prompt에는 secret 원문과 patch 본문이 남아 있으면 안 됩니다.
  assert.match(prompt, /Write the PR title and body in English/);
  assert.match(prompt, /src\/core\/pr\.js/);
  assert.match(prompt, /docs\/pr\.md/);
  assert.match(prompt, /API_KEY=\[REDACTED\]/);
  assert.match(prompt, /TOKEN=\[REDACTED\]/);
  assert.doesNotMatch(prompt, /secret-value|hidden|diff --git|@@ -1,2|\+const token|-const token/);
});

test('Phase 6 security gate keeps --yes separate from external AI approval policy', () => {
  // --yes는 preview/create 확인 생략 옵션일 뿐이므로 외부 AI provider 전송 확인을 대체하면 안 됩니다.
  // confirmExternalTransmission이 never로 명시 저장된 경우에만 PR metadata 외부 전송 확인을 생략합니다.
  assert.equal(
    shouldConfirmPrExternalProviderRequest({
      provider: 'gemini',
      confirmExternalTransmission: 'always',
    }),
    true,
  );
  assert.equal(
    shouldConfirmPrExternalProviderRequest({
      provider: 'gemini',
      confirmExternalTransmission: 'never',
    }),
    false,
  );
  assert.equal(
    shouldConfirmPrExternalProviderRequest({
      provider: 'mock',
      confirmExternalTransmission: 'always',
    }),
    false,
  );
  assert.equal(
    shouldConfirmPrExternalProviderRequest({
      provider: 'localLLM',
      baseURL: 'http://localhost:11434/v1',
      confirmExternalTransmission: 'always',
    }),
    false,
  );
  assert.equal(
    shouldConfirmPrExternalProviderRequest({
      provider: 'localLLM',
      baseURL: 'https://llm.example.com/v1',
      confirmExternalTransmission: 'always',
    }),
    true,
  );
});

test('Phase 6 head option collects branch metadata from requested head and excludes unrelated working tree', () => {
  const repoDir = createPrTestRepo();
  const originalCwd = process.cwd();

  try {
    runGit(repoDir, ['checkout', '-b', 'feature/requested-head']);
    fs.writeFileSync(path.join(repoDir, 'target.txt'), 'target branch change\n', 'utf8');
    runGit(repoDir, ['add', 'target.txt']);
    runGit(repoDir, ['commit', '-m', 'feat: add requested head file']);

    runGit(repoDir, ['checkout', 'main']);
    fs.writeFileSync(path.join(repoDir, 'working-only.txt'), 'working tree only\n', 'utf8');

    process.chdir(repoDir);
    const context = collectPrContext(
      { base: 'main', head: 'feature/requested-head' },
      { language: 'en' },
    );

    assert.equal(context.currentBranch, 'feature/requested-head');
    assert.deepEqual(context.changedFiles, ['target.txt']);
    assert.match(context.commitLog, /feat: add requested head file/);
    assert.match(context.diffSummary, /target\.txt/);
    assert.match(context.prompt, /target\.txt/);
    assert.doesNotMatch(context.prompt, /working-only\.txt/);
  } finally {
    process.chdir(originalCwd);
  }
});

test('Phase 6 AE cleanPrTitle normalizes a Conventional Commits title', () => {
  const title = cleanPrTitle(`
    Here is a title:
    - "feat(pr): add automated PR preview"
  `);

  assert.equal(title, 'feat(pr): add automated PR preview');
});

test('Phase 6 AE cleanPrTitle rejects invalid, empty, and sensitive titles', () => {
  assert.throws(
    () => cleanPrTitle('Add automated PR preview'),
    /Conventional Commits type/,
  );
  assert.throws(() => cleanPrTitle(''), /empty/);
  assert.throws(
    () => cleanPrTitle('feat: use TOKEN=secret'),
    /sensitive-looking/,
  );
});

test('Phase 6 AF cleanPrBody preserves required sections and masks sensitive values', () => {
  const body = cleanPrBody(`## Summary
- Add PR generation API_KEY=secret

## Changes
- Create title and body helpers

## Tests
- node --test tests/pr-phase6.test.js`);

  assert.match(body, /## Summary/);
  assert.match(body, /## Changes/);
  assert.match(body, /## Tests/);
  assert.match(body, /API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(body, /secret/);
});

test('Phase 6 AF cleanPrBody falls back when provider returns only a title', () => {
  const body = cleanPrBody('chore: update project files', {
    summary: 'PR automation helpers',
    changedFiles: ['src/core/pr.js', 'src/core/github.js'],
    commitLog: 'abc123 feat: add PR command',
    tests: [{ command: 'node --test tests/pr-phase6.test.js', status: 'passed' }],
  });

  assert.match(body, /## Summary/);
  assert.match(body, /PR automation helpers/);
  assert.match(body, /src\/core\/github\.js/);
  assert.match(body, /node --test tests\/pr-phase6\.test\.js: passed/);
});

test('Phase 6 AF assertSafePrContent rejects raw diff content', () => {
  assert.throws(
    () =>
      assertSafePrContent({
        title: 'feat: add PR automation',
        body: '## Summary\n\n- ok\n\ndiff --git a/a b/a\n',
      }),
    /raw diff/,
  );
});

test('Phase 6 AG parseGitHubRemoteUrl supports HTTPS, SCP-style SSH, and ssh URLs', () => {
  assert.deepEqual(parseGitHubRemoteUrl('https://github.com/openai/convention-cli.git'), {
    owner: 'openai',
    repo: 'convention-cli',
    urlType: 'https',
  });
  assert.deepEqual(parseGitHubRemoteUrl('git@github.com:openai/convention-cli.git'), {
    owner: 'openai',
    repo: 'convention-cli',
    urlType: 'ssh',
  });
  assert.deepEqual(parseGitHubRemoteUrl('ssh://git@github.com/openai/convention-cli.git'), {
    owner: 'openai',
    repo: 'convention-cli',
    urlType: 'ssh',
  });
  assert.equal(parseGitHubRemoteUrl('https://gitlab.com/openai/convention-cli.git'), null);
});

test('Phase 6 AG detectGitHubRemote prefers requested remote and deduplicates fetch/push lines', () => {
  const remoteOutput = [
    'origin\thttps://github.com/openai/convention-cli.git (fetch)',
    'origin\thttps://github.com/openai/convention-cli.git (push)',
    'upstream\tgit@github.com:example/upstream-repo.git (fetch)',
    'upstream\tgit@github.com:example/upstream-repo.git (push)',
  ].join('\n');

  assert.deepEqual(detectGitHubRemote({ remoteOutput }), {
    remote: 'origin',
    owner: 'openai',
    repo: 'convention-cli',
    urlType: 'https',
  });
  assert.deepEqual(detectGitHubRemote({ preferredRemote: 'upstream', remoteOutput }), {
    remote: 'upstream',
    owner: 'example',
    repo: 'upstream-repo',
    urlType: 'ssh',
  });
});

test('Phase 6 AG redactRemoteUrl removes embedded credentials', () => {
  const redacted = redactRemoteUrl('https://user:TOKEN=secret@github.com/openai/convention-cli.git?x=1#token');

  assert.match(redacted, /github\.com\/openai\/convention-cli\.git/);
  assert.doesNotMatch(redacted, /user|secret|TOKEN|x=1|token$/);
});

test('Phase 6 AH createPullRequest calls gh with argv array and hides gh failures', () => {
  const calls = [];
  const output = createPullRequest({
    title: 'feat: add PR automation',
    body: '## Summary\n- Add PR automation\n\n## Changes\n- Use gh\n\n## Tests\n- Not run',
    base: 'main',
    head: 'feature/pr',
    draft: true,
    runner(command, args, options) {
      calls.push({ command, args, options });
      return 'https://github.com/openai/convention-cli/pull/1\n';
    },
  });

  assert.equal(output, 'https://github.com/openai/convention-cli/pull/1');
  assert.equal(calls[0].command, 'gh');
  assert.deepEqual(calls[0].args, [
    'pr',
    'create',
    '--title',
    'feat: add PR automation',
    '--body',
    '## Summary\n- Add PR automation\n\n## Changes\n- Use gh\n\n## Tests\n- Not run',
    '--base',
    'main',
    '--head',
    'feature/pr',
    '--draft',
  ]);

  assert.throws(
    () =>
      createPullRequest({
        title: 'feat: add PR automation',
        body: '## Summary\n- Add\n\n## Changes\n- Use gh\n\n## Tests\n- Not run',
        base: 'main',
        head: 'feature/pr',
        runner() {
          throw new Error('TOKEN=secret');
        },
      }),
    /gh output was hidden/,
  );
});

test('Phase 6 AI printPrPreview prints metadata and masks secret-looking values', () => {
  printPrPreview({
    title: 'feat: add PR automation TOKEN=secret',
    body: '## Summary\n- API_KEY=secret\n\n## Changes\n- docs/pr.md\n\n## Tests\n- Not run',
    base: 'main',
    head: 'feature/pr',
    changedFiles: ['src/core/pr.js', 'docs/API_KEY=secret.md'],
  });

  const output = logCalls.join('\n');

  assert.match(output, /PR preview/);
  assert.match(output, /feature\/pr -> main/);
  assert.match(output, /TOKEN=\[REDACTED\]/);
  assert.match(output, /API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(output, /TOKEN=secret|API_KEY=secret/);
});

test('Phase 6 AI selectPrPreviewAction returns stable enum values and cancels invalid input', async () => {
  prompts.inject([
    PR_PREVIEW_DECISIONS.CREATE,
    PR_PREVIEW_DECISIONS.EDIT,
    PR_PREVIEW_DECISIONS.PRINT,
    PR_PREVIEW_DECISIONS.CANCEL,
    'invalid',
  ]);

  assert.equal(await selectPrPreviewAction(), PR_PREVIEW_DECISIONS.CREATE);
  assert.equal(await selectPrPreviewAction(), PR_PREVIEW_DECISIONS.EDIT);
  assert.equal(await selectPrPreviewAction(), PR_PREVIEW_DECISIONS.PRINT);
  assert.equal(await selectPrPreviewAction(), PR_PREVIEW_DECISIONS.CANCEL);
  assert.equal(await selectPrPreviewAction(), PR_PREVIEW_DECISIONS.CANCEL);
});

test('Phase 6 AI handlePrPreview print-only never calls create', async () => {
  let createCalled = false;
  const result = await handlePrPreview({
    title: 'feat: add PR automation',
    body: '## Summary\n- Add\n\n## Changes\n- PR flow\n\n## Tests\n- Not run',
    context: {
      baseBranch: 'main',
      currentBranch: 'feature/pr',
      changedFiles: ['src/core/pr.js'],
    },
    options: { printOnly: true },
    create() {
      createCalled = true;
    },
  });

  assert.deepEqual(result, { created: false, printed: true, canceled: false });
  assert.equal(createCalled, false);
});

test('Phase 6 AI handlePrPreview reports not-created when create callback returns false', async () => {
  const result = await handlePrPreview({
    title: 'feat: add PR automation',
    body: '## Summary\n- Add\n\n## Changes\n- PR flow\n\n## Tests\n- Not run',
    context: {
      baseBranch: 'main',
      currentBranch: 'feature/pr',
      changedFiles: ['src/core/pr.js'],
    },
    options: { yes: true },
    create() {
      return false;
    },
  });

  assert.deepEqual(result, { created: false, printed: false, canceled: false });
});

test('Phase 6 AI handlePrPreview validates manual edit body with PR body cleanup', async () => {
  prompts.inject([
    PR_PREVIEW_DECISIONS.EDIT,
    'feat: refine PR preview',
    'Manual body without required sections',
    PR_PREVIEW_DECISIONS.PRINT,
  ]);

  const result = await handlePrPreview({
    title: 'feat: add PR automation',
    body: '## Summary\n- Add\n\n## Changes\n- PR flow\n\n## Tests\n- Not run',
    context: {
      baseBranch: 'main',
      currentBranch: 'feature/pr',
      changedFiles: ['src/core/pr.js'],
      diffSummary: 'PR preview metadata',
      commitLog: 'abc123 feat: add PR automation',
    },
    options: {},
    create() {
      throw new Error('create should not be called for print-only decision');
    },
  });

  const output = logCalls.join('\n');

  assert.deepEqual(result, { created: false, printed: true, canceled: false });
  assert.match(output, /feat: refine PR preview/);
  assert.match(output, /## Summary/);
  assert.match(output, /PR preview metadata/);
  assert.match(output, /## Changes/);
  assert.match(output, /src\/core\/pr\.js/);
  assert.match(output, /## Tests/);
});

test('Phase 6 provider generation works with mock provider without network access', async () => {
  const title = await generatePrTitle({
    prompt: 'safe PR prompt',
    summary: 'safe summary',
    commitLog: 'abc123 chore: update files',
    config: { provider: 'mock', language: 'en' },
  });
  const body = await generatePrBody({
    prompt: 'safe PR prompt',
    summary: 'safe summary',
    changedFiles: ['src/core/pr.js'],
    commitLog: 'abc123 chore: update files',
    tests: [],
    config: { provider: 'mock', language: 'en' },
  });

  assert.equal(title, 'chore: update project files');
  assert.match(body, /## Summary/);
  assert.match(body, /## Changes/);
  assert.match(body, /## Tests/);
});
