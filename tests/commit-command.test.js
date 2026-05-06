import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';

import { DEFAULT_CONFIG } from '../src/config/defaults.js';

let commands;
let store;
let tempHome;
let previousHome;
let previousUserProfile;

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

function getStatus(repoDir) {
  return runGit(repoDir, ['-c', 'core.quotepath=false', 'status', '--porcelain']);
}

test('runBatchCommit creates one commit for committable changed files', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'batch' });
    writeFile(repoDir, 'README.md', 'batch readme change\n');
    writeFile(repoDir, '.env', 'TOKEN=should-not-commit\n');

    await commands.runBatchCommit();

    const messages = getCommitMessages(repoDir);
    const status = getStatus(repoDir);

    assert.equal(messages[0], 'chore: update project files');
    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 1);
    assert.match(status, /^\?\? \.env/m);
    assert.equal(status.includes('README.md'), false);
  });
});

test('runStepCommit creates one commit per committable file', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    saveRuntimeConfig({ mode: 'step' });
    writeFile(repoDir, 'README.md', 'step readme change\n');
    writeFile(repoDir, 'src/app.js', 'console.log("changed");\n');

    await commands.runStepCommit();

    const messages = getCommitMessages(repoDir);

    assert.equal(messages.filter((message) => message === 'chore: update project files').length, 2);
    assert.equal(getStatus(repoDir), '');
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
