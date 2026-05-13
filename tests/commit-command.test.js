import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, afterEach, before, beforeEach } from 'node:test';
import prompts from 'prompts';

import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import { buildExternalAITransmissionMessage } from '../src/utils/ui.js';

let commands;
let store;
let tempHome;
let previousHome;
let previousUserProfile;
const originalFetch = globalThis.fetch;
const originalConsoleWarn = console.warn;

const gitAvailable = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const skipWithoutGit = gitAvailable ? false : 'git is not available in this environment';

before(async () => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-command-home-'));
  previousHome = process.env.HOME;
  previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  store = await import('../src/config/store.js');
  commands = await import('../src/commands/commit.js');
});

beforeEach(() => {
  if (store && fs.existsSync(store.CONFIG_DIR)) {
    fs.rmSync(store.CONFIG_DIR, { recursive: true, force: true });
  }
  prompts.inject([]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalConsoleWarn;
});

after(() => {
  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }

  if (previousUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = previousUserProfile;
  }

  if (tempHome) {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

function runGit(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function writeFile(repoDir, relativePath, content) {
  const filePath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createTempRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-command-repo-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Convention Test']);
  writeFile(repoDir, 'README.md', 'initial readme\n');
  writeFile(repoDir, 'src/app.js', 'console.log("initial");\n');
  runGit(repoDir, ['add', '-A']);
  runGit(repoDir, ['commit', '-m', 'chore: initial commit']);

  return repoDir;
}

function createBareRemote() {
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-command-remote-'));
  runGit(remoteDir, ['init', '--bare']);
  return remoteDir;
}

function cleanupTempRepo(repoDir) {
  const resolvedRepo = path.resolve(repoDir);
  const resolvedTemp = path.resolve(os.tmpdir());

  if (!resolvedRepo.startsWith(resolvedTemp)) {
    throw new Error(`Refusing to remove non-temp test directory: ${resolvedRepo}`);
  }

  fs.rmSync(resolvedRepo, { recursive: true, force: true });
}

async function withRepo(callback) {
  const originalCwd = process.cwd();
  const repoDir = createTempRepo();

  try {
    process.chdir(repoDir);
    return await callback(repoDir);
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(repoDir);
  }
}

async function withRepoAndRemote(callback) {
  const remoteDir = createBareRemote();

  try {
    return await withRepo(async (repoDir) => {
      runGit(repoDir, ['remote', 'add', 'origin', remoteDir]);
      runGit(repoDir, ['push', '-u', 'origin', 'HEAD']);
      return callback(repoDir, remoteDir);
    });
  } finally {
    cleanupTempRepo(remoteDir);
  }
}

function saveRuntimeConfig(config = {}) {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    provider: null,
    confirmBeforeCommit: false,
    ...config,
  });
}

function getCommitMessages(repoDir) {
  return runGit(repoDir, ['log', '--pretty=%s'])
    .trim()
    .split(/\r?\n/);
}

function getRemoteCommitMessages(remoteDir) {
  return runGit(remoteDir, ['log', '--pretty=%s'])
    .trim()
    .split(/\r?\n/);
}

function getStatus(repoDir) {
  return runGit(repoDir, ['-c', 'core.quotepath=false', 'status', '--porcelain']);
}

test('runBatchCommit creates one commit for committable changed files', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'batch' });
    writeFile(repoDir, 'README.md', 'batch readme change\n');
    writeFile(repoDir, 'docs/new-guide.md', 'new guide content\n');
    writeFile(repoDir, '.env', 'TOKEN=should-not-commit\n');

    await commands.runBatchCommit();

    const messages = getCommitMessages(repoDir);
    const status = getStatus(repoDir);

    assert.equal(messages[0], 'chore: update project files');
    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 1);
    assert.match(status, /^\?\? \.env/m);
    assert.equal(status.includes('README.md'), false);
    assert.equal(status.includes('docs/new-guide.md'), false);
  });
});

