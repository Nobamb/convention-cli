# Phase 2 / L Large Diff Commit Message Agent Research

## 1. 개요

Phase L은 Phase H~K에서 준비한 대용량 diff 감지, chunk 분리, chunk 요약, 요약 병합 결과를 사용해 최종 Conventional Commits 메시지를 생성하는 단계입니다. 핵심은 원본 대용량 diff를 최종 commit message prompt에 직접 넣지 않고, 병합된 요약만 사용해 안정적으로 메시지를 생성하는 것입니다.

이 단계는 새로운 Git 작업을 직접 수행하는 기능이 아니라 기존 batch/step commit flow 안에서 AI 메시지 생성 경로를 선택하는 orchestration 계층입니다.

## 2. 작업 목표

- `generateLargeDiffCommitMessage()` 또는 동등한 함수를 정의합니다.
- 일반 diff와 large diff를 감지해 메시지 생성 경로를 분기합니다.
- large diff인 경우 diff를 chunk로 나누고 chunk별 요약을 생성합니다.
- chunk 요약을 병합해 전체 변경 요약을 만듭니다.
- 병합 요약만 사용해 최종 commit message prompt를 생성합니다.
- 기존 preview/confirm/commit decision flow와 연결합니다.
- 원본 대용량 diff, chunk 원문, secret 후보 문자열을 로그에 출력하지 않습니다.

## 3. 구현 범위

- `src/core/ai.js`
  - `generateLargeDiffCommitMessage({ diff, fileDiffs, files, config, mode, language })`
  - provider 호출과 응답 정리 재사용
- `src/core/prompt.js`
  - `buildSummaryCommitPrompt({ summary, language, mode })` 또는 `buildCommitPrompt()` 확장
  - summary 기반 prompt와 raw diff 기반 prompt 구분
- `src/core/diff.js`
  - `detectLargeDiff()`
  - `chunkDiff()`
  - `summarizeDiffChunks()`
  - `mergeChunkSummaries()`
- `src/commands/commit.js`
  - batch/step commit flow에서 large diff routing 연결
  - preview/confirm decision flow에 최종 메시지만 전달

## 4. 권장 함수 흐름

`generateLargeDiffCommitMessage()`는 아래 순서로 동작하는 것이 적합합니다.

```javascript
async function generateLargeDiffCommitMessage({
  diff,
  fileDiffs,
  files,
  config,
  mode,
  language
}) {
  if (!diff || !diff.trim()) {
    throw new Error("변경 diff가 비어 있습니다.");
  }

  const largeDiff = detectLargeDiff({ diff, files, config });

  if (!largeDiff.isLarge) {
    const prompt = buildCommitPrompt({ diff, language, mode });
    return generateCommitMessage(prompt, config);
  }

  const chunks = chunkDiff(fileDiffs, config.largeDiffChunk || {});
  const chunkSummaries = await summarizeDiffChunks({ chunks, config, language });
  const mergedSummary = mergeChunkSummaries(chunkSummaries);
  const prompt = buildSummaryCommitPrompt({ summary: mergedSummary, language, mode });

  return generateCommitMessage(prompt, config);
}
```

일반 diff 경로는 기존 `buildCommitPrompt({ diff, language, mode })`와 `generateCommitMessage(prompt, config)`를 그대로 사용합니다. large diff 경로만 summary 기반 prompt를 사용합니다.

`fileDiffs`는 기존 `getFileDiffs(files)` 결과를 사용합니다. 이 입력 형태는 Phase I의 `chunkDiff(fileDiffs, options)` 계약과 맞아야 하며, raw 전체 diff 문자열을 chunking fallback 입력으로 재사용하지 않습니다.

## 5. Large Diff Routing 기준

large diff 판단은 Phase H의 기준을 그대로 사용합니다.

- 문자 수 기준 초과
- 파일 수 기준 초과
- line 수 기준 초과
- config의 `largeDiffThreshold`가 있으면 해당 값을 우선 사용

