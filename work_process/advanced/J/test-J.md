# Phase 2 / J Chunk Summary Agent Test

`research-J.md` 기준으로 diff chunk 배열이 안전한 chunk summary 배열로 변환되고, 실패와 보안 조건이 올바르게 처리되는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| J-V-1 | summary 함수 존재 | `src/core/diff.js` 확인 | `summarizeDiffChunks()` 또는 동등한 함수가 존재한다. |
| J-V-2 | chunk summary prompt 존재 | `src/core/prompt.js` 확인 | `buildChunkSummaryPrompt()` 또는 동등한 함수가 존재한다. |
| J-V-3 | commit message 생성 분리 | 호출 관계 확인 | chunk summary 단계에서 `generateCommitMessage()`나 최종 commit prompt 생성이 실행되지 않는다. |
| J-V-4 | provider routing 사용 | AI 호출부 확인 | provider 구현을 직접 호출하지 않고 `generateWithProvider()` 등 routing 함수를 사용한다. |
| J-V-5 | raw diff 로그 금지 | logger 호출 확인 | diff 원문, secret, provider 응답 원문 전체를 출력하지 않는다. |

## 2. 기능 테스트 항목

### J-T-1: prompt 내용 검증

- **준비:** 파일명과 diff를 가진 chunk 1개를 만든다.
- **실행:** chunk summary prompt를 생성한다.
- **예상 결과:** 변경 목적 요약, 설정 언어, 커밋 메시지 생성 금지, diff 원문 반복 금지, secret redaction 지시가 포함된다.

### J-T-2: chunk별 provider 호출

- **준비:** chunk 3개와 provider mock을 준비한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 각 chunk마다 provider routing이 1회씩 호출되고, 결과 배열은 입력 chunk 순서를 유지한다.

### J-T-3: 요약 결과 저장 구조

- **준비:** provider가 각 chunk에 대해 정상 요약을 반환하도록 mock한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 각 결과에 `index`, `files`, `summary`, `status`, `attempts`가 포함되고 `status`는 `success`다.

### J-T-4: retry limit

- **준비:** 첫 번째 chunk provider 호출이 계속 실패하도록 mock하고 `maxRetries`를 2로 설정한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 최초 시도 포함 최대 3회까지만 호출하고 더 이상 재시도하지 않는다.

### J-T-5: retry 후 성공

- **준비:** provider가 첫 호출에서는 실패하고 두 번째 호출에서 정상 요약을 반환하도록 mock한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 결과 `status`는 `success`, `attempts`는 2이며 fallback이 사용되지 않는다.

### J-T-6: fallback summary

- **준비:** provider가 모든 재시도에서 실패하도록 mock한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 해당 chunk 결과는 `status: "fallback"`이고, summary는 diff 원문을 포함하지 않는 안전한 fallback 문장이다.

### J-T-7: 빈 chunk 배열

- **준비:** `chunks: []`를 입력한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** provider 호출 없이 빈 배열을 반환한다.

### J-T-8: provider failure

- **준비:** unsupported provider 또는 잘못된 provider config를 설정한다.
- **실행:** `summarizeDiffChunks()`를 실행한다.
- **예상 결과:** 조용히 mock으로 fallback하지 않고 명확한 오류 또는 실패 상태를 반환한다.

### J-T-9: no commit message generation

- **준비:** commit message 생성 함수와 최종 commit prompt 생성 함수를 spy 처리한다.
- **실행:** chunk summary flow를 실행한다.
- **예상 결과:** chunk summary 전용 prompt와 provider 호출만 실행되고 commit message 생성 함수는 호출되지 않는다.

### J-T-10: security/logging

- **준비:** chunk diff에 `API_KEY=`, `TOKEN=`, `PASSWORD=`, `-----BEGIN PRIVATE KEY-----` 패턴을 포함한다.
- **실행:** summary flow를 실행하고 stdout/stderr/logger 출력을 캡처한다.
- **예상 결과:** 로그에 raw diff나 secret 값이 출력되지 않으며, 필요한 출력은 chunk index/status 수준으로 제한된다.

## 3. 테스트 절차

1. provider 호출은 mock으로 고정해 외부 네트워크를 사용하지 않는다.
2. chunk 배열은 Phase I 반환 구조와 같은 metadata를 사용한다.
3. 성공, retry 성공, retry 초과 fallback, provider 설정 실패를 별도 케이스로 나눈다.
4. commit message 생성 함수는 spy로 감시해 이 단계에서 호출되지 않음을 검증한다.
5. stdout/stderr와 logger mock을 확인해 diff 원문과 secret 노출이 없는지 검증한다.
6. 기존 `npm test`를 함께 실행해 Phase C~I commit flow와 large diff 흐름 회귀를 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Phase 2 large diff flow에서 각 chunk가 안전한 요약 단위로 변환됨.
- **실패 항목 존재 시:** prompt 금지 조건, provider routing, retry/fallback 상태 저장, raw diff logging 차단을 우선 수정한다.
