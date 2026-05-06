import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';

import { error, info, success, warn } from '../src/utils/logger.js';

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