판단 결과는 내부 routing에만 사용하고, 사용자에게는 "대용량 변경사항을 요약 기반으로 처리합니다" 수준의 짧은 안내만 출력합니다. 원본 diff 크기, 원본 diff 내용, chunk 내용은 출력하지 않습니다.

## 6. Summary 기반 Prompt 기준

최종 commit message prompt는 병합된 summary만 포함해야 합니다.

포함할 내용:

- Conventional Commits 형식 요구
- 허용 type: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- 설정된 `language`
- `mode` 정보
- 병합된 변경 요약
- 커밋 메시지 한 줄만 반환하라는 지시

포함하지 않을 내용:

- 원본 전체 diff
- chunk 원문 diff
- provider 원문 응답 전체
- credentials, token, API Key, private key 후보 문자열

## 7. Commit Flow 연결

batch flow에서는 전체 diff를 대상으로 large diff 여부를 판단합니다. 일반 diff이면 기존 경로를 사용하고, large diff이면 summary 기반 경로로 메시지를 생성합니다.

step flow에서는 파일별 diff가 기준입니다. 파일 하나의 diff가 large diff이면 그 파일 diff만 chunking하고 summary 기반 메시지를 생성합니다. 파일별 diff가 작으면 기존 파일별 prompt 경로를 유지합니다.

최종 결과는 기존 decision flow에 동일하게 전달합니다.

1. AI commit message 생성
2. AI 응답 정리
3. preview 출력
4. 사용자 decision 또는 confirm
5. Commit 선택 시에만 `git add`
6. Commit 선택 시에만 `git commit`

large diff 경로가 사용되어도 사용자 승인 전 Git 히스토리를 변경하지 않습니다.

## 8. Provider 실패 처리

chunk summary 생성 중 일부 provider 호출이 실패하면 자동으로 raw diff 기반 최종 prompt로 fallback하지 않습니다. raw diff fallback은 large diff와 secret 노출 위험을 다시 만들 수 있습니다.

권장 처리:

- chunk summary 실패 시 제한된 횟수만 재시도합니다.
- 재시도 후에도 실패하면 Phase J의 안전한 metadata 기반 fallback summary를 사용할 수 있습니다.
- unsupported provider, 잘못된 provider config, 보안 gate 실패처럼 정책 위반 또는 설정 오류인 경우에는 commit message 생성을 중단합니다.
- 실패 메시지에는 provider 이름, 실패 단계, 재시도 여부만 포함합니다.
- chunk 원문, prompt 원문, provider 응답 원문은 출력하지 않습니다.
- 어떤 실패 케이스에서도 raw diff 기반 provider 호출로 fallback하지 않습니다.

## 9. 보안 및 안정성 기준

- 원본 large diff는 로그, 에러, preview에 출력하지 않습니다.
- chunk 원문도 로그에 출력하지 않습니다.
- summary 생성 전 기존 diff 보안 gate를 통과해야 합니다.
- 민감정보가 감지된 diff는 마스킹 또는 사용자 확인 정책을 먼저 따릅니다.
- summary prompt에도 secret 후보 문자열이 포함되지 않도록 마스킹 결과만 사용합니다.
- 외부 provider 사용 시 사용자 확인 또는 명시 설정 정책 없이 diff/chunk를 전송하지 않습니다.
- provider 실패를 mock provider나 raw diff 전송으로 조용히 fallback하지 않습니다.

## 10. 완료 기준

- large diff는 chunk summary와 merged summary 기반으로 최종 commit message를 생성합니다.
- 일반 diff는 기존 commit message 생성 경로를 유지합니다.
- summary 기반 prompt에는 원본 diff가 포함되지 않습니다.
- batch/step 모두 large diff routing을 사용할 수 있습니다.
- preview/confirm 안전 흐름이 유지됩니다.
- provider 실패, 빈 diff, 빈 summary는 commit으로 이어지지 않습니다.
- 로그와 에러 출력에 원본 large diff 또는 secret 후보 문자열이 노출되지 않습니다.
