import { isValidLanguage } from "../utils/validator.js";
import {
  createDefaultTemplate,
  DEFAULT_TEMPLATE,
  TEMPLATE_DEFAULT_TYPES,
  TEMPLATE_REQUIRED_FIELDS,
  TEMPLATE_RULE_REQUIRED_FIELDS,
} from "./schema.js";

// 기본 템플릿 객체를 반환합니다.
export { DEFAULT_TEMPLATE };

// 지원하는 type을 Set으로 만들어 빠른 조회를 지원합니다.
const ALLOWED_TYPES = new Set(TEMPLATE_DEFAULT_TYPES);
// maxLength의 최소값과 최대값을 상수로 정의합니다.
const MIN_MAX_LENGTH = 20;
const MAX_MAX_LENGTH = 200;

/**
 * 기본 템플릿을 깊은 복사하여 반환합니다.
 * @returns {object} 기본 템플릿을 깊은 복사한 객체
 */
function cloneDefaultTemplate() {
  return createDefaultTemplate();
}

/**
 * 객체의 소유 속성을 확인합니다.
 * @param {object} object - 검증할 객체
 * @param {string} key - 확인할 속성명
 * @returns {boolean} - 객체가 속성을 소유하고 있으면 true, 아니면 false
 */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * 필수 필드 누락 오류를 추가합니다.
 * @param {string[]} errors - 오류 목록
 * @param {string} fieldName - 누락된 필드명
 */
function addMissingFieldError(errors, fieldName) {
  errors.push(`${fieldName} is required`);
}

/**
 * 유효하지 않은 템플릿 결과를 반환합니다.
 * @param {string[]} errors - 오류 목록
 * @returns {object} 유효하지 않은 템플릿 결과
 */
function createInvalidResult(errors) {
  return {
    valid: false,
    template: cloneDefaultTemplate(),
    errors,
  };
}

/**
 * 사용자 정의 커밋 템플릿이 CLI에서 안전하게 사용할 수 있는 구조인지 검증합니다.
 *
 * [보안 및 안정성 원칙]
 * - 템플릿이 잘못되어도 예외를 밖으로 던지지 않고 기본 템플릿으로 fallback합니다.
 * - error 메시지는 필드명과 규칙 이름만 담고, 사용자가 작성한 원본 값은 절대 포함하지 않습니다.
 * - 이 함수는 logging을 수행하지 않습니다. 호출자가 경고를 출력하더라도 raw template을 출력하지 않도록 하기 위함입니다.
 * - malformed JSON 처리는 loader 경계의 책임이며, 이 함수는 JSON parse 이후의 plain object schema만 검증합니다.
 */
