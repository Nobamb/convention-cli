import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import prompts from 'prompts';

import { runReset } from '../src/commands/reset.js';

const gitAvailable = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const skipWithoutGit = gitAvailable ? false : 'git is not available in this environment';

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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-reset-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Convention Test']);
  writeFile(repoDir, 'README.md', 'initial readme\n');
  runGit(repoDir, ['add', '-A']);
  runGit(repoDir, ['commit', '-m', 'chore: initial commit']);
  writeFile(repoDir, 'README.md', 'second readme\n');
  runGit(repoDir, ['add', 'README.md']);
  runGit(repoDir, ['commit', '-m', 'chore: second commit']);

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
    prompts.inject([]);
  }
}

function getLastCommitMessage(repoDir) {
  return runGit(repoDir, ['log', '-1', '--pretty=%s']).trim();
}

function getStatus(repoDir) {
  return runGit(repoDir, ['-c', 'core.quotepath=false', 'status', '--porcelain']);
}

test('runReset does not reset when user rejects confirmation', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    prompts.inject([false]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset does not reset when confirmation prompt is canceled', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    prompts.inject([new Error('user canceled prompt')]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset treats an undefined confirmation response as rejection', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    prompts.inject([undefined]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: second commit');
    assert.equal(getStatus(repoDir), '');
  });
});

test('runReset resets only HEAD~1 after confirmation and keeps changes in working tree', { skip: skipWithoutGit }, async () => {
  await withRepo(async (repoDir) => {
    prompts.inject([true]);

    await runReset();

    assert.equal(getLastCommitMessage(repoDir), 'chore: initial commit');
    assert.match(getStatus(repoDir), /^ M README\.md/m);
  });
});

test('runReset does not execute git reset outside a git repository', { skip: skipWithoutGit }, async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-reset-non-repo-'));

  try {
    process.chdir(tempDir);
    prompts.inject([true]);

    await runReset();
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(tempDir);
    prompts.inject([]);
  }
});
