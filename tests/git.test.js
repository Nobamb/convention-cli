import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  addAll,
  addFile,
  commit,
  getChangedFiles,
  getFileDiffs,
  getFullDiff,
  isGitRepository,
} from '../src/core/git.js';

const gitAvailable = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const skipWithoutGit = gitAvailable ? false : 'git is not available in this environment';
const KOREAN_NEW_FILE = '\ud55c\uae00-\uc0c8\ud30c\uc77c.js';

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

function removeFile(repoDir, relativePath) {
  fs.rmSync(path.join(repoDir, relativePath), { force: true });
}

function createTempRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-git-'));

  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Convention Test']);
  writeFile(repoDir, 'README.md', 'initial readme\n');
  writeFile(repoDir, 'old-file.js', 'console.log("old");\n');
  writeFile(repoDir, 'delete-me.js', 'delete me\n');
  writeFile(repoDir, 'clean.js', 'clean\n');
  writeFile(repoDir, 'old-name.js', 'rename me\n');
  writeFile(repoDir, 'file with space.js', 'space file\n');
  writeFile(repoDir, '한글파일.js', '한글 내용\n');
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

function getPorcelainStatus(repoDir) {
  return runGit(repoDir, ['-c', 'core.quotepath=false', 'status', '--porcelain']);
}

function getStatusLine(repoDir, relativePath) {
  return getPorcelainStatus(repoDir)
    .split(/\r?\n/)
    .find((line) => line.includes(relativePath));
}

function getLastCommitMessage(repoDir) {
  return runGit(repoDir, ['log', '-1', '--pretty=%B']).replace(/\r?\n+$/, '');
}

test('isGitRepository returns true in a git repository root', { skip: skipWithoutGit }, async () => {
  await withRepo(() => {
    assert.equal(isGitRepository(), true);
  });
});

test('isGitRepository returns true in a git repository subdirectory', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    const subdir = path.join(repoDir, 'src', 'nested');
    fs.mkdirSync(subdir, { recursive: true });
    process.chdir(subdir);

    assert.equal(isGitRepository(), true);
  });
});

test('isGitRepository returns false outside a git repository', { skip: skipWithoutGit }, () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-non-repo-'));

  try {
    process.chdir(tempDir);
    assert.equal(isGitRepository(), false);
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(tempDir);
  }
});

test('git core implementation avoids unsafe execution and logging patterns', () => {
  const source = fs.readFileSync(new URL('../src/core/git.js', import.meta.url), 'utf8');

  assert.equal(source.includes('execSync'), false);
  assert.equal(/shell\s*:\s*true/.test(source), false);
  assert.equal(/console\./.test(source), false);
  assert.equal(source.includes('reset'), false);
  assert.match(source, /\[["']add["'], ["']-A["']\]/);
  assert.match(source, /\[["']add["'], ["']--["'], file\]/);
  assert.match(source, /\[["']commit["'], ["']-m["'], message\]/);
  assert.match(source, /encoding: ["']utf8["']/);
});

test('getChangedFiles returns an empty array for a clean repository', { skip: skipWithoutGit }, async () => {
  await withRepo(() => {
    assert.deepEqual(getChangedFiles(), []);
  });
});

test('getChangedFiles returns modified, untracked, deleted, space, Korean, and renamed files', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'changed readme\n');
    writeFile(repoDir, 'new-file.js', 'new file\n');
    removeFile(repoDir, 'old-file.js');
    writeFile(repoDir, 'file with space.js', 'space file changed\n');
    writeFile(repoDir, '한글파일.js', '한글 변경\n');
    runGit(repoDir, ['mv', 'old-name.js', 'new-name.js']);

    const changedFiles = getChangedFiles();

    assert.equal(changedFiles.includes('README.md'), true);
    assert.equal(changedFiles.includes('new-file.js'), true);
    assert.equal(changedFiles.includes('old-file.js'), true);
    assert.equal(changedFiles.includes('file with space.js'), true);
    assert.equal(changedFiles.includes('한글파일.js'), true);
    assert.equal(changedFiles.includes('new-name.js'), true);
    assert.equal(changedFiles.includes('old-name.js'), false);
  });
});

test('getFullDiff returns an empty string for a clean repository', { skip: skipWithoutGit }, async () => {
  await withRepo(() => {
    assert.equal(getFullDiff(), '');
  });
});

test('getFullDiff includes staged, unstaged, staged new, deleted, and Korean tracked diffs', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'unstaged readme\n');
    writeFile(repoDir, 'clean.js', 'staged clean change\n');
    runGit(repoDir, ['add', 'clean.js']);
    writeFile(repoDir, 'staged-new.js', 'new staged content\n');
    runGit(repoDir, ['add', 'staged-new.js']);
    removeFile(repoDir, 'delete-me.js');
    writeFile(repoDir, '한글파일.js', '한글 변경\n');

    const diff = getFullDiff();

    assert.match(diff, /diff --git/);
    assert.match(diff, /README\.md/);
    assert.match(diff, /clean\.js/);
    assert.match(diff, /staged-new\.js/);
    assert.match(diff, /new file mode/);
    assert.match(diff, /delete-me\.js/);
    assert.match(diff, /deleted file mode/);
    assert.match(diff, /한글파일\.js/);
  });
});

test('getFullDiff includes untracked new files and excludes sensitive file diffs', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'untracked-only.js', 'untracked content\n');
    writeFile(repoDir, '.env', 'TOKEN=secret\n');
    writeFile(repoDir, 'private.pem', 'PRIVATE_KEY=secret\n');
    runGit(repoDir, ['add', '.env', 'private.pem']);

    const diff = getFullDiff();

    assert.match(diff, /untracked-only\.js/);
    assert.match(diff, /new file mode/);
    assert.match(diff, /untracked content/);
    assert.equal(diff.includes('.env'), false);
    assert.equal(diff.includes('private.pem'), false);
    assert.equal(diff.includes('TOKEN=secret'), false);
    assert.equal(diff.includes('PRIVATE_KEY=secret'), false);
  });
});

