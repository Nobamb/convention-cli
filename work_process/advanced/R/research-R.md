# R 단계 연구 문서: Template Schema Agent

## 역할

R 단계는 Template Schema Agent로서 팀별 커밋 메시지 템플릿의 기준 구조를 정의한다. 실제 구현 대상은 `src/templates/schema.js`이며, 이후 S, T, U, V 단계가 템플릿 로드, 검증, 적용, 명령어 처리를 구현할 때 동일한 계약을 사용할 수 있도록 필드와 기본값을 명확히 고정한다.

## 구현 범위

이번 단계에서 계획할 핵심 산출물은 다음과 같다.

- `src/templates/schema.js`에 템플릿 스키마와 기본 템플릿을 정의한다.
- 기본 템플릿은 Conventional Commits 형식을 따른다.
- 템플릿 필드는 `name`, `language`, `format`, `types`, `rules.maxLength`, `rules.requireScope`, `rules.allowEmoji`를 반드시 포함한다.
- 템플릿 구조는 이후 validator와 prompt 적용 로직에서 재사용할 수 있도록 순수 데이터와 최소 helper 중심으로 설계한다.

## 기본 템플릿 구조

기본 템플릿은 다음 구조를 기준으로 한다.

```js
export const DEFAULT_TEMPLATE = {
  name: "default",
  language: "ko",
  format: "{type}: {message}",
  types: ["feat", "fix", "refactor", "docs", "style", "test", "chore"],
  rules: {
    maxLength: 72,
    requireScope: false,
    allowEmoji: false
  }
};
```

## 필드 정의

### `name`

- 템플릿 식별자이다.
- 기본값은 `"default"`로 둔다.
- 빈 문자열은 허용하지 않는다.
- 파일명이나 사용자 입력으로 확장될 수 있으므로 로그에는 원문 외의 민감 데이터가 섞이지 않도록 주의한다.

### `language`

- 커밋 메시지 생성 언어를 나타낸다.
- 기본값은 `"ko"`이다.
- 기존 CLI 언어 정책과 맞춰 `ko`, `en`, `jp`, `cn`만 허용하는 방향이 적절하다.
- 템플릿 언어는 prompt 생성 시 config의 language와 충돌할 수 있으므로, 이후 적용 단계에서는 우선순위를 명확히 정해야 한다.

### `format`

- 커밋 메시지 출력 형식을 나타낸다.
- 기본값은 `"{type}: {message}"`이다.
- 최소 placeholder로 `{type}`과 `{message}`를 지원한다.
- `rules.requireScope`가 `true`일 때는 `"{type}({scope}): {message}"` 형식을 허용할 수 있도록 `{scope}` placeholder를 선택적으로 지원한다.
- format은 shell 명령 문자열에 직접 삽입하지 않고, 최종 commit 단계에서도 기존 규칙대로 argv 배열 방식에만 전달되어야 한다.

### `types`

- 허용되는 Conventional Commits type 목록이다.
- 기본값은 `["feat", "fix", "refactor", "docs", "style", "test", "chore"]`이다.
- 빈 배열은 허용하지 않는다.
- 각 type은 공백이 없는 소문자 문자열로 제한한다.
- 지원하지 않는 type을 조용히 보정하지 말고 validator 단계에서 명확한 오류 또는 기본 템플릿 fallback 대상으로 처리한다.

### `rules.maxLength`

- 커밋 메시지 제목의 권장 최대 길이이다.
- 기본값은 `72`이다.
- 양의 정수만 허용한다.
- 너무 작은 값은 정상적인 Conventional Commits 메시지 생성을 방해하므로 최소값을 validator에서 정해야 한다.

### `rules.requireScope`

- scope 필수 여부를 나타낸다.
- 기본값은 `false`이다.
- `true`일 경우 이후 prompt 적용 단계에서 AI가 `type(scope): message` 형식을 만들도록 지시해야 한다.
- R 단계에서는 스키마만 정의하고 scope 추론이나 강제 적용 로직은 U 단계에서 처리한다.

### `rules.allowEmoji`

- 커밋 메시지에 emoji 허용 여부를 나타낸다.
- 기본값은 `false`이다.
- `false`일 경우 prompt와 validator는 emoji가 없는 커밋 메시지를 기준으로 동작해야 한다.
- 보안과 직접 관련된 필드는 아니지만, 출력 일관성을 위해 기본값은 보수적으로 둔다.

## 권장 export 계약

`src/templates/schema.js`는 다음 export를 제공하는 방향으로 계획한다.

```js
export const TEMPLATE_SCHEMA_VERSION = 1;
export const TEMPLATE_REQUIRED_FIELDS = ["name", "language", "format", "types", "rules"];
export const TEMPLATE_RULE_REQUIRED_FIELDS = ["maxLength", "requireScope", "allowEmoji"];
export const DEFAULT_TEMPLATE = { ... };
```

필요하면 이후 T 단계에서 `validateTemplate(template)`이 이 상수들을 참조한다. R 단계에서는 validator 구현을 직접 포함하지 않고, 스키마와 기본 템플릿의 계약만 안정적으로 제공한다.

## 보안 규칙

- 템플릿 스키마 정의 과정에서 API Key, OAuth Token, Secret, credentials 내용을 읽거나 출력하지 않는다.
- 템플릿 관련 로그에는 원본 diff를 출력하지 않는다.
- 템플릿 schema/default template 구현은 외부 AI API 또는 외부 네트워크 호출을 수행하지 않는다.
- 템플릿 파일 검증 실패 시에도 파일 전체 내용이나 민감할 수 있는 사용자 입력을 그대로 로그에 남기지 않는다.
- Git 히스토리를 변경하는 commit, push, reset 동작은 R 단계 범위가 아니며 수행하지 않는다.

## 다음 단계 연계

- S 단계는 이 스키마를 기준으로 프로젝트 또는 사용자 템플릿을 로드한다.
- T 단계는 필수 필드, type 목록, language, format, rules 값을 검증한다.
- U 단계는 prompt 생성 시 `format`, `types`, `language`, `rules`를 반영한다.
- V 단계는 `convention --template` 계열 명령에서 이 기본 템플릿을 생성하거나 표시할 수 있다.
