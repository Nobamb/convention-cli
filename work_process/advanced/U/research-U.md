# U 단계 연구 문서: Template Apply Agent

## 1. 개요

U 단계는 커밋 메시지 생성 prompt에 팀 컨벤션 템플릿 규칙을 반영하는 단계입니다. 템플릿 로드와 검증은 R, S, T 단계의 책임이며, U 단계는 검증이 끝난 템플릿 또는 fallback 기본 템플릿을 `buildCommitPrompt()` 흐름에 적용하는 데 집중합니다.

대상 함수는 `src/core/prompt.js`의 `buildCommitPrompt({ diff, language, mode, template })` 확장 또는 동등한 형태입니다. 템플릿 적용은 AI가 반환해야 할 커밋 메시지의 허용 type, format, language, maxLength를 명확히 지시하는 방식이어야 합니다.

## 2. 작업 목표

- commit prompt 생성 시 template의 `types`를 허용 Conventional Commit type 목록으로 반영합니다.
- template의 `format`을 AI 출력 형식 규칙으로 반영합니다.
- template의 `language`와 config `language`가 충돌할 때 우선순위를 명확히 적용합니다.
- template의 `rules.maxLength`를 커밋 제목 길이 제한으로 반영합니다.
- 검증 실패 템플릿은 prompt 생성 단계에서 CLI를 중단하지 않고 기본 템플릿으로 fallback된 결과를 사용합니다.
- prompt 생성 또는 오류 처리 중 raw diff, secret, credentials 내용을 로그로 출력하지 않습니다.

## 3. 적용 대상

- `src/core/prompt.js`
  - `buildCommitPrompt()`에서 template 규칙을 prompt instruction에 포함
  - 기존 `language`, `mode`, `diff` 인자를 깨지 않는 확장
- `src/templates/loader.js`
  - 이미 검증된 template을 로드하는 흐름과 연결
- `src/templates/validator.js`
  - invalid template fallback 결과를 U 단계에서 신뢰해 사용

U 단계는 템플릿 schema, 탐색 순서, 검증 로직 자체를 새로 정의하지 않습니다. 다만 선행 단계가 없거나 실패했을 때도 기본 템플릿이 적용된 prompt를 만들 수 있어야 합니다.

U 단계는 commit flow의 기존 보안 순서를 바꾸지 않습니다. 템플릿 적용은 민감 파일 제외, 민감정보 탐지와 마스킹, 외부 AI 전송 확인 정책 이후 AI 호출용 prompt를 만드는 과정에만 관여하며, preview, 사용자 confirm, `git add`, `git commit` 순서를 우회하지 않습니다.

## 4. 템플릿 규칙 반영 계획

### 4.1 허용 type

template의 `types` 배열을 prompt에 명시합니다.

예시:

```text
허용되는 커밋 타입은 다음 중 하나만 사용하세요: feat, fix, refactor, docs, test, chore
```

적용 기준:

