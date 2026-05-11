import assert from 'node:assert/strict';
import test from 'node:test';

import { maskSensitiveDiff } from '../src/core/security.js';

test('maskSensitiveDiff redacts required diff secret patterns', () => {
  const rawValues = [
    'api-key-value',
    'secret-value',
    'token-value',
    'password-value',
    'private-key-value',
    'postgres://user:password@example.test/db',
    'aws-access-key-value',
    'private-key-line-value',
  ];

  const diff = [
    '+API_KEY=api-key-value',
    '+SECRET=secret-value',
    '+TOKEN=token-value',
    '+PASSWORD=password-value',
    '+PRIVATE_KEY=private-key-value',
    '+DATABASE_URL=postgres://user:password@example.test/db',
    '+AWS_ACCESS_KEY_ID=aws-access-key-value',
    '+-----BEGIN PRIVATE KEY-----',
    '+private-key-line-value',
    '+-----END PRIVATE KEY-----',
  ].join('\n');

  const result = maskSensitiveDiff(diff);

  assert.equal(result.found, true);
  assert.match(result.diff, /API_KEY=\[REDACTED\]/u);
  assert.match(result.diff, /SECRET=\[REDACTED\]/u);
  assert.match(result.diff, /TOKEN=\[REDACTED\]/u);
  assert.match(result.diff, /PASSWORD=\[REDACTED\]/u);
  assert.match(result.diff, /PRIVATE_KEY=\[REDACTED\]/u);
  assert.match(result.diff, /DATABASE_URL=\[REDACTED\]/u);
  assert.match(result.diff, /AWS_ACCESS_KEY_ID=\[REDACTED\]/u);

  for (const rawValue of rawValues) {
    assert.equal(result.diff.includes(rawValue), false);
  }
});
