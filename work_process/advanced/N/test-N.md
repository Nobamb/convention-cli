# Phase 3 / N Diff Intent Analyzer Agent Test

`research-N.md` 기준으로 파일별 diff intent 분석이 안전하게 동작하고, provider 실패나 보안 gate 실패 시 raw diff를 노출하지 않는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| N-V-1 | grouping intent 함수 존재 | `src/core/grouping.js` 확인 | `analyzeDiffIntent()`, `analyzeDiffIntents()`, `inferIntentByRules()` 또는 동등 함수가 있다. |
| N-V-2 | intent prompt 함수 존재 | `src/core/prompt.js` 확인 | `buildDiffIntentPrompt()` 또는 동등 함수가 있다. |
| N-V-3 | provider routing 재사용 | `src/core/ai.js` 및 provider 호출부 확인 | provider 직접 분기 대신 기존 routing 계약을 사용한다. |
| N-V-4 | raw diff logging 금지 | logger/error 호출부 확인 | diff, prompt 전문, provider 응답 전문을 출력하지 않는다. |
| N-V-5 | 허용 intent 제한 | parser/normalizer 확인 | `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`만 반환한다. |
| N-V-6 | 보안 gate 반영 | AI 호출 전 처리 확인 | 민감 파일 제외, secret 탐지, 마스킹, 외부 전송 정책 확인이 AI 호출보다 앞선다. |

## 2. 기능 테스트 항목

### N-T-1: source 파일의 신규 기능 diff 분석

- **준비:** `src/auth/login.js`에 신규 함수와 export가 추가된 파일별 diff를 mock으로 준비한다.
- **실행:** `analyzeDiffIntent({ file, diff, classification: { fileType: "source" } })`를 호출한다.
- **예상 결과:** `intent`는 `feat`, `summary`는 변경 목적 요약, `file`은 입력 파일 경로와 동일하다.

### N-T-2: test 파일 diff 분석

- **준비:** `tests/login.test.js` diff와 `classification.fileType = "test"`를 준비한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** AI 호출 여부와 무관하게 `intent`는 `test` 후보로 정규화된다.

### N-T-3: docs 파일 diff 분석

- **준비:** `README.md` 또는 `docs/model.md` diff와 `classification.fileType = "docs"`를 준비한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** `intent`는 `docs`이고 summary는 문서 변경 목적만 포함한다.

### N-T-4: config/dependency diff fallback

- **준비:** `package.json`, `package-lock.json`, `.github/workflows/test.yml` diff를 준비한다.
- **실행:** AI 비활성 설정으로 rule fallback을 실행한다.
- **예상 결과:** dependency/config 변경은 기본적으로 `chore`로 분류된다.

### N-T-5: bug fix 신호 감지

- **준비:** diff에 `fix`, `bug`, `error`, `exception`, `regression` 같은 수정 신호가 포함되도록 한다.
- **실행:** rule fallback을 실행한다.
- **예상 결과:** `classification.fileType`이 docs/test/style이 아닌 경우 `intent`는 `fix`로 추정된다.

### N-T-6: AI JSON 응답 parsing

- **준비:** provider 응답을 `{ "intent": "refactor", "summary": "인증 흐름을 분리", "confidence": "medium" }`로 mock한다.
- **실행:** AI 기반 intent 분석을 실행한다.
- **예상 결과:** JSON 응답이 parsing되어 `source: "ai"` 결과로 반환된다.

### N-T-7: AI 응답이 비 JSON인 경우

- **준비:** provider가 markdown, code fence, 설명 문장 등 JSON이 아닌 응답을 반환하도록 mock한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** provider 응답 전문을 출력하지 않고 rule fallback 결과를 반환하거나 명확한 parsing 실패로 처리한다.

### N-T-8: 허용되지 않는 intent 정규화

- **준비:** provider 응답이 `perf`, `build`, `ci` 같은 허용되지 않은 intent를 반환하도록 mock한다.
- **실행:** normalizer를 실행한다.
- **예상 결과:** 허용 intent 중 가장 가까운 값으로 보정하거나 rule fallback intent를 사용한다.

