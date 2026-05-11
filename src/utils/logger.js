// [PASSWORD]
const SECRET_VALUE = "[REDACTED]";
// api key, token, secret, password 등 secret field name 정규식
const SECRET_FIELD_NAMES = "(?:api[-_]?key|apikey|token|secret|password)";
// 실제 secret value pattern 정규식
const SECRET_VALUE_PATTERN = "[^\"'\\s,}&]+";

// 비밀 값 패턴
const SECRET_PATTERNS = [
  // URL에 @ 포함된 경우
  {
    pattern: /\b(https?:\/\/)([^/?#\s@]+)@/giu,
    replacement: `$1${SECRET_VALUE}@`,
  },
  // ?key=value, &key=value 형태
  {
    pattern:
      /([?&](?:api[-_]?key|apikey|key|token|secret|password)=)[^&#\s]+/giu,
    replacement: `$1${SECRET_VALUE}`,
  },
  // "key": "value" 형태
  {
    pattern: new RegExp(
      `(["'])(${SECRET_FIELD_NAMES})\\1(\\s*:\\s*)(["'])[^"']*\\4`,
      "giu",
    ),
    replacement: `$1$2$1$3$4${SECRET_VALUE}$4`,
  },
  // "authorization": "bearer ..." 형태
  {
    pattern: new RegExp(
      `(["'])(authorization)\\1(\\s*:\\s*)(["'])bearer\\s+[^"']*\\4`,
      "giu",
    ),
    replacement: `$1$2$1$3$4Bearer ${SECRET_VALUE}$4`,
  },
  //key:value, key=value 형태
  {
    pattern: new RegExp(
      `\\b(${SECRET_FIELD_NAMES})(\\s*[:=]\\s*)(["']?)${SECRET_VALUE_PATTERN}`,
      "giu",
    ),
    replacement: `$1$2$3${SECRET_VALUE}`,
  },
  // "authorization": "bearer ..." 형태
  // 4번 패턴에서 이미 처리되었지만 또다른 형태에서의 보안을 위해 추가
  {
    pattern: new RegExp(
      `\\b(authorization\\s*[:=]\\s*["']?bearer\\s+)(["']?)${SECRET_VALUE_PATTERN}`,
      "giu",
    ),
    replacement: `$1$2${SECRET_VALUE}`,
  },
];

/**
 * 메세지에서 비밀 값을 제거
 * @param {*} message
 * @returns {string}
 */
export function redactSecrets(message) {
  // message를 string으로 변환
  let value = typeof message === "string" ? message : String(message ?? "");
  // 정규식 pattern을 순회하면서 메세지에서 비밀 값을 제거
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    // 정규식 pattern으로 메세지에서 비밀 값을 제거
    value = value.replace(pattern, replacement);
  }
  // 비밀 값이 제거된 메세지를 반환
  return value;
}

/**
 * 성공 메시지를 로그로 출력
 * @param {*} message
 */
export function success(message) {
  console.log(`✅ ${redactSecrets(message)}`);
}

/**
 * 에러 메시지를 로그로 출력
 * @param {*} message
 */
export function error(message) {
  console.error(`❌ ${redactSecrets(message)}`);
}

/**
 * 경고 메시지를 로그로 출력
 * @param {*} message
 */
export function warn(message) {
  console.warn(`⚠️ ${redactSecrets(message)}`);
}

/**
 * 정보 메시지를 로그로 출력
 * @param {*} message
 */
export function info(message) {
  console.log(`ℹ️ ${redactSecrets(message)}`);
}
