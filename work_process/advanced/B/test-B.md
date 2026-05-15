# Phase B Config Versioning Agent Test

`research-B.md` 기준으로 config schema versioning과 migration이 기존 설정을 보존하면서 3차 기본 필드를 보정하는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| B-V-1 | 최신 configVersion 정의 | `src/config/defaults.js` 확인 | `DEFAULT_CONFIG`에 `configVersion`이 포함되어 있다. |
| B-V-2 | migration 모듈 존재 | `src/config/migration.js` 확인 | `migrateConfig()`가 export되어 있다. |
| B-V-3 | loadConfig 연결 | `src/config/store.js` 확인 | `loadConfig()`가 저장된 config를 반환하기 전에 migration을 적용한다. |
| B-V-4 | credentials 분리 | config 관련 파일 확인 | API Key나 token migration 로직이 config migration에 섞여 있지 않다. |

## 2. 기능 테스트 항목

### B-T-1: config 파일이 없을 때 최신 기본값 반환

- **준비:** 격리된 HOME 또는 임시 config 경로에 config 파일이 없는 상태를 만든다.
- **실행:** `loadConfig()`를 호출한다.
- **예상 결과:** `configVersion`과 3차 기본 필드를 포함한 `DEFAULT_CONFIG`가 반환된다.

### B-T-2: 2차 MVP config migration

- **준비:** `mode`, `language`, `provider`, `authType`, `modelVersion`, `baseURL`만 포함된 구버전 config를 만든다.
- **실행:** `loadConfig()` 또는 `migrateConfig()`를 호출한다.
- **예상 결과:** 기존 값은 보존되고 `configVersion`, `previewBeforeCommit`, `maxRegenerateCount` 같은 새 필드가 추가된다.

### B-T-3: 누락 필드 보정

- **준비:** 일부 필드만 있는 config를 만든다.
- **실행:** migration을 적용한다.
- **예상 결과:** 누락된 필드는 기본값으로 채워지고 사용자가 저장한 필드는 유지된다.

### B-T-4: 깨진 JSON 처리

- **준비:** config 파일에 잘못된 JSON을 저장한다.
- **실행:** `loadConfig()`를 호출한다.
- **예상 결과:** 안전한 에러 또는 기본값 fallback 정책이 동작하며 config 원문이 로그에 출력되지 않는다.

### B-T-5: 미래 버전 config 처리

- **준비:** 현재보다 높은 `configVersion`이 있는 config를 만든다.
- **실행:** migration을 적용한다.
- **예상 결과:** 임의 downgrade 없이 명확한 에러 또는 안전한 중단이 발생한다.

## 3. 테스트 절차

1. config 저장 위치를 임시 HOME으로 격리한다.
2. 각 config fixture를 생성한 뒤 `loadConfig()`와 `migrateConfig()`를 검증한다.
3. stderr/stdout에 config 원문, API Key, token이 출력되지 않는지 확인한다.
4. `npm test`에 포함할 단위 테스트로 고정한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 3차 config schema 확장 준비가 완료됨.
- **실패 항목 존재 시:** migration 병합 기준, 버전 처리, 로그 출력 정책을 먼저 수정한다.

