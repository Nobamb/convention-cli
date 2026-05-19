# U 단계 테스트 문서: Template Apply Agent

`research-U.md` 기준으로 팀 컨벤션 템플릿 규칙이 commit prompt 생성에 반영되는지 검증합니다. 이 문서는 테스트 설계이며 실제 사용자 저장소에서 commit, push, reset을 실행하지 않습니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| U-V-1 | prompt 함수 확장 | `src/core/prompt.js` 확인 | `buildCommitPrompt()`가 template 또는 resolved template 규칙을 받을 수 있다. |
| U-V-2 | template loader 연결 | 호출 흐름 확인 | commit prompt 생성 전에 template 로드 또는 fallback 결과가 전달된다. |
| U-V-3 | raw diff 로그 금지 | logger 호출 확인 | prompt, diff, secret 원문을 로그로 출력하지 않는다. |
| U-V-4 | invalid fallback 처리 | 예외 처리 확인 | 잘못된 템플릿 때문에 CLI가 즉시 종료되지 않고 기본 템플릿을 사용한다. |
| U-V-5 | 기존 인자 호환 | 기존 호출부 확인 | template이 없어도 기존 `diff`, `language`, `mode` 기반 prompt 생성이 유지된다. |
| U-V-6 | commit flow 우회 금지 | 호출 흐름 확인 | template 적용이 AI 전송 확인, preview, 사용자 confirm, `git add`, `git commit` 순서를 생략하지 않는다. |

## 2. 기능 테스트 항목

### U-T-1: 허용 type 반영

- **준비:** `types: ["feat", "fix", "docs"]`를 가진 template을 준비합니다.
- **실행:** `buildCommitPrompt({ diff, language: "ko", mode: "batch", template })`를 호출합니다.
- **예상 결과:** prompt에 허용 type이 `feat`, `fix`, `docs`로 명시되고, 다른 type을 사용하지 말라는 지시가 포함됩니다.

### U-T-2: 기본 type fallback

- **준비:** `types`가 없거나 빈 배열인 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 기본 허용 type인 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`가 사용됩니다.

### U-T-3: format 반영

- **준비:** `format: "{type}: {message}"`를 가진 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** prompt에 출력 형식이 정확히 포함되고, AI가 commit message 한 줄만 반환해야 한다는 지시가 포함됩니다.

### U-T-4: scope 포함 format

- **준비:** `format: "{type}({scope}): {message}"`, `rules.requireScope: true`를 가진 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** prompt에 scope가 필수라는 지시와 지정 format이 포함됩니다.

### U-T-5: template language 우선

- **준비:** config language는 `ko`, template language는 `en`으로 설정합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 최종 메시지 언어 지시는 영어로 작성하도록 생성되며, template language가 config language보다 우선합니다.

### U-T-6: config language fallback

- **준비:** config language는 `jp`, template language는 없도록 설정합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 최종 메시지 언어 지시는 일본어로 작성하도록 생성됩니다.

### U-T-7: 기본 language fallback

- **준비:** config language와 template language가 모두 없거나 유효하지 않도록 설정합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 기본값 `ko`가 적용됩니다.

### U-T-8: maxLength 반영

- **준비:** `rules.maxLength: 50`을 가진 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** prompt에 커밋 제목을 공백 포함 50자 이하로 작성하라는 지시가 포함됩니다.

### U-T-9: maxLength 기본값

- **준비:** `rules.maxLength`가 없는 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 기본 길이 제한 72자 또는 프로젝트 기본값이 prompt에 반영됩니다.

### U-T-10: invalid template fallback

- **준비:** JSON parse 실패, 잘못된 `types`, 잘못된 `format`, 잘못된 `language`, 잘못된 `maxLength` 사례를 각각 준비합니다.
- **실행:** template 로드와 prompt 생성을 수행합니다.
- **예상 결과:** CLI가 죽지 않고 기본 템플릿 기반 prompt를 생성하며, 오류 메시지에 diff 원문이나 secret이 포함되지 않습니다.

### U-T-11: prompt content 완성도

- **준비:** 정상 template과 작은 mock diff를 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** prompt에는 역할, 언어, 허용 type, format, maxLength, commit message만 반환하라는 지시가 모두 포함됩니다.

### U-T-12: step mode 적용

- **준비:** mode는 `step`, 파일별 diff와 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 파일별 변경을 기준으로 메시지를 만들라는 기존 step mode 지시와 template 규칙이 함께 포함됩니다.

### U-T-13: batch mode 적용

- **준비:** mode는 `batch`, 전체 diff와 template을 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** 전체 변경을 하나의 메시지로 요약하라는 기존 batch mode 지시와 template 규칙이 함께 포함됩니다.

### U-T-14: raw diff 로그 금지

- **준비:** mock diff에 `diff --git`, `@@`, `API_KEY=test-value` 같은 문자열을 포함합니다.
- **실행:** prompt 생성 중 logger 출력을 spy 또는 mock으로 관찰합니다.
- **예상 결과:** logger 출력에는 raw diff, patch line, secret 형태 문자열이 포함되지 않습니다.

### U-T-15: secret 반복 금지 지시

- **준비:** masking된 diff 또는 secret 패턴이 포함된 테스트용 diff를 준비합니다.
- **실행:** prompt를 생성합니다.
- **예상 결과:** prompt에는 secret을 그대로 반복하지 말고 필요한 경우 `[REDACTED]`로 표현하라는 지시가 포함됩니다.

### U-T-16: commit flow 미실행 및 우회 금지

- **준비:** `generateCommitMessage()`, `addAll()`, `addFile()`, `commit()`을 mock 처리합니다.
- **실행:** `buildCommitPrompt({ diff, language: "ko", mode: "batch", template })`를 호출합니다.
- **예상 결과:** prompt 생성만 수행되고 AI 호출, staging, commit은 호출되지 않습니다. 실제 commit flow 통합에서는 기존 보안 Gate와 사용자 confirm 이후에만 `git add`와 `git commit`이 실행됩니다.

## 3. 테스트 절차

1. `buildCommitPrompt()` 단위 테스트를 먼저 작성합니다.
2. 정상 template, template 없음, invalid template fallback fixture를 분리합니다.
3. language 우선순위는 `template.language`, `config.language`, 기본값 순서로 각각 검증합니다.
4. logger mock을 사용해 raw diff와 secret 원문이 출력되지 않는지 확인합니다.
5. 실제 Git commit은 수행하지 않고 prompt 문자열과 호출 흐름만 검증합니다.
6. commit flow 통합 검증은 격리된 테스트 저장소에서만 수행하고, 템플릿 적용이 confirm 단계를 건너뛰지 않는지 확인합니다.

## 4. 통과 기준

- prompt content에 template의 allowed types, format, language, maxLength가 반영됩니다.
- language 충돌 시 template language가 config language보다 우선합니다.
- invalid template은 기본 템플릿으로 fallback됩니다.
- step, batch 기존 prompt 흐름이 깨지지 않습니다.
- raw diff, API Key, token, credentials 원문이 로그에 출력되지 않습니다.
- 템플릿 적용은 AI 호출과 Git commit을 직접 실행하지 않으며 기존 confirm 기반 commit flow를 우회하지 않습니다.
