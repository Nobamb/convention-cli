import { DEFAULT_CONFIG } from "./defaults.js";

// migration 모듈에서도 defaults.js의 버전을 다시 export해 테스트와 다른 모듈이 같은 기준을 참조하게 합니다.
export const CURRENT_CONFIG_VERSION = DEFAULT_CONFIG.configVersion;

// config.json에 저장되면 안 되는 secret 성격의 key 목록입니다.
// 사용자가 과거 버전이나 수동 편집으로 config에 넣어도 migration 단계에서 제거합니다.
const SECRET_CONFIG_KEYS = new Set([
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "token",
  "password",
  "secret",
]);

// null, 배열, 문자열 같은 값을 설정 객체로 취급하지 않기 위한 helper입니다.
function isPlainObject(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

// 사용자가 넣은 임의 object에서 secret key를 재귀적으로 제거합니다.
// DEFAULT_CONFIG에 없는 중첩 객체를 보존할 때도 token/apiKey가 딸려 들어가지 않게 하기 위한 방어입니다.
function sanitizeConfigValue(value) {
  // 객체가 아니면 그대로 반환합니다. 문자열/숫자/boolean은 secret key를 가질 수 없기 때문입니다.
  if (!isPlainObject(value)) {
    return value;
  }

  // 새 객체를 만들어 원본 객체를 직접 변형하지 않습니다.
  const sanitized = {};

  // 모든 필드를 순회하면서 secret key는 건너뛰고, 나머지는 재귀적으로 정리합니다.
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SECRET_CONFIG_KEYS.has(key)) {
      continue;
    }

    sanitized[key] = sanitizeConfigValue(nestedValue);
  }

  return sanitized;
}

// DEFAULT_CONFIG와 사용자 config를 병합합니다.
// 단순 shallow merge로는 largeDiffThreshold 같은 중첩 기본값 일부가 사라질 수 있어서 재귀 병합합니다.
function mergeDefaults(defaultValue, userValue) {
  // 기본값은 객체가 아닌데 사용자 값만 객체인 경우, 사용자 객체를 보존하되 secret key는 제거합니다.
  if (!isPlainObject(defaultValue) && isPlainObject(userValue)) {
    return sanitizeConfigValue(userValue);
  }

  // 둘 중 하나라도 plain object가 아니면 사용자 값이 있을 때 사용자 값을 우선합니다.
  // 사용자 값이 undefined이면 DEFAULT_CONFIG의 값을 유지합니다.
  if (!isPlainObject(defaultValue) || !isPlainObject(userValue)) {
    return userValue === undefined ? defaultValue : userValue;
  }

  // default object를 먼저 복사해 누락 필드가 기본값으로 남도록 합니다.
  const merged = { ...defaultValue };

  // 사용자 object의 각 필드를 순회하며, secret key는 config에 포함시키지 않습니다.
  for (const [key, value] of Object.entries(userValue)) {
    if (SECRET_CONFIG_KEYS.has(key)) {
      continue;
    }

    merged[key] = mergeDefaults(defaultValue[key], value);
  }

  return merged;
}

// config 객체에서 schema version을 읽습니다.
// 버전 필드가 없는 기존 1차/2차 config는 legacy version 0으로 간주합니다.
export function getConfigVersion(config) {
  if (!isPlainObject(config)) {
    return 0;
  }

  const version = config.configVersion;

  if (version === undefined || version === null) {
    return 0;
  }

  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error("Unsupported config version.");
  }

  return version;
}

// 저장된 config를 현재 DEFAULT_CONFIG schema로 보정합니다.
// 이 함수는 loadConfig/saveConfig 양쪽에서 사용되어 저장 전후 schema가 동일하게 유지되도록 합니다.
export function migrateConfig(config = {}) {
  // config가 객체가 아니면 사용자 값을 신뢰하지 않고 최신 기본값만 반환합니다.
  if (!isPlainObject(config)) {
    return { ...DEFAULT_CONFIG };
  }

  // 현재 config의 schema version을 확인합니다.
  const version = getConfigVersion(config);

  // 미래 버전 config는 현재 CLI가 의미를 알 수 없으므로 임의 downgrade하지 않고 중단합니다.
  if (version > CURRENT_CONFIG_VERSION) {
    throw new Error("Unsupported config version.");
  }

  // 누락 필드는 DEFAULT_CONFIG로 채우고, 사용자 값은 보존하며, 최종 버전은 현재 버전으로 고정합니다.
  return {
    ...mergeDefaults(DEFAULT_CONFIG, config),
    configVersion: CURRENT_CONFIG_VERSION,
  };
}
