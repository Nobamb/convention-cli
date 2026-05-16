# Phase 2 / J Chunk Summary Agent Research

## 1. 개요

Phase J는 Phase I에서 생성한 diff chunk 배열을 AI가 처리 가능한 단위별 변경 요약으로 변환하는 단계입니다. 이 단계의 책임은 chunk 요약까지만이며, 최종 커밋 메시지 생성은 Phase L에서 수행해야 합니다.

## 2. 작업 목표

- `summarizeDiffChunks()` 흐름을 정의합니다.
- 각 chunk마다 요약 전용 prompt를 생성합니다.
- provider routing을 통해 chunk별 AI 호출을 수행합니다.
- chunk index, file metadata, summary, status, error metadata를 함께 보관합니다.
- 실패한 chunk는 제한된 횟수만 재시도합니다.
- 재시도 후에도 실패하면 fallback summary를 저장합니다.
- 이 단계에서는 Conventional Commit 메시지를 생성하지 않습니다.
- diff 원문, secret, provider 응답 원문 전체를 로그로 출력하지 않습니다.

## 3. 구현 범위

- `src/core/diff.js`
  - `summarizeDiffChunks({ chunks, config, language })`
  - chunk 요약 결과 구조 관리
  - 실패 chunk 재시도 및 fallback 처리
- `src/core/prompt.js`
  - `buildChunkSummaryPrompt({ chunk, language })`
  - 커밋 메시지 금지 조건을 포함한 요약 전용 prompt 생성
- `src/core/ai.js`
  - 기존 provider routing 호출 재사용
  - chunk summary 전용 호출도 commit message cleanup과 섞이지 않게 분리 검토
- `src/providers/index.js`
  - `generateWithProvider({ prompt, config })` 재사용

## 4. 권장 구현 방향

`summarizeDiffChunks()`는 chunk 배열을 입력받아 같은 순서의 summary 배열을 반환하는 순수 orchestration 함수가 적합합니다.

```javascript
async function summarizeDiffChunks({
  chunks,
  config,
  language = "ko",
  maxRetries = 2
}) {
  // validate chunks -> build prompt per chunk -> provider call -> retry -> fallback
}
```

권장 반환 구조는 아래와 같습니다.

```javascript
[
  {
    index: 1,
    files: ["src/auth/login.js"],
    summary: "로그인 인증 흐름의 입력 검증과 에러 처리를 변경함.",
    status: "success",
    attempts: 1
  },
  {
    index: 2,
    files: ["src/pages/LoginPage.jsx"],
    summary: "이 chunk는 요약 생성에 실패했으며 파일명과 chunk metadata만 보존됨.",
    status: "fallback",
    attempts: 3,
    errorType: "provider_error"
  }
]
```

## 5. Chunk Summary Prompt 기준

요약 prompt는 아래 조건을 반드시 포함해야 합니다.

- diff chunk의 변경 목적과 주요 변경 내용을 짧게 요약합니다.
- 설정된 `language`를 반영합니다.
- 커밋 메시지, PR 제목, Conventional Commits 형식을 작성하지 말라고 명시합니다.
- diff 원문을 그대로 반복하거나 긴 코드 조각을 인용하지 말라고 명시합니다.
- 민감정보처럼 보이는 값은 `[REDACTED]`로 표현하라고 명시합니다.
- 출력은 1~3문장 또는 짧은 bullet로 제한합니다.

예시 문구:

```text
다음 diff chunk의 변경 목적과 주요 변경 내용을 한국어로 짧게 요약하세요.
아직 커밋 메시지를 작성하지 마세요.
Conventional Commits 형식의 제목을 만들지 마세요.
diff 원문이나 secret 값을 그대로 반복하지 말고 필요한 경우 [REDACTED]로 표현하세요.
```

## 6. Retry 및 Fallback 기준

- 기본 재시도 횟수는 `maxRetries: 2`로 두고, 최초 시도 포함 최대 3회 호출을 권장합니다.
- retry 대상은 provider timeout, 일시적 네트워크 오류, 빈 응답, 형식 불량 응답입니다.
- unsupported provider, 잘못된 config, 보안 gate 실패는 조용히 retry하지 않고 즉시 실패 처리합니다.
- fallback summary는 diff 내용을 추론하지 않고 chunk metadata 기반의 안전한 문장만 사용합니다.
- 일부 chunk가 fallback이 되어도 전체 summary 배열은 반환하되, 후속 Phase K/L이 fallback 포함 여부를 판단할 수 있게 `status`를 남깁니다.

## 7. 보안 및 안정성 기준

- chunk diff 원문을 logger에 출력하지 않습니다.
- provider 호출 전 기존 민감 파일 제외, 민감정보 탐지, 마스킹 정책이 적용된 chunk만 입력으로 받아야 합니다.
- fallback summary에 diff 일부를 복사하지 않습니다.
- provider 응답 원문 전체를 로그로 출력하지 않습니다.
- 요약 실패를 commit message 생성으로 fallback하지 않습니다.
- 빈 chunk 배열은 AI 호출 없이 빈 배열을 반환합니다.
- chunk 순서는 입력 순서를 유지합니다.

## 8. 완료 기준

- 각 diff chunk가 summary 결과 객체로 변환됩니다.
- chunk별 provider routing AI 호출이 동작합니다.
- 실패 chunk는 제한된 횟수만 재시도됩니다.
- 재시도 실패 시 fallback summary가 저장됩니다.
- 이 단계에서 commit message 생성 함수가 호출되지 않습니다.
- raw diff, secret, credentials가 로그에 노출되지 않습니다.
