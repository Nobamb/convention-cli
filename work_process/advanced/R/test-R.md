# R 단계 테스트 문서: Template Schema 검증 항목

## 테스트 목표

R 단계 테스트의 목적은 `src/templates/schema.js`와 기본 템플릿 구조가 이후 로드, 검증, 적용 단계에서 일관되게 사용할 수 있는 계약을 제공하는지 확인하는 것이다. 이 단계에서는 외부 API 호출, 실제 Git commit, 실제 reset, 실제 push를 수행하지 않는다.

## 기본 구조 검증

- `src/templates/schema.js`가 ESM `export` 문법을 사용한다.
- `DEFAULT_TEMPLATE`이 객체로 export된다.
- `TEMPLATE_SCHEMA_VERSION`이 숫자로 export된다.
- `DEFAULT_TEMPLATE.name`이 `"default"`이다.
- `DEFAULT_TEMPLATE.language`가 `"ko"`이다.
- `DEFAULT_TEMPLATE.format`이 `"{type}: {message}"`이다.
- `DEFAULT_TEMPLATE.types`가 배열이다.
- `DEFAULT_TEMPLATE.rules`가 객체이다.

## 필수 필드 검증

- 템플릿 최상위 필드에 `name`이 존재한다.
- 템플릿 최상위 필드에 `language`가 존재한다.
- 템플릿 최상위 필드에 `format`이 존재한다.
- 템플릿 최상위 필드에 `types`가 존재한다.
- 템플릿 최상위 필드에 `rules`가 존재한다.
- `rules.maxLength`가 존재한다.
- `rules.requireScope`가 존재한다.
- `rules.allowEmoji`가 존재한다.

## 기본값 검증

- `rules.maxLength` 기본값이 `72`이다.
- `rules.requireScope` 기본값이 `false`이다.
- `rules.allowEmoji` 기본값이 `false`이다.
- `types` 기본값에 `feat`가 포함된다.
- `types` 기본값에 `fix`가 포함된다.
- `types` 기본값에 `refactor`가 포함된다.
- `types` 기본값에 `docs`가 포함된다.
- `types` 기본값에 `style`가 포함된다.
- `types` 기본값에 `test`가 포함된다.
- `types` 기본값에 `chore`가 포함된다.

## 타입 검증

- `name`은 문자열이어야 한다.
- `language`는 문자열이어야 한다.
- `format`은 문자열이어야 한다.
- `types`는 문자열 배열이어야 한다.
- `rules.maxLength`는 양의 정수여야 한다.
- `rules.requireScope`는 boolean이어야 한다.
- `rules.allowEmoji`는 boolean이어야 한다.

## 허용값 검증

- `language`는 `ko`, `en`, `jp`, `cn` 중 하나만 허용하는 방향으로 검증한다.
- `types`는 빈 배열이면 실패해야 한다.
- `types`의 각 값은 공백이 없는 소문자 문자열이어야 한다.
- 기본 `types`는 Conventional Commits 허용 type 범위와 일치해야 한다.
- `format`은 최소한 `{type}`과 `{message}` placeholder를 포함해야 한다.
- `rules.requireScope`가 `true`인 템플릿은 `{scope}` placeholder 사용 가능성을 검증 대상에 포함한다.

## 기본 템플릿 불변성 검증

- 테스트 중 `DEFAULT_TEMPLATE.types`를 변경해도 다른 테스트에 영향이 없도록 복사 사용 정책을 확인한다.
- 이후 helper가 추가될 경우 기본 템플릿 원본 객체를 직접 mutate하지 않는지 확인한다.
- 기본 템플릿을 기반으로 사용자 템플릿을 병합할 때 `rules` 하위 필드가 누락되지 않아야 한다.

## 실패 케이스

- `name`이 빈 문자열이면 실패한다.
- `language`가 `kr`처럼 지원하지 않는 값이면 실패한다.
- `format`에 `{type}`이 없으면 실패한다.
- `format`에 `{message}`가 없으면 실패한다.
- `types`가 배열이 아니면 실패한다.
- `types`가 빈 배열이면 실패한다.
- `rules.maxLength`가 `0`, 음수, 문자열, `null`이면 실패한다.
- `rules.requireScope`가 boolean이 아니면 실패한다.
- `rules.allowEmoji`가 boolean이 아니면 실패한다.
- `rules` 객체 전체가 없으면 실패한다.

## 보안 검증

- 테스트는 API Key, OAuth Token, Secret, credentials 내용을 출력하지 않아야 한다.
- 테스트 실패 메시지는 템플릿 전체 원문을 그대로 출력하지 않아야 한다.
- 테스트는 원본 diff를 읽거나 로그로 출력하지 않아야 한다.
- 테스트는 외부 AI API 또는 외부 네트워크를 호출하지 않아야 한다.
- 테스트는 실제 사용자 Git 히스토리를 변경하지 않아야 한다.
- 테스트는 `git commit`, `git push`, `git reset`을 실행하지 않아야 한다.

## 권장 테스트 방식

- Node.js ESM 기반 단위 테스트로 `src/templates/schema.js`를 import한다.
- 외부 네트워크 mock은 필요하지 않다. R 단계 테스트는 네트워크를 사용하지 않는 것이 정상이기 때문이다.
- 실제 사용자 저장소의 Git 상태에 의존하지 않는다.
- 테스트용 데이터는 코드 내부 fixture 객체로만 구성한다.

## 완료 기준

- 기본 템플릿이 모든 필수 필드를 가진다.
- 기본 템플릿의 field type과 기본값이 문서화된 계약과 일치한다.
- schema export가 이후 Template Load, Validation, Apply, Command 단계에서 재사용 가능한 형태이다.
- 보안 규칙 위반 가능성이 없다.
