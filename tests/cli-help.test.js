import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

test('CLI help includes question setting option', () => {
  const output = execFileSync(process.execPath, ['bin/convention.js', '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /-q, --question/);
  assert.match(output, /true/);
  assert.match(output, /false/);
});

test('CLI help includes push option', () => {
  const output = execFileSync(process.execPath, ['bin/convention.js', '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /--push/);
  assert.match(output, /push/);
});

test('CLI help includes reset option', () => {
  const output = execFileSync(process.execPath, ['bin/convention.js', '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /--reset/);
  assert.match(output, /working tree/);
});

test('CLI routes reset before commit and push flows', () => {
  const source = fs.readFileSync('bin/convention.js', 'utf8');
  const resetIndex = source.indexOf('if (options.reset)');
  const stepIndex = source.indexOf('if (options.step)');
  const batchIndex = source.indexOf('if (options.batch)');
  const defaultCommitIndex = source.indexOf('runDefaultCommit({ push: options.push })');

  assert.match(source, /import \{ runReset \} from "\.\.\/src\/commands\/reset\.js";/);
  assert.notEqual(resetIndex, -1);
  assert.equal(resetIndex < stepIndex, true);
  assert.equal(resetIndex < batchIndex, true);
  assert.equal(resetIndex < defaultCommitIndex, true);
});

test('CLI top-level catch delegates error output to logger', () => {
  const source = fs.readFileSync('bin/convention.js', 'utf8');

  assert.match(source, /import \{ error as logError \} from "\.\.\/src\/utils\/logger\.js";/);
  assert.doesNotMatch(source, /console\.error\(error instanceof Error/);
  assert.match(source, /logError\(error instanceof Error \? error\.message : String\(error\)\)/);
});
