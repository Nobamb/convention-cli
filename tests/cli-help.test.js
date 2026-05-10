import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('CLI help includes question setting option', () => {
  const output = execFileSync(process.execPath, ['bin/convention.js', '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /-q, --question/);
  assert.match(output, /true/);
  assert.match(output, /false/);
});