test('runStepCommit creates one commit per committable file', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'step' });
    writeFile(repoDir, 'README.md', 'step readme change\n');
    writeFile(repoDir, 'src/app.js', 'console.log("changed");\n');
    writeFile(repoDir, 'docs/new-step-guide.md', 'new step guide\n');

    await commands.runStepCommit();

    const messages = getCommitMessages(repoDir);

    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 3);
    assert.equal(getStatus(repoDir), '');
  });
});

test('runBatchCommit pushes only after a successful batch commit', { skip: skipWithoutGit }, async () => {
  await withRepoAndRemote(async (repoDir, remoteDir) => {
    saveRuntimeConfig({ mode: 'batch' });
    writeFile(repoDir, 'README.md', 'batch push change\n');
    prompts.inject([true]);

    await commands.runBatchCommit({ push: true });

    const localMessages = getCommitMessages(repoDir);
    const remoteMessages = getRemoteCommitMessages(remoteDir);

    assert.equal(localMessages[0], 'chore: update project files');
    assert.equal(remoteMessages[0], 'chore: update project files');
  });
});

test('runStepCommit pushes after at least one successful step commit', { skip: skipWithoutGit }, async () => {
  await withRepoAndRemote(async (repoDir, remoteDir) => {
    saveRuntimeConfig({ mode: 'step' });
    writeFile(repoDir, 'README.md', 'step push readme\n');
    writeFile(repoDir, 'src/app.js', 'console.log("step push");\n');
    prompts.inject([true]);

    await commands.runStepCommit({ push: true });

    const remoteMessages = getRemoteCommitMessages(remoteDir);

    assert.equal(remoteMessages.filter((message) => message === 'chore: update project files').length, 2);
  });
});

test('runDefaultCommit uses stored mode before push', { skip: skipWithoutGit }, async () => {
  await withRepoAndRemote(async (repoDir, remoteDir) => {
    saveRuntimeConfig({ mode: 'batch' });
    writeFile(repoDir, 'README.md', 'default push batch change\n');
    writeFile(repoDir, 'src/app.js', 'console.log("default push");\n');
    prompts.inject([true]);

    await commands.runDefaultCommit({ push: true });

    const remoteMessages = getRemoteCommitMessages(remoteDir);

    assert.equal(remoteMessages.filter((message) => message === 'chore: update project files').length, 1);
  });
});

test('runBatchCommit keeps local commit but skips push when push confirmation is rejected', { skip: skipWithoutGit }, async () => {
  await withRepoAndRemote(async (repoDir, remoteDir) => {
    saveRuntimeConfig({
      mode: 'batch',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'batch push rejected change\n');
    prompts.inject([false]);

    await commands.runBatchCommit({ push: true });

    const localMessages = getCommitMessages(repoDir);
    const remoteMessages = getRemoteCommitMessages(remoteDir);

    assert.equal(localMessages[0], 'chore: update project files');
    assert.equal(remoteMessages[0], 'chore: initial commit');
  });
});

test('runDefaultCommit routes batch mode to batch flow', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'batch' });
    writeFile(repoDir, 'README.md', 'default batch change\n');
    writeFile(repoDir, 'src/app.js', 'console.log("default batch");\n');

    await commands.runDefaultCommit();

    const messages = getCommitMessages(repoDir);

    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 1);
    assert.equal(getStatus(repoDir), '');
  });
});

test('runDefaultCommit falls back to step flow for invalid mode', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'fast' });
    writeFile(repoDir, 'README.md', 'invalid mode readme change\n');
    writeFile(repoDir, 'src/app.js', 'console.log("invalid mode");\n');

    await commands.runDefaultCommit();

    const messages = getCommitMessages(repoDir);

    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 2);
    assert.equal(getStatus(repoDir), '');
  });
});

