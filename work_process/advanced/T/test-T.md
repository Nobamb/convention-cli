# T. Template Validation Agent 테스트 계획

## 테스트 목표

`validateTemplate()`과 template loader 경계가 잘못된 템플릿을 안전하게 처리하는지 검증한다. 특히 invalid template 또는 malformed JSON이 있어도 CLI가 죽지 않고 기본 템플릿으로 fallback되어야 한다.

## 테스트 대상

- `src/templates/validator.js`
  - `validateTemplate(template)`
- loader 경계 테스트 후보
  - `src/templates/loader.js`
  - `loadTemplate()`
- 기본 템플릿 상수 후보
  - `src/templates/schema.js`
  - `src/config/defaults.js`

## 단위 테스트 항목

### 1. 정상 템플릿

입력:

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

기대 결과:

- `valid`가 `true`
- 반환 template이 입력 template을 유지
- `errors`가 빈 배열
- fallback이 발생하지 않음

### 2. 필수 필드 누락

케이스:

- `name` 누락
- `language` 누락
- `format` 누락
- `types` 누락
- `rules` 누락
- `rules.maxLength` 누락
- `rules.requireScope` 누락
- `rules.allowEmoji` 누락

기대 결과:

- `valid`가 `false`
- 반환 template이 기본 템플릿
- errors에는 필드명 중심의 메시지만 포함
- raw template 전체가 출력되지 않음
- CLI flow가 throw 없이 계속 진행 가능

### 3. `types` 배열 검증

유효 케이스:

- `["feat"]`
- `["feat", "fix", "docs"]`
- 중복이 포함된 `["feat", "feat", "fix"]`

무효 케이스:

- `"feat"`처럼 배열이 아닌 값
- `[]` 빈 배열
- `[1, "fix"]`처럼 문자열이 아닌 항목 포함
- `["feature"]`처럼 지원하지 않는 type 포함
- `[null]`

기대 결과:

- 유효 케이스는 통과하거나 중복 제거 후 통과
- 무효 케이스는 기본 템플릿으로 fallback
- 잘못된 값 원문을 로그에 출력하지 않음

### 4. `format` 문자열 검증

유효 케이스:

- `"{type}: {message}"`
- `"{type}({scope}): {message}"`

무효 케이스:

- 빈 문자열
- 공백 문자열
- 숫자, 배열, 객체, null
- `"{message}"`처럼 `{type}` 누락
- `"{type}: "`처럼 `{message}` 누락

기대 결과:

- 유효 케이스는 통과
- 무효 케이스는 기본 템플릿으로 fallback
- format 원문 전체를 에러 메시지에 포함하지 않음

### 5. `language` 검증

유효 케이스:

- `ko`
- `en`
- `jp`
- `cn`

무효 케이스:

- `kr`
- `ja`
- `zh`
- 빈 문자열
- null
- 숫자

기대 결과:

- 유효 케이스는 통과
- 무효 케이스는 기본 템플릿으로 fallback
- 기존 `isValidLanguage()` 기준과 충돌하지 않음

### 6. `rules.maxLength` 검증

유효 케이스:

- `20`
- `72`
- `200`

무효 케이스:

- `19`
- `201`
- `0`
- `-1`
- `72.5`
- `"72"`
- `NaN`
- `Infinity`
- null

기대 결과:

- 유효 케이스는 통과
- 무효 케이스는 기본 템플릿으로 fallback
- maxLength 값 원문을 그대로 출력하지 않음

### 7. `rules.requireScope`와 `rules.allowEmoji` 검증

케이스:

- `rules.requireScope`가 boolean
- `rules.allowEmoji`가 boolean
- `rules.requireScope`가 누락된 템플릿
- `rules.allowEmoji`가 누락된 템플릿
- 두 필드가 문자열 또는 숫자인 템플릿

기대 결과:

- boolean 값은 통과
- 누락값은 기본 템플릿으로 fallback
- boolean이 아닌 값은 fallback

## fallback 테스트

### 1. invalid template fallback

