// 로그와 GitHub Actions output에 공통으로 사용하는 secret 마스킹 표시 문자열입니다.
// 실제 secret 원문 대신 이 값만 출력해, 에러 메시지나 preview 로그가 CI 로그에 남아도 인증 정보가 노출되지 않게 합니다.
const SECRET_VALUE = "[REDACTED]";

// api key, token, secret, password 등 secret field name 정규식입니다.
// CI 보안 단계에서 DATABASE_URL, AWS_ACCESS_KEY_ID, PRIVATE_KEY도 logger 레벨에서 공통 마스킹 대상으로 다룹니다.
const SECRET_FIELD_NAMES =
  "(?:api[-_]?key|apikey|token|secret|password|private[-_]?key|database[-_]?url|aws[-_]?access[-_]?key[-_]?id)";

// 실제 secret value pattern 정규식입니다.
// 공백, quote, JSON 구분자 전까지를 값으로 보며, logger는 원문을 복원할 필요가 없으므로 넓게 마스킹합니다.
const SECRET_VALUE_PATTERN = "[^\"'\\s,}&]+";

// 비밀 값 패턴
const SECRET_PATTERNS = [
  // PEM private key block이 한 문자열 안에 들어온 경우 전체 block을 마스킹합니다.
  // CI 로그에 private key body가 여러 줄로 남는 것을 막기 위한 최우선 패턴입니다.
  {
    pattern: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/giu,
    replacement: SECRET_VALUE,
  },
  // URL에 @ 포함된 경우
  {
    pattern: /\b(https?:\/\/)([^/?#\s@]+)@/giu,
    replacement: `$1${SECRET_VALUE}@`,
  },
  // ?key=value, &key=value 형태
  {
    pattern:
      /([?&](?:api[-_]?key|apikey|key|token|secret|password|private[-_]?key|database[-_]?url|aws[-_]?access[-_]?key[-_]?id)=)[^&#\s]+/giu,
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
 * 메시지에서 secret 의심 값을 제거합니다.
 *
 * 이 함수는 logger 함수와 GitHub Actions output writer가 공통으로 사용하는 최종 방어선입니다.
 * 입력 값이 Error 객체나 숫자처럼 문자열이 아니어도 안전하게 문자열로 변환한 뒤, API Key, token,
 * password, private key, credential URL 등 알려진 패턴을 `[REDACTED]`로 치환합니다.
 *
 * @param {unknown} message - 사용자에게 출력하기 직전의 메시지 또는 오류 값입니다.
 * @returns {string} secret 의심 값이 제거된 안전한 문자열입니다.
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
