# Phase 2 / K Summary Merge Agent Research

## 1. 개요

Phase K는 Phase J에서 생성한 chunk별 요약 목록을 하나의 최종 변경 요약으로 병합하는 단계입니다. 최종 결과는 원본 diff가 아니라 정리된 summary 문자열이어야 하며, 이후 large diff commit prompt에 안전하게 전달될 수 있어야 합니다.

이 단계의 핵심 함수는 `mergeChunkSummaries()`입니다. 입력은 chunk summary 목록이고, 출력은 commit prompt에 넣을 수 있는 최종 summary string입니다.

## 2. 작업 목표

- chunk summary 목록을 입력받아 빈 항목과 잘못된 항목을 안전하게 제외합니다.
- 서로 겹치는 요약을 중복 제거합니다.
- 같은 파일 또는 같은 함수/기능 의도에 속하는 요약을 묶어 병합합니다.
- 입력 순서를 기반으로 안정적인 출력 순서를 유지합니다.
- 최종 summary 크기를 제한해 다음 AI prompt가 과도하게 커지지 않도록 합니다.
- 원본 diff, secret, chunk 전문을 로그로 출력하지 않습니다.
- 최종 문자열은 commit message 생성 prompt에 바로 삽입 가능한 형태여야 합니다.

## 3. 구현 범위

- `src/core/diff.js`
  - `mergeChunkSummaries(chunkSummaries, options?)`
  - summary 정규화, 중복 제거, 그룹 병합, 크기 제한
- `src/core/prompt.js`
  - summary 기반 commit prompt와 연결 가능한 입력 형식 검토
- `src/core/ai.js`
  - large diff commit message 생성 단계에서 raw diff 대신 merged summary 사용 여부 확인

## 4. 입력 계약

`mergeChunkSummaries()`는 문자열 배열과 객체 배열을 모두 허용하는 방향이 안전합니다. Phase J의 구현이 조금 달라도 K 단계가 깨지지 않도록 정규화 계층을 둡니다.

권장 입력 예시는 아래와 같습니다.

```javascript
[
  {
    index: 1,
    file: "src/auth/login.js",
    functionName: "login",
    intent: "feat",
    summary: "로그인 성공 후 세션 저장 흐름을 추가함"
  },
  {
    index: 2,
    file: "src/auth/login.js",
    functionName: "login",
    intent: "feat",
    summary: "로그인 성공 시 세션 저장 로직을 추가함"
  }
]
```

문자열만 들어온 경우에는 `summary`로 간주하고, 파일과 함수 정보가 없으면 `general` 그룹으로 병합합니다.

## 5. 출력 계약

반환값은 문자열입니다. commit prompt에 들어가야 하므로 원본 diff 형식, patch header, 코드 블록을 포함하지 않는 요약 텍스트를 권장합니다.

권장 출력 형식:

```text
전체 변경 요약:
- src/auth/login.js / login / feat: 로그인 성공 후 세션 저장 흐름을 추가함
- src/config/store.js / config / refactor: 설정 저장 경로 처리를 공통 함수로 정리함
```

출력은 아래 조건을 만족해야 합니다.

- 빈 입력이면 빈 문자열 또는 "변경 요약 없음"처럼 명시적인 안전 문자열을 반환합니다.
- 같은 의미의 요약은 한 번만 나타납니다.
- 같은 파일/함수/intent 그룹은 하나의 bullet로 병합됩니다.
- 출력 순서는 최초 등장 순서를 기준으로 안정적입니다.
- `maxCharacters` 옵션을 초과하면 뒤쪽 항목을 요약하거나 잘라내고, 잘림 표시를 남깁니다.

## 6. 중복 제거 기준

중복 제거는 지나치게 공격적이면 중요한 변경이 사라질 수 있으므로 보수적으로 적용합니다.

- 앞뒤 공백, 연속 공백, bullet prefix, 마침표 차이는 제거하고 비교합니다.
- 완전히 같은 정규화 문자열은 중복으로 제거합니다.
- 같은 파일, 같은 함수, 같은 intent에서 summary가 매우 유사하면 하나만 유지합니다.
- 서로 다른 파일의 같은 표현은 기본적으로 별도 유지합니다.
- secret masking 결과인 `[REDACTED]` 포함 문장은 병합하되 원문 복원을 시도하지 않습니다.

## 7. 그룹 병합 기준

그룹 키는 아래 우선순위로 만듭니다.

1. `file + functionName + intent`
2. `file + intent`
3. `functionName + intent`
4. `intent`
5. `general`

같은 그룹 안에서는 여러 summary를 하나의 자연스러운 문장 또는 세미콜론 구분 요약으로 합칩니다. 다만 문장이 길어질 경우 핵심 intent를 유지하고 세부 표현은 줄입니다.

## 8. 보안 및 안정성 기준

- raw diff, patch line, 코드 전문을 로그로 출력하지 않습니다.
- `.env`, private key, token 등 민감 diff가 summary에 섞일 수 있으므로 secret 패턴은 최종 문자열에서도 마스킹해야 합니다.
- malformed entry가 있어도 전체 merge가 실패하지 않게 해당 항목만 제외하거나 안전하게 문자열화합니다.
- provider 실패나 빈 summary 목록을 commit 가능 상태로 오인하지 않도록 호출부에서 빈 summary 처리 정책을 명확히 둡니다.
- fallback으로 raw diff를 prompt에 다시 넣지 않습니다.

## 9. 권장 구현 방향

처리 순서는 아래가 적합합니다.

1. 입력 배열 여부 확인
2. entry 정규화
3. 빈 summary 제거
4. secret 패턴 마스킹
5. 중복 summary 제거
6. 파일/함수/intent 기준 그룹 생성
7. 그룹별 summary 병합
8. 안정적인 순서로 final summary 문자열 생성
9. 크기 제한 적용

권장 함수 형태:

```javascript
export function mergeChunkSummaries(chunkSummaries, options = {}) {
  const {
    maxCharacters = 12000,
    emptyMessage = "변경 요약 없음"
  } = options;

  // normalize -> dedupe -> group -> render -> limit
}
```

## 10. 완료 기준

- `mergeChunkSummaries()`가 chunk summary 목록을 최종 summary 문자열로 병합합니다.
- 중복 요약이 제거되고 같은 파일/함수 의도는 그룹화됩니다.
- 출력 순서가 입력 순서 기준으로 안정적입니다.
- 빈 입력과 malformed entry를 안전하게 처리합니다.
- 출력 크기 제한이 적용됩니다.
- 최종 summary는 raw diff 없이 large diff commit prompt에 사용할 수 있습니다.
