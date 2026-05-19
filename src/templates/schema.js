// 템플릿 schema 버전은 이후 migration이나 validator가 계약 변경 여부를 판단할 수 있도록 숫자로 고정합니다.
export const TEMPLATE_SCHEMA_VERSION = 1;

// 최상위 필수 필드는 Template Load/Validation 단계가 같은 기준을 공유하도록 별도 상수로 둡니다.
export const TEMPLATE_REQUIRED_FIELDS = [
  "name",
  "language",
  "format",
  "types",
  "rules",
];

// rules 하위 필드는 누락되기 쉬우므로 최상위 필드와 분리해 validator가 명확히 재사용할 수 있게 합니다.
export const TEMPLATE_RULE_REQUIRED_FIELDS = [
  "maxLength",
  "requireScope",
  "allowEmoji",
];

// 기존 CLI language 정책과 맞추기 위해 템플릿에서 허용할 언어 목록도 schema 계층에 노출합니다.
export const TEMPLATE_SUPPORTED_LANGUAGES = ["ko", "en", "jp", "cn"];

// Conventional Commits의 기본 type 집합입니다. prompt와 validator가 같은 순서를 쓰도록 schema에서 기준을 제공합니다.
export const TEMPLATE_DEFAULT_TYPES = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
];

// 기본 템플릿은 사용자 설정이 없을 때 쓰는 기준값입니다.
// Object.freeze를 사용해 테스트나 후속 로직이 전역 기본값을 실수로 바꾸는 상황을 막습니다.
// name은 템플릿 식별자이며, 기본 제공 템플릿임을 명확히 하기 위해 "default"로 둡니다.
export const DEFAULT_TEMPLATE = Object.freeze({
  name: "default",
  // 기본 언어는 프로젝트의 기존 DEFAULT_CONFIG.language와 같은 한국어입니다.
  language: "ko",
  // scope는 기본 필수가 아니므로 가장 단순한 Conventional Commits 제목 형식을 사용합니다.
  format: "{type}: {message}",
  // 배열도 freeze하여 type 목록 자체가 전역 상태로 mutate되지 않게 합니다.
  types: Object.freeze([...TEMPLATE_DEFAULT_TYPES]),
  // rules 객체도 freeze하여 중첩 객체 변경으로 테스트 간 상태가 새는 문제를 방지합니다.
  rules: Object.freeze({
    // 72자는 일반적인 commit subject 권장 길이이며, 이후 validator가 양의 정수 여부를 검사합니다.
    maxLength: 72,
    // scope 추론은 후속 적용 단계의 책임이므로 기본 schema에서는 필수로 강제하지 않습니다.
    requireScope: false,
    // 팀 컨벤션의 일관성을 위해 emoji는 기본적으로 허용하지 않습니다.
    allowEmoji: false,
  }),
});

/**
 * 호출자가 기본 템플릿을 수정해도 전역 DEFAULT_TEMPLATE에 영향이 없도록
 * 얕은 필드와 중첩 rules/types를 함께 복사합니다.
 * @returns {object}
 */
//
export function createDefaultTemplate() {
  // 깊은 복사를 통해 전역 DEFAULT_TEMPLATE에 영향이 없도록 합니다.
  return {
    ...DEFAULT_TEMPLATE,
    types: [...DEFAULT_TEMPLATE.types],
    rules: {
      ...DEFAULT_TEMPLATE.rules,
    },
  };
}