export function validateTemplate(template) {
  try {
    // 에러 목록
    const errors = [];

    // null, 배열, 문자열처럼 템플릿 객체가 아닌 입력은 이후 필드 접근 전에 안전하게 차단합니다.
    if (
      template === null ||
      typeof template !== "object" ||
      Array.isArray(template)
    ) {
      return createInvalidResult(["template must be an object"]);
    }

    // 필수 top-level 필드가 모두 있는지 먼저 확인해, 부분 템플릿이 뒤 단계로 흘러가지 않게 합니다.
    for (const fieldName of TEMPLATE_REQUIRED_FIELDS) {
      if (!hasOwn(template, fieldName)) {
        addMissingFieldError(errors, fieldName);
      }
    }

    // 이름 검증
    // 이름은 공백을 포함하지 않는 문자열이여야 합니다.
    if (
      typeof template.name !== "string" ||
      template.name.trim().length === 0
    ) {
      errors.push("name must be a non-empty string");
    }

    // 언어 검증
    // 언어는 기존 CLI 설정 검증 기준과 같은 함수를 사용해 지원 언어 목록이 갈라지지 않게 합니다.
    if (!isValidLanguage(template.language)) {
      errors.push("language must be a supported language");
    }

    // format 검증
    // format은 실제 커밋 메시지 조립 규칙이므로 type과 message placeholder가 반드시 있어야 합니다.

    // 만약에 공백을 포함하지 않는 문자열이 아니면 에러를 추가합니다.
    if (
      typeof template.format !== "string" ||
      template.format.trim().length === 0
    ) {
      errors.push("format must be a non-empty string");
    } else {
      // 포맷에 type이 포함되어 있는지 확인합니다.
      // 포함되어있지 않다면 에러를 추가합니다.
      if (!template.format.includes("{type}")) {
        errors.push("format must include {type}");
      }

      // 포맷에 message가 포함되어 있는지 확인합니다.
      // 포함되어있지 않다면 에러를 추가합니다.
      if (!template.format.includes("{message}")) {
        errors.push("format must include {message}");
      }
    }

    // types 검증
    // types는 Conventional Commit type allowlist 역할을 하므로 모든 항목을 엄격하게 확인합니다.
    let normalizedTypes = [];
    // 타입이 배열이 아니면 에러를 추가합니다.
    if (!Array.isArray(template.types)) {
      errors.push("types must be a non-empty array");
    }
    // 타입이 배열이면서 빈 배열이면 에러를 추가합니다.
    else if (template.types.length === 0) {
      errors.push("types must be a non-empty array");
    } else {
      // 중복된 타입이 있는지 확인합니다.
      const uniqueTypes = new Set();

      // template에 있는 모든 type을 순회합니다.
      for (const type of template.types) {
        // 타입이 문자열이 아니면 에러를 추가합니다.
        if (typeof type !== "string") {
          errors.push("types must contain only supported strings");
          break;
        }

        // 타입이 허용된 타입이 아니면 에러를 추가합니다.
        if (!ALLOWED_TYPES.has(type)) {
          errors.push("types must contain only supported commit types");
          break;
        }

        // 중복된 타입이 있으면 제거하고, 없으면 추가합니다.
        uniqueTypes.add(type);
      }

      // 정규화된 타입을 할당합니다.
      normalizedTypes = [...uniqueTypes];
    }

    // rules 객체와 내부 필드는 이후 prompt 적용 단계에서 직접 참조하므로 누락과 타입 오류를 분리해 검사합니다.
    // rules가 객체가 아니면 에러를 추가합니다.
    if (
      template.rules === null ||
      typeof template.rules !== "object" ||
      Array.isArray(template.rules)
    ) {
      errors.push("rules must be an object");
    } else {
      // 규칙에 필수 필드가 있는지 확인합니다.
      for (const fieldName of TEMPLATE_RULE_REQUIRED_FIELDS) {
        // 필드가 존재하지 않으면 에러를 추가합니다.
        if (!hasOwn(template.rules, fieldName)) {
          addMissingFieldError(errors, `rules.${fieldName}`);
        }
      }

      // template.rules.maxLength가 유효한 숫자가 아니면 에러를 추가합니다.
      // 숫자가 아니거나, 정수가 아니거나, 유한수가 아니거나, 최소값보다 작거나, 최대값보다 크면 에러를 추가합니다.
      if (
        typeof template.rules.maxLength !== "number" ||
        !Number.isInteger(template.rules.maxLength) ||
        !Number.isFinite(template.rules.maxLength) ||
        template.rules.maxLength < MIN_MAX_LENGTH ||
        template.rules.maxLength > MAX_MAX_LENGTH
      ) {
        errors.push("rules.maxLength must be an integer between 20 and 200");
      }

      // template.rules.requireScope가 boolean이 아니면 에러를 추가합니다.
      if (typeof template.rules.requireScope !== "boolean") {
        errors.push("rules.requireScope must be a boolean");
      }

      // template.rules.allowEmoji가 boolean이 아니면 에러를 추가합니다.
      if (typeof template.rules.allowEmoji !== "boolean") {
        errors.push("rules.allowEmoji must be a boolean");
      }
    }

    // 에러가 있으면 유효하지 않은 결과를 반환합니다.
    if (errors.length > 0) {
      return createInvalidResult(errors);
    }

    // 유효한 템플릿도 배열과 rules 객체를 복사해 반환하여, 호출자가 결과를 수정해도 원본 입력을 오염시키지 않게 합니다.
    return {
      valid: true,
      template: {
        ...template,
        types: normalizedTypes,
        rules: { ...template.rules },
      },
      errors: [],
    };
  } catch {
    // getter 등 비정상 객체가 들어와도 CLI가 중단되지 않도록 마지막 안전망에서 기본 템플릿으로 fallback합니다.
    return createInvalidResult(["template validation failed"]);
  }
}
