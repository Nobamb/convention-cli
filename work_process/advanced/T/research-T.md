# T. Template Validation Agent 구현 계획

## 작업 목표

Template Validation Agent는 `src/templates/validator.js`의 `validateTemplate()` 구현 기준을 정리한다. 목적은 사용자 또는 프로젝트 템플릿이 잘못되어도 CLI가 중단되지 않고 기본 템플릿으로 안전하게 fallback되도록 하는 것이다.

## 담당 범위

- 대상 함수: `validateTemplate(template)`
- 대상 모듈 후보:
  - `src/templates/validator.js`
  - `src/templates/schema.js`
  - `src/config/defaults.js`
  - `src/utils/validator.js`
- 이 문서는 구현 계획만 다루며 실제 코드 변경은 다음 Agent가 수행한다.

## 입력과 출력

### 입력

`validateTemplate(template)`은 loader가 JSON 파싱에 성공한 plain object를 입력으로 받는다.

예상 템플릿 구조:

```json
{
  "name": "default",
  "language": "ko",
  "format": "{type}: {message}",
  "types": ["feat", "fix", "refactor", "docs", "style", "test", "chore"],
  "rules": {
    "maxLength": 72,
    "requireScope": false,
    "allowEmoji": false
  }
}
```

### 출력

권장 반환 형태:

```js
{
  valid: true,
  template,
  errors: []
}
```

fallback이 필요한 경우:

```js
{
  valid: false,
  template: DEFAULT_TEMPLATE,
  errors: ["template.format must be a non-empty string"]
}
```

CLI 흐름에서는 `valid: false`를 치명적 오류로 취급하지 않고 경고 후 기본 템플릿을 사용한다.

## 검증 기준

### 1. 필수 필드 검증

다음 필드는 반드시 존재해야 한다.

- `name`
- `language`
- `format`
- `types`
- `rules`
- `rules.maxLength`
- `rules.requireScope`
- `rules.allowEmoji`

필수 필드가 누락되면 해당 템플릿은 무효로 판단하고 기본 템플릿으로 fallback한다.

### 2. `types` 배열 검증

`types`는 비어 있지 않은 배열이어야 한다.

허용 type 후보:

- `feat`
- `fix`
- `refactor`
- `docs`
- `style`
- `test`
- `chore`

검증 규칙:

- 배열이 아니면 무효
- 빈 배열이면 무효
- 모든 항목은 문자열이어야 함
- 지원하지 않는 type이 하나라도 있으면 무효
- 중복 type은 제거해 정규화하거나 무효 처리할 수 있으나, 구현 일관성을 위해 중복 제거 후 사용을 권장

### 3. `format` 문자열 검증

`format`은 비어 있지 않은 문자열이어야 한다.

권장 검증 규칙:

- 문자열이 아니면 무효
- trim 결과가 비어 있으면 무효
- `{type}`과 `{message}` placeholder를 반드시 포함해야 함
- `{scope}`는 선택 placeholder로 허용
- format 자체를 로그에 그대로 출력하지 않음

`format`이 잘못되면 AI prompt 또는 commit message 적용 단계에서 예측 불가능한 결과가 생기므로 기본 템플릿으로 fallback한다.

### 4. `language` 검증

`language`는 기존 CLI 설정과 동일한 지원 언어만 허용한다.

허용 값:

- `ko`
- `en`
- `jp`
- `cn`

검증은 `src/utils/validator.js`의 `isValidLanguage(language)`를 재사용하는 방향이 좋다.

### 5. `rules.maxLength` 검증

`rules.maxLength`는 commit subject 최대 길이를 의미한다.

권장 검증 규칙:

- number 타입이어야 함
- 정수여야 함
- 최소값은 `20`
- 최대값은 `200`
- `NaN`, `Infinity`, 문자열 숫자는 허용하지 않음

`maxLength`가 범위를 벗어나면 잘못된 템플릿으로 보고 기본 템플릿으로 fallback한다. CLI가 임의 보정으로 사용자의 실수를 숨기는 것보다 경고 후 기본 템플릿을 사용하는 편이 안전하다.

### 6. `rules.requireScope`와 `rules.allowEmoji` 검증

`rules.requireScope`와 `rules.allowEmoji`는 R 단계 스키마의 필수 필드이므로 반드시 존재해야 하며 boolean이어야 한다.

- 누락 시 템플릿 무효 처리 후 기본 템플릿으로 fallback한다.
- boolean이 아니면 템플릿 무효 처리 후 기본 템플릿으로 fallback한다.
- 임의 보정으로 사용자의 스키마 오류를 숨기지 않는다.

## fallback 정책

Template Validation Agent의 핵심 요구사항은 잘못된 템플릿 때문에 CLI가 죽지 않도록 하는 것이다.

정책:

1. `validateTemplate()`은 validation 실패를 throw하지 않는다.
2. 실패 사유는 raw template 내용 없이 필드명 중심으로만 수집한다.
3. 반환값의 `template`에는 항상 사용할 수 있는 템플릿을 담는다.
4. invalid template이면 `DEFAULT_TEMPLATE`을 반환한다.
5. logger에는 `"템플릿이 유효하지 않아 기본 템플릿을 사용합니다."` 수준의 경고만 출력한다.
6. 템플릿 파일 원문, diff 원문, API Key, token, secret 값은 출력하지 않는다.

## loader 경계와 역할 분리

malformed JSON 처리는 `validateTemplate()`이 아니라 loader 경계에서 처리한다.

권장 흐름:

1. `loadTemplate()`이 템플릿 파일을 읽는다.
2. JSON parse 실패 시 loader가 에러를 잡는다.
3. loader는 원문 내용을 출력하지 않고 기본 템플릿을 반환한다.
4. JSON parse에 성공한 object만 `validateTemplate()`에 전달한다.
5. `validateTemplate()`은 schema 수준 검증만 담당한다.

이렇게 분리하면 JSON 문법 오류와 schema 오류의 책임이 명확해지고, malformed JSON에 포함된 민감 문자열이 로그에 노출될 가능성을 줄일 수 있다.

## 보안 고려사항

- 템플릿 파일 내용 전체를 로그로 출력하지 않는다.
- validation error에는 사용자가 작성한 raw value를 포함하지 않는다.
- `format`, `name`, `types` 값이 악의적 문자열이어도 shell 명령 문자열에 삽입하지 않는다.
- fallback 경고에는 파일 경로와 필드명 정도만 포함한다.
- secret 패턴이 포함된 malformed JSON이나 template value를 테스트해도 원문을 출력하지 않는다.

## 완료 기준

- 필수 필드 누락을 감지한다.
- `types` 배열을 검증한다.
- `format` 문자열과 필수 placeholder를 검증한다.
- `language` 값을 검증한다.
- `rules.maxLength` 값을 검증한다.
- `rules.requireScope`와 `rules.allowEmoji`의 존재 여부와 boolean 타입을 검증한다.
- invalid template에서도 CLI가 중단되지 않고 기본 템플릿으로 fallback한다.
- malformed JSON은 loader 경계에서 처리된다는 테스트 기준이 문서화된다.
- secret 또는 raw template content가 로그와 에러에 노출되지 않는 기준이 포함된다.
