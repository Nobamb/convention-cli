# Phase 2 / L Large Diff Commit Message Agent Test

`research-L.md` 기준으로 대용량 diff가 summary 기반 commit message 생성 경로를 사용하고, 일반 diff는 기존 경로를 유지하며, 원본 large diff가 로그나 preview에 노출되지 않는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| L-V-1 | large diff 메시지 생성 함수 존재 | `src/core/ai.js` 확인 | `generateLargeDiffCommitMessage()` 또는 동등한 orchestration 함수가 있다. |
| L-V-2 | 일반 diff routing | 함수 분기 확인 | large diff가 아니면 기존 `buildCommitPrompt()`와 `generateCommitMessage()` 경로를 사용한다. |
| L-V-3 | large diff pipeline 호출 | 함수 호출 순서 확인 | `detectLargeDiff` -> `chunkDiff` -> `summarizeDiffChunks` -> `mergeChunkSummaries` -> summary prompt -> AI generation 순서가 유지된다. |
| L-V-4 | summary prompt 사용 | prompt 생성부 확인 | 최종 commit prompt가 raw diff가 아니라 merged summary를 입력으로 받는다. |
| L-V-5 | raw diff logging 금지 | logger/error 호출부 확인 | 원본 diff, chunk diff, provider 원문 응답 전체가 출력되지 않는다. |
| L-V-6 | commit safety 유지 | `src/commands/commit.js` 확인 | large diff 경로도 preview/confirm 이후에만 git add/commit을 호출한다. |

## 2. 기능 테스트 항목

### L-T-1: 일반 diff는 기존 경로 사용

- **준비:** threshold보다 작은 diff를 만들고 `detectLargeDiff()`가 `{ isLarge: false, flow: "normal" }`을 반환하도록 mock한다.
- **실행:** `generateLargeDiffCommitMessage()`를 호출한다.
- **예상 결과:** chunking과 summary merge가 호출되지 않고 기존 commit prompt로 AI 메시지를 생성한다.

### L-T-2: large diff는 summary pipeline 사용

- **준비:** threshold를 초과하는 diff를 만들고 `detectLargeDiff()`가 `{ isLarge: true, flow: "large-diff" }`를 반환하도록 mock한다.
- **실행:** `generateLargeDiffCommitMessage()`를 호출한다.
- **예상 결과:** chunking, `summarizeDiffChunks`, `mergeChunkSummaries`, summary prompt 생성, 최종 AI 메시지 생성이 순서대로 호출된다.

### L-T-3: summary prompt에 raw diff가 포함되지 않음

- **준비:** raw diff에 고유 문자열 `RAW_DIFF_SENTINEL`을 넣고 chunk summary에는 `요약된 변경사항`만 반환하도록 mock한다.
- **실행:** 최종 commit message provider 호출 prompt를 캡처한다.
- **예상 결과:** prompt에는 `요약된 변경사항`이 포함되고 `RAW_DIFF_SENTINEL`은 포함되지 않는다.

### L-T-4: 치명적인 chunk summary 실패 시 commit 차단

- **준비:** unsupported provider, 잘못된 provider config, 보안 gate 실패처럼 retry/fallback 대상이 아닌 오류를 mock한다.
- **실행:** large diff 메시지 생성 흐름을 실행한다.
- **예상 결과:** raw diff fallback 없이 에러로 중단하고 git add/commit은 호출되지 않는다.

### L-T-4A: chunk summary fallback은 raw diff를 사용하지 않음

- **준비:** 일부 chunk summary가 재시도 후 `status: "fallback"`인 metadata 기반 summary를 반환하도록 mock한다.
- **실행:** large diff 메시지 생성 흐름을 실행한다.
- **예상 결과:** `mergeChunkSummaries()`는 fallback summary를 병합할 수 있으며, 최종 prompt에는 raw diff 또는 chunk diff가 포함되지 않는다.

### L-T-5: 최종 provider 실패 처리

- **준비:** chunk summary와 merge는 성공시키고 최종 commit message provider만 실패하도록 mock한다.
- **실행:** large diff 메시지 생성 흐름을 실행한다.
- **예상 결과:** 실패 메시지를 출력하고 preview/confirm/commit 단계로 넘어가지 않는다.

### L-T-6: 빈 diff 처리

- **준비:** diff가 빈 문자열 또는 공백뿐인 문자열이 되도록 설정한다.
- **실행:** `generateLargeDiffCommitMessage()`를 호출한다.
- **예상 결과:** provider 호출 없이 안전하게 실패하며 commit이 실행되지 않는다.

### L-T-7: 빈 summary 처리

- **준비:** chunk summary 또는 merged summary가 빈 문자열을 반환하도록 mock한다.
- **실행:** large diff 메시지 생성 흐름을 실행한다.
- **예상 결과:** 최종 commit message 생성을 중단하고 raw diff fallback을 하지 않는다.

### L-T-8: raw diff 로그 노출 방지

- **준비:** raw diff와 chunk diff에 `SECRET_SENTINEL=do-not-print`를 넣고 logger 출력을 spy한다.
- **실행:** large diff 경로를 성공 또는 실패 케이스로 실행한다.
- **예상 결과:** stdout, stderr, logger 호출 인자에 `SECRET_SENTINEL`과 raw diff 내용이 포함되지 않는다.

### L-T-9: batch flow 통합

- **준비:** batch 모드에서 large diff가 감지되도록 mock하고 decision UI는 `commit`을 반환하도록 설정한다.
- **실행:** `convention --batch` 흐름 또는 해당 command 함수를 실행한다.
- **예상 결과:** summary 기반 메시지가 preview에 표시되고 사용자 commit 선택 이후에만 `git add -A`, `git commit -m <message>`가 호출된다.

### L-T-10: step flow 통합

- **준비:** 파일 2개 중 하나만 large diff로 감지되도록 mock한다.
- **실행:** step commit 흐름을 실행한다.
- **예상 결과:** large 파일은 summary 기반 메시지 생성 경로를 사용하고, 작은 파일은 기존 파일별 diff prompt 경로를 사용한다.

### L-T-11: confirm 취소 시 Git 작업 없음

- **준비:** large diff 메시지 생성은 성공시키고 decision UI 또는 confirm을 cancel로 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** preview는 출력되지만 `git add`, `git commit`, `git push`는 호출되지 않는다.

### L-T-12: 외부 provider 전송 정책 유지

- **준비:** 외부 provider 설정에서 사용자 확인 또는 명시 정책이 없는 상태를 mock한다.
- **실행:** large diff 경로를 실행한다.
- **예상 결과:** chunk summary를 포함한 provider 호출 전에 중단되며 diff/chunk가 외부 provider로 전송되지 않는다.

## 3. 테스트 절차

1. `detectLargeDiff`, `chunkDiff`, `summarizeDiffChunks`, `mergeChunkSummaries`, provider 호출을 mock해 routing을 명확히 검증한다.
2. raw diff에는 sentinel 문자열을 넣어 prompt와 logger 노출 여부를 확인한다.
3. Git 작업은 격리 저장소 또는 git wrapper spy로 검증한다.
4. batch와 step을 별도 케이스로 나누어 기존 commit flow 회귀를 확인한다.
5. 실패 케이스에서는 raw diff fallback이 없는지 우선 확인한다.
6. 기존 회귀 테스트인 `npm test`를 함께 실행한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 대용량 diff에서도 summary 기반으로 안정적인 commit message를 생성하고 preview/confirm 안전 흐름이 유지됨.
- **실패 항목 존재 시:** raw diff 노출 여부, provider 실패 처리, commit 호출 조건을 우선 수정한다.