test('runBatchCommit does not call Gemini or commit when external AI transmission is rejected', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Gemini should not be called after transmission rejection');
    };

    prompts.inject([false]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'gemini',
      apiKey: 'test-key',
      modelVersion: 'gemini-test',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'gemini rejected change\n');

    await commands.runBatchCommit();

    assert.equal(fetchCalled, false);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('runBatchCommit does not call OpenAI-compatible provider or commit when external AI transmission is rejected', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('OpenAI-compatible provider should not be called after transmission rejection');
    };

    prompts.inject([false]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'openaiCompatible',
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      modelVersion: 'test-model',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'openai-compatible rejected change\n');

    await commands.runBatchCommit();

    assert.equal(fetchCalled, false);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('runBatchCommit requires confirmation for OpenAI-compatible http custom endpoint and rejection prevents fetch', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('OpenAI-compatible HTTP endpoint should not be called after transmission rejection');
    };

    prompts.inject([false]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'openaiCompatible',
      apiKey: 'test-key',
      baseURL: 'http://custom-llm.example.test/v1',
      modelVersion: 'test-model',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'openai-compatible http rejected change\n');

    await commands.runBatchCommit();

    assert.equal(fetchCalled, false);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('OpenAI-compatible external AI confirmation message identifies endpoint without leaking URL secrets', () => {
  const message = buildExternalAITransmissionMessage({
    provider: 'openaiCompatible',
    baseURL: 'http://user:secret-token@custom-llm.example.test/v1?api_key=query-secret#token-fragment',
  });

  assert.match(message, /openaiCompatible/);
  assert.match(message, /http:\/\/custom-llm\.example\.test\/v1/);
  assert.match(message, /unencrypted HTTP/);
  assert.doesNotMatch(message, /secret-token/);
  assert.doesNotMatch(message, /query-secret/);
  assert.doesNotMatch(message, /token-fragment/);
  assert.doesNotMatch(message, /api_key/);
});

test('runStepCommit does not call remote localLLM or commit when external AI transmission is rejected', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Remote localLLM should not be called after transmission rejection');
    };

    prompts.inject([false]);
    saveRuntimeConfig({
      mode: 'step',
      provider: 'localLLM',
      baseURL: 'https://llm.example.test/v1',
      modelVersion: 'test-model',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'remote localllm rejected change\n');

    await commands.runStepCommit();

    assert.equal(fetchCalled, false);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('runBatchCommit allows localLLM localhost without external AI transmission confirmation', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;
    globalThis.fetch = async (url) => {
      fetchCalled = true;
      assert.equal(url, 'http://localhost:11434/v1/chat/completions');

      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: 'chore: update project files' } }],
          };
        },
      };
    };

    saveRuntimeConfig({
      mode: 'batch',
      provider: 'localLLM',
      baseURL: 'http://localhost:11434/v1',
      modelVersion: 'test-model',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'local localllm allowed change\n');

    await commands.runBatchCommit();

    assert.equal(fetchCalled, true);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: update project files');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runBatchCommit sends masked diff to Gemini and does not log raw secret', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    const rawSecret = 'gemini-raw-secret-value';
    const warnings = [];
    let promptSent = '';

    console.warn = (message) => {
      warnings.push(String(message));
    };

    globalThis.fetch = async (_url, options = {}) => {
      const payload = JSON.parse(options.body);
      promptSent = payload.contents[0].parts[0].text;

      return {
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [{ text: 'chore: update project files' }],
                },
              },
            ],
          };
        },
      };
    };

    prompts.inject([true]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'gemini',
      apiKey: 'test-key',
      modelVersion: 'gemini-test',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', `API_KEY=${rawSecret}\n`);

    await commands.runBatchCommit();

    assert.equal(promptSent.includes(rawSecret), false);
    assert.match(promptSent, /API_KEY=\[REDACTED\]/u);
    assert.equal(warnings.some((message) => message.includes(rawSecret)), false);
    assert.equal(warnings.some((message) => message.includes('masked before external AI transmission')), true);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: update project files');
  });
});

