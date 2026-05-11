// secret 정보 포함된 message를 logging하기 전 redact 처리
const SECRET_PATTERNS = [
  /(api[_-]?key\s*[:=]\s*)(["']?)[^"'\s,}]+/giu,
  /(token\s*[:=]\s*)(["']?)[^"'\s,}]+/giu,
  /(secret\s*[:=]\s*)(["']?)[^"'\s,}]+/giu,
  /(password\s*[:=]\s*)(["']?)[^"'\s,}]+/giu,
  /(authorization\s*[:=]\s*bearer\s+)(["']?)[^"'\s,}]+/giu,
];

/**
 * 전달받은 message에서 secret 정보 포함된 부분 redact 처리
 * @param {string} message
 * @returns {string}
 */
export function redactSecrets(message) {
  // string 타입이 아니거나
  // null
  // undefined 이면
  // string 으로 변환
  let value = typeof message === "string" ? message : String(message ?? "");

  // secret pattern을 포함한 문자열을 [REDACTED]로 치환
  for (const pattern of SECRET_PATTERNS) {
    value = value.replace(pattern, "$1$2[REDACTED]");
  }

  return value;
}

/**
 * 전달받은 message를 success log로 출력
 * @param {string} message
 */
export function success(message) {
  console.log(`✅ ${redactSecrets(message)}`);
}

/**
 * 전달받은 message를 error log로 출력
 * @param {string} message
 */
export function error(message) {
  console.error(`❌ ${redactSecrets(message)}`);
}

/**
 * 전달받은 message를 warning log로 출력
 * @param {string} message
 */
export function warn(message) {
  console.warn(`⚠️ ${redactSecrets(message)}`);
}

/**
 * 전달받은 message를 info log로 출력
 * @param {string} message
 */
export function info(message) {
  console.log(`ℹ️ ${redactSecrets(message)}`);
}
