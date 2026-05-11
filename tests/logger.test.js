import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';

import { error, info, redactSecrets, success, warn } from '../src/utils/logger.js';

let originalLog;
let originalError;
let originalWarn;
let logCalls;
let errorCalls;
let warnCalls;

beforeEach(() => {
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;
  logCalls = [];
  errorCalls = [];
  warnCalls = [];

  console.log = (message) => {
    logCalls.push(message);
  };
  console.error = (message) => {
    errorCalls.push(message);
  };
  console.warn = (message) => {
    warnCalls.push(message);
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

test('success writes prefixed message to console.log', () => {
  success('설정이 저장되었습니다.');

  assert.deepEqual(logCalls, ['✅ 설정이 저장되었습니다.']);
  assert.deepEqual(errorCalls, []);
  assert.deepEqual(warnCalls, []);
});

test('error writes prefixed message to console.error', () => {
  error('지원하지 않는 옵션입니다.');

  assert.deepEqual(errorCalls, ['❌ 지원하지 않는 옵션입니다.']);
  assert.deepEqual(logCalls, []);
  assert.deepEqual(warnCalls, []);
});

test('warn writes prefixed message to console.warn', () => {
  warn('변경사항이 없습니다.');

  assert.deepEqual(warnCalls, ['⚠️ 변경사항이 없습니다.']);
  assert.deepEqual(logCalls, []);
  assert.deepEqual(errorCalls, []);
});

test('info writes prefixed message to console.log', () => {
  info('변경 파일을 확인하는 중입니다.');

  assert.deepEqual(logCalls, ['ℹ️ 변경 파일을 확인하는 중입니다.']);
  assert.deepEqual(errorCalls, []);
  assert.deepEqual(warnCalls, []);
});

test('logger functions return undefined', () => {
  assert.equal(success('ok'), undefined);
  assert.equal(error('bad'), undefined);
  assert.equal(warn('careful'), undefined);
  assert.equal(info('note'), undefined);
});

test('redactSecrets masks common API key and bearer token variants', () => {
  assert.equal(redactSecrets('apiKey=abc123'), 'apiKey=[REDACTED]');
  assert.equal(redactSecrets('api_key: abc123'), 'api_key: [REDACTED]');
  assert.equal(redactSecrets('api-key="abc123"'), 'api-key="[REDACTED]"');
  assert.equal(redactSecrets('"apiKey": "abc123"'), '"apiKey": "[REDACTED]"');
  assert.equal(redactSecrets("'token': 'abc123'"), "'token': '[REDACTED]'");
  assert.equal(redactSecrets('PASSWORD = abc123'), 'PASSWORD = [REDACTED]');
  assert.equal(
    redactSecrets('Authorization: Bearer abc.def.ghi'),
    'Authorization: Bearer [REDACTED]',
  );
  assert.equal(
    redactSecrets('Authorization: "Bearer abc.def.ghi"'),
    'Authorization: "Bearer [REDACTED]"',
  );
  assert.equal(
    redactSecrets('"authorization": "Bearer abc.def.ghi"'),
    '"authorization": "Bearer [REDACTED]"',
  );
  assert.equal(
    redactSecrets('failed https://user:secret@example.test/v1?api_key=abc&token=def'),
    'failed https://[REDACTED]@example.test/v1?api_key=[REDACTED]&token=[REDACTED]',
  );
});

test('error redacts secrets before writing to console.error', () => {
  error('request failed: Authorization: Bearer abc.def and api_key=secret-key');

  assert.equal(errorCalls.length, 1);
  assert.match(errorCalls[0], /Authorization: Bearer \[REDACTED\]/);
  assert.match(errorCalls[0], /api_key=\[REDACTED\]/);
  assert.doesNotMatch(errorCalls[0], /abc\.def|secret-key/);
});