test('runBatchCommit sends masked diff to OpenAI-compatible provider and does not log raw secret', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    const rawSecret = 'postgres://user:password@example.test/db';
    const warnings = [];
    let promptSent = '';

    console.warn = (message) => {
      warnings.push(String(message));
    };

    globalThis.fetch = async (_url, options = {}) => {
      const payload = JSON.parse(options.body);
      promptSent = payload.messages[0].content;

      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: 'chore: update project files' } }],
          };
        },
      };
    };

    prompts.inject([true]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'openaiCompatible',
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      modelVersion: 'test-model',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', `DATABASE_URL=${rawSecret}\n`);

    await commands.runBatchCommit();

    assert.equal(promptSent.includes(rawSecret), false);
    assert.match(promptSent, /DATABASE_URL=\[REDACTED\]/u);
    assert.equal(warnings.some((message) => message.includes(rawSecret)), false);
    assert.equal(warnings.some((message) => message.includes('masked before external AI transmission')), true);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: update project files');
  });
});

test('runBatchCommit stops safely on Gemini 429 when user chooses stop', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    let fetchCalled = false;

    globalThis.fetch = async () => {
      fetchCalled = true;

      return {
        ok: false,
        status: 429,
        async text() {
          return 'raw body with test-key';
        },
      };
    };

    prompts.inject([true, 'stop']);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'gemini',
      authType: 'api',
      apiKey: 'test-key',
      modelVersion: 'gemini-test',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'gemini exhausted stop change\n');

    await commands.runBatchCommit();

    assert.equal(fetchCalled, true);
    assert.equal(getCommitMessages(repoDir)[0], 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('runBatchCommit retries Gemini 429 with a replacement API key before committing', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    const apiKeys = [];

    globalThis.fetch = async (_url, options = {}) => {
      apiKeys.push(options.headers['x-goog-api-key']);

      if (apiKeys.length === 1) {
        return {
          ok: false,
          status: 429,
          async text() {
            return 'raw body with old-key';
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [{ text: 'chore: update project files' }],
                },
              },
            ],
          };
        },
      };
    };

    prompts.inject([true, 'replaceApiKey', 'new-key', true]);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'gemini',
      authType: 'api',
      apiKey: 'old-key',
      modelVersion: 'gemini-test',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'gemini exhausted retry key change\n');

    await commands.runBatchCommit();

    assert.deepEqual(apiKeys, ['old-key', 'new-key']);
    assert.equal(store.loadCredentials().gemini.apiKey, 'new-key');
    assert.equal(getCommitMessages(repoDir)[0], 'chore: update project files');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runBatchCommit can switch from exhausted Gemini to localLLM and retry safely', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    const requestedURLs = [];

    globalThis.fetch = async (url) => {
      requestedURLs.push(url);

      if (requestedURLs.length === 1) {
        return {
          ok: false,
          status: 429,
          async text() {
            return 'raw body with gemini-key';
          },
        };
      }

      if (String(url).endsWith('/models')) {
        return {
          ok: true,
          async json() {
            return { data: [{ id: 'test-local-model' }] };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            choices: [{ message: { content: 'chore: update project files' } }],
          };
        },
      };
    };

    prompts.inject([true, 'switchModel', 'localLLM', 'test-local-model']);
    saveRuntimeConfig({
      mode: 'batch',
      provider: 'gemini',
      authType: 'api',
      apiKey: 'gemini-key',
      modelVersion: 'gemini-test',
      confirmBeforeCommit: false,
    });
    writeFile(repoDir, 'README.md', 'switch provider after exhausted change\n');

    await commands.runBatchCommit();

    assert.match(String(requestedURLs[0]), /generativelanguage/);
    assert.equal(requestedURLs[1], 'http://localhost:11434/v1/models');
    assert.equal(requestedURLs[2], 'http://localhost:11434/v1/chat/completions');
    assert.equal(store.loadConfig().provider, 'localLLM');
    assert.equal(getCommitMessages(repoDir)[0], 'chore: update project files');
    assert.equal(getStatus(repoDir), '');
  });
});