### N-T-9: 빈 diff 처리

- **준비:** diff가 빈 문자열 또는 공백 문자열인 입력을 준비한다.
- **실행:** `analyzeDiffIntent()`를 호출한다.
- **예상 결과:** provider 호출 없이 안전하게 실패하며 git 작업은 발생하지 않는다.

### N-T-10: 민감 파일 제외

- **준비:** `.env`, `credentials.json`, `id_rsa`, `private.key` 파일 diff를 준비한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** AI provider 호출 전 중단되거나 제외 처리되며 raw diff가 출력되지 않는다.

### N-T-11: secret 패턴 감지

- **준비:** diff에 `API_KEY=SECRET_SENTINEL`, `PASSWORD=SECRET_SENTINEL`, `-----BEGIN PRIVATE KEY-----`를 포함한다.
- **실행:** 보안 gate를 통과하는 intent 분석 경로를 실행한다.
- **예상 결과:** secret이 마스킹되거나 AI 호출이 중단되며 stdout, stderr, logger 인자에 `SECRET_SENTINEL`이 없다.

### N-T-12: 외부 provider 전송 정책 없음

- **준비:** provider를 `gemini` 또는 `openaiCompatible`로 설정하고 외부 전송 확인 정책이 없는 상태를 mock한다.
- **실행:** AI 기반 intent 분석을 실행한다.
- **예상 결과:** diff 전송 없이 명확한 오류로 중단하며 mock provider로 조용히 fallback하지 않는다.

### N-T-13: provider 실패 fallback

- **준비:** provider 호출이 일시적 네트워크 오류 또는 빈 응답으로 실패하도록 mock한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** raw diff fallback provider 호출은 하지 않고, 정책상 허용되는 경우 rule fallback 결과를 반환한다.

### N-T-14: unsupported provider 처리

- **준비:** config provider를 지원하지 않는 값으로 설정한다.
- **실행:** intent 분석을 실행한다.
- **예상 결과:** mock으로 fallback하지 않고 명확한 provider 오류로 중단한다.

### N-T-15: 여러 파일 intent 분석

- **준비:** source, test, docs, config 파일 diff 배열을 준비한다.
- **실행:** `analyzeDiffIntents({ fileDiffs, classifications })`를 호출한다.
- **예상 결과:** 각 파일별 결과 배열을 반환하고, 한 파일의 fallback이 다른 파일 결과를 오염시키지 않는다.

### N-T-16: 결과에 raw diff 미포함

- **준비:** diff에 `RAW_DIFF_SENTINEL` 문자열을 넣는다.
- **실행:** intent 분석 결과를 확인한다.
- **예상 결과:** 반환 객체의 `summary`, `intent`, `confidence`, `source` 어느 곳에도 `RAW_DIFF_SENTINEL`이 포함되지 않는다.

### N-T-17: Phase O 연계 가능성

- **준비:** N 단계 결과 배열을 Phase O grouping 입력 형태로 전달한다.
- **실행:** grouping 후보 생성 함수를 mock 또는 실제 함수로 호출한다.
- **예상 결과:** `file`, `intent`, `summary` metadata만으로 group 후보를 만들 수 있다.

## 3. 통합 검증 절차

1. `src/core/grouping.js`의 intent 분석 함수와 rule fallback을 단위 테스트한다.
2. `src/core/prompt.js`의 intent prompt가 commit message 생성을 요구하지 않는지 확인한다.
3. provider 호출은 mock 처리하고 외부 네트워크를 사용하지 않는다.
4. secret sentinel을 포함한 diff로 stdout, stderr, logger spy를 검증한다.
5. 실제 Git 히스토리를 변경하는 테스트는 수행하지 않는다.
6. 기존 회귀 테스트인 `npm test`를 함께 실행한다.

## 4. 검증 결과 요약 기준

- **모든 항목 통과:** 파일별 diff intent metadata가 생성되고, Phase O grouping 입력으로 사용할 수 있다.
- **실패 항목 존재:** raw diff 노출, 보안 gate 우회, unsupported provider fallback, git 작업 호출 여부를 우선 수정한다.
