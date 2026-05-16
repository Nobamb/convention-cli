# Phase 2 / K Summary Merge Agent Test

`research-K.md` 기준으로 chunk별 summary 목록이 중복 제거, 그룹화, 정렬, 크기 제한을 거쳐 commit prompt에 적합한 최종 summary 문자열로 병합되는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| K-V-1 | merge 함수 존재 | `src/core/diff.js` 확인 | `mergeChunkSummaries()` 또는 동등한 함수가 export된다. |
| K-V-2 | raw diff 미사용 | 구현부 확인 | 최종 merge 단계가 raw diff를 다시 읽거나 로그로 출력하지 않는다. |
| K-V-3 | summary 기반 prompt 연결 | `src/core/prompt.js` 또는 large diff flow 확인 | large diff commit prompt에 merged summary를 전달할 수 있다. |
| K-V-4 | 안전한 빈 입력 처리 | 구현부 확인 | 빈 배열, null, undefined가 예외 없이 처리된다. |
| K-V-5 | 크기 제한 옵션 | 구현부 확인 | `maxCharacters` 또는 동등한 제한 정책이 있다. |

## 2. 기능 테스트 항목

### K-T-1: 중복 summary 제거

- **준비:** 같은 파일과 intent를 가진 동일 summary 두 개를 입력한다.
- **실행:** `mergeChunkSummaries()`를 호출한다.
- **예상 결과:** 최종 summary에는 해당 변경이 한 번만 포함된다.

### K-T-2: 표현만 다른 유사 중복 제거

- **준비:** `로그인 성공 후 세션 저장 흐름을 추가함`과 `로그인 성공 시 세션 저장 로직을 추가함`처럼 같은 파일/함수/intent의 유사 summary를 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 같은 그룹 안에서 하나의 변경 의도로 병합되고 불필요하게 두 bullet로 반복되지 않는다.

### K-T-3: 파일 기준 그룹화

- **준비:** `src/auth/login.js` 관련 summary 2개와 `src/config/store.js` 관련 summary 1개를 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 파일별로 구분된 bullet 또는 섹션이 생성된다.

### K-T-4: 함수 또는 기능 의도 기준 그룹화

- **준비:** 같은 파일 안의 `login`, `logout` 함수 summary와 같은 `feat` intent summary를 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 함수명이 있으면 함수별로 구분되고, 함수명이 없으면 intent 기준으로 안전하게 묶인다.

### K-T-5: 안정적인 출력 순서

- **준비:** index가 1, 2, 3인 summary를 서로 다른 파일로 입력한다.
- **실행:** 같은 입력을 여러 번 merge한다.
- **예상 결과:** 출력 순서가 매번 동일하며 최초 등장 순서를 따른다.

### K-T-6: 빈 summary 목록

- **준비:** 빈 배열을 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 예외가 발생하지 않고 빈 문자열 또는 `변경 요약 없음` 같은 명시적 문자열을 반환한다.

### K-T-7: 공백 summary 제거

- **준비:** `""`, `"   "`, 정상 summary가 섞인 배열을 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 공백 summary는 제외되고 정상 summary만 출력된다.

### K-T-8: 큰 summary 크기 제한

- **준비:** `maxCharacters`를 작게 설정하고 긴 summary 여러 개를 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 반환 문자열 길이가 제한을 넘지 않거나, 제한 정책에 맞게 잘림 표시와 함께 축약된다.

### K-T-9: malformed entry 처리

- **준비:** `null`, 숫자, summary 필드가 없는 객체, 문자열 entry, 정상 객체를 섞어 입력한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 잘못된 항목 때문에 전체 함수가 실패하지 않고, 사용할 수 있는 summary만 병합된다.

### K-T-10: commit prompt 적합성

- **준비:** 여러 chunk summary를 merge한 결과를 summary 기반 commit prompt builder에 전달한다.
- **실행:** large diff commit message prompt 생성을 수행한다.
- **예상 결과:** prompt에는 최종 summary가 포함되고 raw diff marker(`diff --git`, `@@`, `+`, `-`) 중심의 원본 diff가 포함되지 않는다.

### K-T-11: 민감정보 마스킹 유지

- **준비:** summary에 `API_KEY=abc`, `TOKEN=secret`, `-----BEGIN PRIVATE KEY-----` 같은 패턴을 포함한다.
- **실행:** merge를 수행한다.
- **예상 결과:** 최종 summary에는 secret 원문이 남지 않고 `[REDACTED]` 또는 동등한 마스킹 문자열이 포함된다.

## 3. 테스트 절차

1. `mergeChunkSummaries()`는 순수 함수 단위 테스트로 먼저 검증한다.
2. 중복 제거, 그룹화, 크기 제한은 서로 독립된 fixture로 나눈다.
3. malformed entry와 빈 입력은 실패 케이스가 아니라 안전 처리 케이스로 검증한다.
4. large diff commit prompt 연결 테스트에서는 raw diff가 재삽입되지 않는지 문자열 포함 여부로 확인한다.
5. secret 패턴은 실제 secret이 아닌 테스트용 더미 문자열만 사용한다.

## 4. 회귀 확인 항목

- Phase H large diff detection 결과와 독립적으로 동작한다.
- Phase I chunk index와 file metadata가 있어도 없어도 merge가 가능하다.
- Phase J summary 실패 항목이 일부 있어도 전체 commit flow가 즉시 깨지지 않는다.
- Phase L은 raw diff 대신 K의 merged summary를 입력으로 사용할 수 있다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** large diff chunk summary가 최종 commit prompt용 summary로 안전하게 병합됨.
- **실패 항목 존재 시:** 중복 제거 범위, 그룹 key 생성, 크기 제한, raw diff 재삽입 여부를 우선 수정한다.