test('getFullDiff throws outside a git repository', { skip: skipWithoutGit }, () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-non-repo-'));

  try {
    process.chdir(tempDir);
    assert.throws(() => getFullDiff());
  } finally {
    process.chdir(originalCwd);
    cleanupTempRepo(tempDir);
  }
});

test('getFullDiff does not write raw diff output to console', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const calls = [];

    console.log = (message) => calls.push(message);
    console.error = (message) => calls.push(message);
    console.warn = (message) => calls.push(message);
    console.info = (message) => calls.push(message);

    try {
      writeFile(repoDir, 'README.md', 'changed readme\n');
      const diff = getFullDiff();

      assert.notEqual(diff, '');
      assert.deepEqual(calls, []);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  });
});

test('getFileDiffs returns separated file diffs and preserves input order', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'readme A\n');
    writeFile(repoDir, 'clean.js', 'clean B\n');

    const fileDiffs = getFileDiffs(['README.md', 'clean.js']);

    assert.deepEqual(fileDiffs.map(({ file }) => file), ['README.md', 'clean.js']);
    assert.match(fileDiffs[0].diff, /README\.md/);
    assert.doesNotMatch(fileDiffs[0].diff, /clean\.js/);
    assert.match(fileDiffs[1].diff, /clean\.js/);
    assert.doesNotMatch(fileDiffs[1].diff, /README\.md/);
  });
});

test('getFileDiffs handles space, Korean, deleted, and staged new filenames', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'file with space.js', 'space changed\n');
    writeFile(repoDir, '한글파일.js', '한글 변경\n');
    removeFile(repoDir, 'delete-me.js');
    writeFile(repoDir, 'new-file.js', 'new staged file\n');
    runGit(repoDir, ['add', 'new-file.js']);

    const fileDiffs = getFileDiffs(['file with space.js', '한글파일.js', 'delete-me.js', 'new-file.js']);

    assert.deepEqual(fileDiffs.map(({ file }) => file), [
      'file with space.js',
      '한글파일.js',
      'delete-me.js',
      'new-file.js',
    ]);
    assert.match(fileDiffs[0].diff, /file with space\.js/);
    assert.match(fileDiffs[1].diff, /한글파일\.js/);
    assert.match(fileDiffs[2].diff, /deleted file mode/);
    assert.match(fileDiffs[3].diff, /new file mode/);
  });
});

test('getFileDiffs includes untracked new files and excludes clean, empty, non-string, and sensitive files', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'untracked.js', 'untracked\n');
    writeFile(repoDir, 'README.md', 'changed readme\n');
    writeFile(repoDir, '.env.local', 'PASSWORD=secret\n');
    writeFile(repoDir, 'id_rsa', 'PRIVATE_KEY=secret\n');
    runGit(repoDir, ['add', '.env.local', 'id_rsa']);

    const fileDiffs = getFileDiffs([
      '',
      null,
      'untracked.js',
      'clean.js',
      '.env.local',
      'id_rsa',
      'README.md',
    ]);

    assert.deepEqual(fileDiffs.map(({ file }) => file), ['untracked.js', 'README.md']);
    assert.match(fileDiffs[0].diff, /new file mode/);
    assert.match(fileDiffs[0].diff, /untracked/);
    assert.equal(fileDiffs.some(({ diff }) => diff.includes('PASSWORD=secret')), false);
    assert.equal(fileDiffs.some(({ diff }) => diff.includes('PRIVATE_KEY=secret')), false);
  });
});

test('getFileDiffs handles untracked space and Korean filenames', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'new file with space.js', 'space new file\n');
    writeFile(repoDir, KOREAN_NEW_FILE, 'Korean new file\n');

    const fileDiffs = getFileDiffs(['new file with space.js', KOREAN_NEW_FILE]);

    assert.deepEqual(fileDiffs.map(({ file }) => file), ['new file with space.js', KOREAN_NEW_FILE]);
    assert.match(fileDiffs[0].diff, /new file with space\.js/);
    assert.match(fileDiffs[0].diff, /space new file/);
    assert.match(fileDiffs[1].diff, new RegExp(KOREAN_NEW_FILE.replace('.', '\\.')));
    assert.match(fileDiffs[1].diff, /Korean new file/);
  });
});

