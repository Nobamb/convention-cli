# Phase 2 / H Large Diff Detector Agent Test

`research-H.md` 기준으로 `detectLargeDiff()`가 diff 규모를 안전하게 판정하고, 일반 AI flow에서 large diff flow로 전환할 수 있는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| H-V-1 | 기본 임계값 정의 | `src/config/defaults.js` 확인 | `largeDiffThreshold.maxCharacters`, `maxFiles`, `maxLines` 기본값이 존재한다. |
| H-V-2 | 판정 함수 존재 | `src/core/diff.js` 확인 | `detectLargeDiff()`가 export된다. |
| H-V-3 | 반환 구조 | 함수 반환값 확인 | `isLarge`, `reason`, `reasons`, `metrics`, `threshold`, `flow`를 포함한다. |
| H-V-4 | 로그 안전성 | logger 호출부 확인 | diff 원문, secret, token, API key를 출력하지 않는다. |
| H-V-5 | commit flow 분기점 | `src/commands/commit.js` 확인 | 일반 AI 호출 전에 large diff 판정 결과를 확인할 수 있다. |

## 2. 기능 테스트 항목

### H-T-1: 문자 수 임계값 미만

- **준비:** `maxCharacters`보다 1자 작은 diff를 만든다.
- **실행:** `detectLargeDiff({ diff, files, config })`를 호출한다.
- **예상 결과:** `isLarge`는 `false`, `flow`는 `normal`이다.

### H-T-2: 문자 수 임계값 동일

- **준비:** `maxCharacters`와 정확히 같은 길이의 diff를 만든다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** 동일 값은 초과가 아니므로 `isLarge`는 `false`이다.

### H-T-3: 문자 수 임계값 초과

- **준비:** `maxCharacters`보다 1자 큰 diff를 만든다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** `isLarge`는 `true`, `reasons`에 `characters`가 포함되고 `flow`는 `large-diff`이다.

### H-T-4: 파일 수 임계값 경계

- **준비:** 파일 목록을 `maxFiles`, `maxFiles + 1` 개수로 각각 만든다.
- **실행:** 각 입력으로 `detectLargeDiff()`를 호출한다.
- **예상 결과:** `maxFiles`에서는 normal, `maxFiles + 1`에서는 large diff로 판정된다.

### H-T-5: 라인 수 임계값 경계

- **준비:** diff 라인 수를 `maxLines`, `maxLines + 1`로 각각 만든다.
- **실행:** 각 입력으로 `detectLargeDiff()`를 호출한다.
- **예상 결과:** `maxLines`에서는 normal, `maxLines + 1`에서는 `reasons`에 `lines`가 포함된다.

### H-T-6: 여러 기준 동시 초과

- **준비:** 문자 수와 라인 수가 모두 임계값을 넘는 diff를 만든다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** `isLarge`는 `true`이고 `reasons`에 `characters`, `lines`가 모두 포함된다. `reason`은 대표 사유 하나를 담는다.

### H-T-7: config override 적용

- **준비:** 기본값보다 낮은 `largeDiffThreshold`를 config에 넣는다.
- **실행:** 기본값으로는 normal인 diff를 override 기준으로 판정한다.
- **예상 결과:** override 기준을 초과하면 large diff로 판정된다.

### H-T-8: config 일부 override 적용

- **준비:** `maxCharacters`만 override하고 `maxFiles`, `maxLines`는 생략한다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** `maxCharacters`는 override 값, 나머지는 기본값을 사용한다.

### H-T-9: 잘못된 config 값

- **준비:** `maxCharacters: -1`, `maxFiles: "30"` 같은 잘못된 값을 넣는다.
- **실행:** `detectLargeDiff()` 또는 config validator를 호출한다.
- **예상 결과:** 기존 정책에 맞게 기본값으로 보정하거나 명확한 설정 오류를 반환한다. 조용히 mock fallback하지 않는다.

### H-T-10: 빈 diff

- **준비:** `diff: ""`, `files: []`를 전달한다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** `metrics.characters`, `metrics.files`, `metrics.lines`는 0이고 `isLarge`는 `false`이다.

### H-T-11: 민감정보 포함 diff 로그 금지

- **준비:** diff 문자열에 `API_KEY=`, `TOKEN=`, `PASSWORD=` 패턴을 포함한다.
- **실행:** logger를 spy 처리한 뒤 large diff 판정을 실행한다.
- **예상 결과:** logger 출력에는 diff 원문과 secret 값이 포함되지 않고, 필요한 경우 `metrics`와 `reasons`만 출력된다.

### H-T-12: 보안 gate 이후 판정 호환

- **준비:** 민감 파일 제외 및 마스킹이 끝난 diff를 입력으로 사용한다.
- **실행:** `detectLargeDiff()`를 호출한다.
- **예상 결과:** 마스킹된 diff 기준으로 metrics를 계산하며, 보안 gate 순서를 우회하지 않는다.

### H-T-13: 일반 AI flow 유지

- **준비:** 모든 기준 이하의 diff를 만든다.
- **실행:** commit flow에서 large diff 판정 뒤 prompt 생성 및 일반 AI 호출까지 진행한다.
- **예상 결과:** `flow`가 `normal`이므로 기존 prompt 생성과 provider routing이 유지된다.

### H-T-14: large diff flow 전환

- **준비:** 하나 이상의 기준을 초과하는 diff를 만든다.
- **실행:** commit flow에서 large diff 판정 결과를 확인한다.
- **예상 결과:** 일반 AI 호출 전에 `large-diff` 분기로 전환된다. Phase I~L 구현 전에는 명확한 안내 또는 TODO 분기만 있어도 된다.

## 3. 테스트 절차

1. 단위 테스트는 실제 사용자 저장소가 아닌 격리된 fixture나 임시 Git 저장소에서 실행한다.
2. Git 히스토리를 변경하는 commit, push, reset은 수행하지 않는다.
3. diff 원문 검증이 필요할 때도 테스트 실패 메시지에 secret 원문이 노출되지 않게 한다.
4. logger spy를 사용해 출력 내용을 검증하되 credentials 파일이나 `.env` 내용을 읽어 출력하지 않는다.
5. 기존 `npm test`와 large diff 단위 테스트를 함께 실행해 1차, 2차 MVP flow가 깨지지 않는지 확인한다.

## 4. 검증 결과 요약 기준

- **모든 항목 통과:** Phase H는 large diff flow 전환을 위한 안전한 판정 단계로 완료된다.
- **실패 항목 존재:** threshold 경계값, config 병합, 로그 안전성, commit flow 분기 순서 중 실패 원인을 우선 수정한다.