- `types`가 비어 있거나 유효하지 않으면 기본 허용 type을 사용합니다.
- 기본 허용 type은 기존 규칙과 호환되도록 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`를 유지합니다.
- 지원하지 않는 type을 조용히 포함하지 않습니다. T 단계에서 걸러졌다고 가정하되, U 단계에서도 방어적으로 기본값 fallback을 허용합니다.

### 4.2 format

template의 `format`은 AI가 최종 커밋 메시지를 어떤 문자열 구조로 반환해야 하는지 안내합니다.

예시:

```json
{
  "format": "{type}: {message}"
}
```

prompt 반영 예시:

```text
출력 형식은 반드시 "{type}: {message}"를 따르세요.
{type}에는 허용 type 중 하나를 넣고, {message}에는 변경 목적을 짧게 작성하세요.
```

적용 기준:

- `format`은 커밋 제목 한 줄에 우선 적용합니다.
- `{type}`과 `{message}` placeholder는 최소 지원 단위로 봅니다.
- format에 `{scope}`가 포함되고 `rules.requireScope`가 true이면 scope 작성 규칙을 함께 안내합니다.
- AI 출력은 markdown code block, 설명문, 후보 목록 없이 commit message 문자열만 반환하도록 지시합니다.

### 4.3 language 우선순위

config `language`와 template `language`가 충돌할 때는 template `language`를 우선합니다.

우선순위:

1. 유효한 template `language`
2. 유효한 config `language`
3. 기본값 `ko`

이 우선순위의 이유는 template이 팀 단위 컨벤션을 표현하고, config language는 개인 기본 설정이기 때문입니다. 프로젝트 템플릿이 명시한 언어가 있으면 팀 규칙을 우선해야 여러 사용자가 같은 저장소에서 일관된 커밋 메시지를 만들 수 있습니다.

단, template `language`가 없거나 유효하지 않으면 기존 config `language`를 유지합니다. invalid template 전체가 fallback된 경우에는 fallback template language 또는 config language 정책을 일관되게 적용해야 합니다.

### 4.4 maxLength

template의 `rules.maxLength`는 커밋 제목 최대 길이로 prompt에 반영합니다.

예시:

```text
커밋 제목은 공백 포함 72자를 넘기지 마세요.
```

적용 기준:

- `maxLength`는 양의 정수일 때만 적용합니다.
- 값이 없으면 기본값 72를 권장합니다.
- 너무 작은 값처럼 실사용이 어려운 값은 T 단계에서 검증하거나 fallback해야 합니다.
- U 단계 prompt에는 길이 제한을 명확히 쓰되, 실제 자르기나 후처리는 `cleanAIResponse()` 또는 별도 validator에서 다룹니다.

## 5. 권장 prompt 구성

`buildCommitPrompt()`는 기존 diff 분석 지시 위에 템플릿 규칙 섹션을 추가하는 방식이 안전합니다.

권장 구성:

1. 역할: Git diff를 분석해 Conventional Commit 메시지를 만든다.
2. 언어: 최종 메시지는 resolved language로 작성한다.
3. type: template types 중 하나만 사용한다.
4. format: template format을 반드시 따른다.
5. maxLength: 제목 길이 제한을 지킨다.
6. 출력 제한: 커밋 메시지 한 줄만 출력한다.
7. 보안: diff 원문, secret, credentials를 그대로 반복하지 않는다.
8. 입력: 정제된 diff 또는 summary를 제공한다.

## 6. 보안 기준

- prompt 문자열 자체에는 필요한 diff 또는 summary가 포함될 수 있으나, logger로 prompt 전체를 출력하지 않습니다.
- template 적용 실패 시에도 diff 원문을 오류 메시지에 포함하지 않습니다.
- secret 탐지 또는 masking은 U 단계 이전 보안 gate의 책임이지만, prompt에도 secret 반복 금지 지시를 포함합니다.
- invalid template fallback 경고가 필요하면 파일 경로나 필드명 수준만 출력하고 template 원문 전체와 diff 원문은 출력하지 않습니다.
- 템플릿 적용 실패를 이유로 외부 AI 전송 확인, commit preview, 사용자 confirm을 생략하지 않습니다.

## 7. 완료 기준

- `buildCommitPrompt()` 결과에 template `types`, `format`, resolved `language`, `rules.maxLength`가 반영됩니다.
- template language와 config language가 충돌하면 template language가 우선됩니다.
- template이 없거나 invalid fallback 상태여도 기본 Conventional Commit prompt가 생성됩니다.
- AI가 commit message 외 설명을 출력하지 않도록 prompt가 명확합니다.
- raw diff, secret, credentials가 로그에 출력되지 않는 정책이 유지됩니다.
- 템플릿 적용이 기존 commit flow의 보안 Gate와 사용자 confirm 흐름을 우회하지 않습니다.