test('getChangedFiles expands untracked directories to file paths', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'docs/new-guide.md', 'new guide\n');
    writeFile(repoDir, 'docs/nested/new-note.md', 'new note\n');

    const changedFiles = getChangedFiles();

    assert.equal(changedFiles.includes('docs/new-guide.md'), true);
    assert.equal(changedFiles.includes('docs/nested/new-note.md'), true);
    assert.equal(changedFiles.includes('docs/'), false);
  });
});

test('getFileDiffs returns an empty array for empty input', () => {
  assert.deepEqual(getFileDiffs([]), []);
});

test('getFileDiffs rejects non-array input', () => {
  for (const value of [null, undefined, 'README.md', 1, {}]) {
    assert.throws(() => getFileDiffs(value), TypeError);
  }
});

test('getFileDiffs does not write raw diff output to console', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const calls = [];

    console.log = (message) => calls.push(message);
    console.error = (message) => calls.push(message);
    console.warn = (message) => calls.push(message);
    console.info = (message) => calls.push(message);

    try {
      writeFile(repoDir, 'README.md', 'changed readme\n');
      const fileDiffs = getFileDiffs(['README.md']);

      assert.equal(fileDiffs.length, 1);
      assert.deepEqual(calls, []);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  });
});

test('addAll stages modified, new, deleted, space, and Korean filenames', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'changed readme\n');
    writeFile(repoDir, 'new-file.js', 'new file\n');
    removeFile(repoDir, 'delete-me.js');
    writeFile(repoDir, 'file with space.js', 'space file changed\n');
    writeFile(repoDir, KOREAN_NEW_FILE, 'Korean filename content\n');

    addAll();

    assert.match(getStatusLine(repoDir, 'README.md'), /^M /);
    assert.match(getStatusLine(repoDir, 'new-file.js'), /^A /);
    assert.match(getStatusLine(repoDir, 'delete-me.js'), /^D /);
    assert.match(getStatusLine(repoDir, 'file with space.js'), /^M /);
    assert.match(getStatusLine(repoDir, KOREAN_NEW_FILE), /^A /);
  });
});

test('addFile stages only the requested file and supports spaces', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'changed readme\n');
    writeFile(repoDir, 'file with space.js', 'space file changed\n');

    addFile('file with space.js');

    assert.match(getStatusLine(repoDir, 'file with space.js'), /^M /);
    assert.match(getStatusLine(repoDir, 'README.md'), /^ M/);
  });
});

test('addFile stages Korean filenames and tracked deletions', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, KOREAN_NEW_FILE, 'Korean filename content\n');
    addFile(KOREAN_NEW_FILE);
    assert.match(getStatusLine(repoDir, KOREAN_NEW_FILE), /^A /);

    removeFile(repoDir, 'delete-me.js');
    addFile('delete-me.js');
    assert.match(getStatusLine(repoDir, 'delete-me.js'), /^D /);
  });
});

test('addFile rejects invalid input and propagates git errors', { skip: skipWithoutGit }, async () => {
  await withRepo(() => {
    assert.throws(() => addFile(''), TypeError);

    const originalError = console.error;
    console.error = () => {};

    try {
      assert.throws(() => addFile('none.js'));
    } finally {
      console.error = originalError;
    }
  });
});

test('commit creates a commit with a normal message', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    writeFile(repoDir, 'README.md', 'changed readme\n');
    addFile('README.md');

    commit('feat: add normal feature');

    assert.equal(getLastCommitMessage(repoDir), 'feat: add normal feature');
  });
});

test('commit preserves Korean, emoji, multiline, and special character messages', { skip: skipWithoutGit }, async () => {
  await withRepo((repoDir) => {
    const messages = [
      'feat: 한글 메시지 테스트',
      'feat: add emoji 🚀',
      'feat: add multiline body\n\n- body line 1\n- body line 2',
      'feat: test quotes \' " $ ` ;',
    ];

    for (const [index, message] of messages.entries()) {
      writeFile(repoDir, `commit-${index}.js`, `change ${index}\n`);
      addFile(`commit-${index}.js`);
      commit(message);

      assert.equal(getLastCommitMessage(repoDir), message);
    }
  });
});

test('commit rejects empty messages and propagates git errors when nothing is staged', { skip: skipWithoutGit }, async () => {
  await withRepo(() => {
    assert.throws(() => commit(''), TypeError);
    assert.throws(() => commit(null), TypeError);

    const originalError = console.error;
    console.error = () => {};

    try {
      assert.throws(() => commit('chore: should fail'));
    } finally {
      console.error = originalError;
    }
  });
});
