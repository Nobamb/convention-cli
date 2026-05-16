# Phase 2 / H Large Diff Detector Agent Research

## 1. 개요

Phase H는 3차 고도화 Phase 2의 첫 단계로, 일반 AI 커밋 메시지 생성 흐름에 들어가기 전에 diff 규모를 측정해 대용량 diff 처리 흐름으로 전환할지 판단한다. 이 단계는 diff를 분할하거나 요약하지 않고, 안전한 판정 결과만 반환한다.

핵심 함수는 `detectLargeDiff()`이며, 문자 수, 파일 수, 라인 수를 기준으로 diff 크기를 평가한다. 반환값은 이후 I~L 단계가 일반 AI flow 대신 large diff flow를 선택할 수 있을 만큼 명확한 구조를 가져야 한다.

## 2. 작업 목표

- 전체 diff 문자 수를 계산한다.
- 변경 파일 수를 계산한다.
- diff 라인 수를 계산한다.
- config의 기본 임계값과 사용자 override를 병합해 사용한다.
- 하나 이상의 임계값을 초과하면 large diff로 판정한다.
- 일반 AI flow가 `isLarge` 값을 보고 large diff flow로 전환할 수 있는 반환 구조를 정의한다.
- diff 원문, secret, API key, token, credentials 내용은 로그에 출력하지 않는다.
- 기존 보안 gate와 충돌하지 않고, 민감정보 검사 및 마스킹 이후에도 사용할 수 있게 설계한다.

## 3. 구현 대상

- `src/core/diff.js`
  - `detectLargeDiff({ diff, files, config })`
  - 필요하면 내부 helper로 `countDiffLines(diff)`, `resolveLargeDiffThreshold(config)`를 둘 수 있다.
- `src/config/defaults.js`
  - `DEFAULT_CONFIG.largeDiffThreshold`
  - 기본값:

```json
{
  "largeDiffThreshold": {
    "maxCharacters": 30000,
    "maxFiles": 30,
    "maxLines": 1200
  }
}
```

- `src/commands/commit.js`
  - 일반 batch/step AI 호출 전에 판정 결과를 확인한다.
  - `isLarge === true`이면 이후 Phase I~L에서 구현할 large diff flow로 넘길 수 있는 분기점을 둔다.

## 4. 권장 함수 계약

```javascript
function detectLargeDiff({ diff = "", files = [], config = {} }) {
  return {
    isLarge: false,
    reason: null,
    reasons: [],
    metrics: {
      characters: 0,
      files: 0,
      lines: 0
    },
    threshold: {
      maxCharacters: 30000,
      maxFiles: 30,
      maxLines: 1200
    },
    flow: "normal"
  };
}
```

`reason`은 대표 사유를 담고, `reasons`는 여러 기준이 동시에 초과될 때 모두 담는다.

예시:

```javascript
{
  isLarge: true,
  reason: "characters",
  reasons: ["characters", "lines"],
  metrics: {
    characters: 45000,
    files: 12,
    lines: 1600
  },
  threshold: {
    maxCharacters: 30000,
    maxFiles: 30,
    maxLines: 1200
  },
  flow: "large-diff"
}
```

## 5. 판정 기준

- `characters > maxCharacters`이면 large diff로 판정한다.
- `files > maxFiles`이면 large diff로 판정한다.
- `lines > maxLines`이면 large diff로 판정한다.
- 임계값과 같은 값은 초과가 아니므로 normal flow로 둔다.
- 빈 diff는 large diff가 아니며 `metrics`만 0 기준으로 반환한다.
- `files`가 없으면 파일 수는 0으로 계산한다.
- `diff`가 문자열이 아니면 빈 문자열로 다루거나 명확한 validation error를 낸다. 구현 시 기존 validator 패턴을 우선한다.

## 6. Config 병합 기준

`DEFAULT_CONFIG.largeDiffThreshold`를 기준으로 사용하고, 사용자 config에 같은 key가 있으면 해당 값만 override한다.

예시:

```javascript
const threshold = {
  ...DEFAULT_CONFIG.largeDiffThreshold,
  ...(config.largeDiffThreshold || {})
};
```

단, `maxCharacters`, `maxFiles`, `maxLines`는 양의 정수여야 한다. 잘못된 값은 조용히 mock fallback하지 말고 기본값으로 보정하거나 명확한 설정 오류로 중단한다. 기존 config validation 정책이 있으면 그 방식을 따른다.

## 7. Commit Flow 연결

권장 흐름:

1. Git diff 추출
2. 민감 파일 제외
3. 민감정보 패턴 탐지
4. 필요 시 마스킹
5. `detectLargeDiff()` 실행
6. `result.flow === "large-diff"`이면 large diff flow로 전환
7. 아니면 기존 prompt 생성 및 일반 AI 호출

Phase H는 large diff flow의 실제 chunking이나 summary를 구현하지 않는다. 다만 이후 단계가 연결할 수 있도록 분기 결과와 metrics를 안정적으로 제공한다.

## 8. 보안 기준

- diff 원문을 로그로 출력하지 않는다.
- secret, token, API key, credentials 파일 내용을 출력하지 않는다.
- large diff 판정 로그가 필요하면 `metrics`와 `reasons`만 출력한다.
- 민감정보 탐지 전의 원본 diff를 외부 AI API로 보내지 않는다.
- large diff 판정은 보안 gate를 우회하는 근거가 될 수 없다.
- chunking 단계로 넘어갈 때도 원본 diff 출력 금지 원칙을 유지한다.

## 9. 완료 기준

- `detectLargeDiff()`가 문자 수, 파일 수, 라인 수를 모두 계산한다.
- 기본 임계값과 config override가 적용된다.
- 반환 구조가 normal flow와 large diff flow 전환에 충분하다.
- 빈 diff와 경계값이 안정적으로 처리된다.
- diff 원문 및 secret이 로그에 출력되지 않는다.
- 기존 commit confirm, provider routing, 보안 gate 규칙을 깨지 않는다.
