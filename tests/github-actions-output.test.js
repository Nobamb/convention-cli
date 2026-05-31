import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';

import {
  isGitHubOutputAvailable,
  sanitizeOutputValue,
  setOutput,
  setOutputs,
} from '../src/utils/githubActions.js';

let tempFiles = [];

function createOutputFile() {
  const filePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-gh-output-')),
    'output.txt',
  );
  fs.writeFileSync(filePath, '', 'utf8');
  tempFiles.push(path.dirname(filePath));
  return filePath;
}

afterEach(() => {
  for (const dir of tempFiles) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempFiles = [];
});

test('Phase 8 AP detects GitHub Actions output availability', () => {
  assert.equal(isGitHubOutputAvailable({ GITHUB_OUTPUT: 'out.txt' }), true);
  assert.equal(isGitHubOutputAvailable({ GITHUB_OUTPUT: '' }), false);
  assert.equal(isGitHubOutputAvailable({}), false);
});

test('Phase 8 AP writes single-line output', () => {
  const outputFile = createOutputFile();

  assert.equal(
    setOutput('commit_message', 'feat: add CI mode', {
      env: { GITHUB_OUTPUT: outputFile },
    }),
    true,
  );

  assert.equal(
    fs.readFileSync(outputFile, 'utf8'),
    'commit_message=feat: add CI mode\n',
  );
});

test('Phase 8 AP writes multiline output with a delimiter', () => {
  const outputFile = createOutputFile();

  setOutput('pr_body', '## Summary\n- Add output support', {
    env: { GITHUB_OUTPUT: outputFile },
  });

  const output = fs.readFileSync(outputFile, 'utf8');
  assert.match(output, /^pr_body<<CONVENTION_OUTPUT_[a-f0-9]+/m);
  assert.match(output, /## Summary\n- Add output support/);
});

test('Phase 8 AP setOutputs skips null values and writes multiple keys', () => {
  const outputFile = createOutputFile();
  const result = setOutputs(
    {
      pr_title: 'feat: add workflow docs',
      pr_body: '## Summary\n- Docs',
      empty_value: null,
    },
    { env: { GITHUB_OUTPUT: outputFile } },
  );

  const output = fs.readFileSync(outputFile, 'utf8');
  assert.deepEqual(Object.keys(result).sort(), ['pr_body', 'pr_title']);
  assert.match(output, /pr_title=feat: add workflow docs/);
  assert.match(output, /pr_body<</);
  assert.doesNotMatch(output, /empty_value/);
});

test('Phase 8 AR output values are redacted before writing', () => {
  const outputFile = createOutputFile();

  setOutput('pr_body', 'TOKEN=secret\nAPI_KEY=abc\nDATABASE_URL=postgres://u:p@h/db', {
    env: { GITHUB_OUTPUT: outputFile },
  });

  const output = fs.readFileSync(outputFile, 'utf8');
  assert.match(output, /TOKEN=\[REDACTED\]/);
  assert.match(output, /API_KEY=\[REDACTED\]/);
  assert.match(output, /DATABASE_URL=\[REDACTED\]/);
  assert.doesNotMatch(output, /secret|postgres:\/\/u:p@h\/db/);
});

test('Phase 8 AP rejects unsafe output names', () => {
  assert.throws(
    () => setOutput('commit message', 'x', { env: { GITHUB_OUTPUT: createOutputFile() } }),
    /safe identifier/,
  );
  assert.throws(
    () => setOutput('x<<EOF', 'x', { env: { GITHUB_OUTPUT: createOutputFile() } }),
    /safe identifier/,
  );
});

test('Phase 8 AR sanitizeOutputValue masks private key blocks', () => {
  const output = sanitizeOutputValue(
    '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
  );

  assert.match(output, /\[REDACTED\]/);
  assert.doesNotMatch(output, /secret|BEGIN PRIVATE KEY/);
});