입력:

```json
{
  "name": "broken",
  "language": "ko",
  "format": "",
  "types": [],
  "rules": {
    "maxLength": 72
  }
}
```

기대 결과:

- 예외가 throw되지 않음
- 기본 템플릿이 반환됨
- 경고 메시지는 "기본 템플릿 사용" 수준으로 제한
- raw template 내용은 출력하지 않음

### 2. fallback 후 CLI 지속 가능성

검증 흐름:

1. loader가 invalid template을 읽는다.
2. `validateTemplate()`이 invalid 결과와 기본 템플릿을 반환한다.
3. template apply 또는 prompt 생성 단계가 기본 템플릿으로 계속 진행한다.

기대 결과:

- CLI가 validation 실패만으로 종료되지 않음
- commit flow가 기본 템플릿 기준으로 진행 가능

## malformed JSON loader 경계 테스트

### 1. JSON parse 실패

입력 파일 예:

```json
{
  "name": "broken",
  "language": "ko",
```

기대 결과:

- `loadTemplate()`이 JSON parse error를 잡음
- `validateTemplate()`에는 malformed string이 전달되지 않음
- 기본 템플릿으로 fallback
- JSON 원문이 로그에 출력되지 않음
- CLI가 중단되지 않음

### 2. secret 포함 malformed JSON

입력 파일 예:

```json
{
  "name": "broken",
  "format": "TOKEN=abc123
```

기대 결과:

- parse 실패 메시지에 `TOKEN=abc123`이 포함되지 않음
- `[REDACTED]` 또는 일반 경고만 출력
- 기본 템플릿으로 fallback

## secret 및 raw content 비노출 테스트

### 1. template value에 secret 패턴 포함

케이스:

- `name`에 `API_KEY=secret` 포함
- `format`에 `PASSWORD=secret` 포함
- `types`에 `TOKEN=secret` 포함

기대 결과:

- validation 실패 여부와 관계없이 로그에 secret 원문이 출력되지 않음
- errors에는 필드명만 포함
- raw template object를 stringify해서 출력하지 않음

### 2. logger spy 검증

검증 방식:

- `logger.warn`, `logger.error`, `logger.info`를 spy 또는 mock 처리
- invalid template 검증 실행
- 호출 인자에 다음 문자열이 포함되지 않는지 확인

금지 문자열:

- `API_KEY=`
- `SECRET=`
- `TOKEN=`
- `PASSWORD=`
- `PRIVATE_KEY`
- `DATABASE_URL`
- `AWS_ACCESS_KEY_ID`
- `-----BEGIN PRIVATE KEY-----`

## 통합 테스트 후보

### 1. `convention --template validate`

전제:

- Template Command Agent가 구현된 이후 수행

케이스:

- 정상 템플릿 파일
- 필수 필드 누락 템플릿 파일
- malformed JSON 템플릿 파일

기대 결과:

- 정상 템플릿은 성공 메시지
- invalid template은 경고와 fallback 안내
- malformed JSON은 loader 경계 경고와 fallback 안내
- 어떤 경우에도 raw template content와 secret은 출력되지 않음

### 2. `convention --batch`

전제:

- Template Apply Agent가 구현된 이후 수행

케이스:

- `.convention/template.json`이 invalid template
- 사용자 홈 template이 invalid template

기대 결과:

- 기본 템플릿으로 prompt 생성
- commit preview 또는 commit flow가 중단되지 않음
- 실제 commit 테스트는 격리된 Git 저장소에서만 수행

## 실행 시 주의사항

- 실제 사용자 Git 저장소에서 commit, push, reset을 수행하지 않는다.
- 템플릿 테스트 파일은 fixture 또는 임시 디렉터리에 생성한다.
- malformed JSON과 secret 테스트에서도 파일 원문을 콘솔에 출력하지 않는다.
- 외부 네트워크 호출은 발생하지 않아야 한다.
- 테스트 실패 메시지에도 secret 원문이 포함되지 않도록 assertion 메시지를 짧게 유지한다.
