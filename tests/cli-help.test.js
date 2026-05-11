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

test('CLI top-level catch delegates error output to logger', () => {
  const source = fs.readFileSync('bin/convention.js', 'utf8');

  assert.match(source, /import \{ error as logError \} from "\.\.\/src\/utils\/logger\.js";/);
  assert.doesNotMatch(source, /console\.error\(error instanceof Error/);
  assert.match(source, /logError\(error instanceof Error \? error\.message : String\(error\)\)/);
});
