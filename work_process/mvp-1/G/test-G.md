# Phase G (설정 파일 읽기 구현) 검증 테스트 가이드

`research-G.md`에서 도출된 작업 계획을 바탕으로, 설정 파일 읽기 기능(Phase G)이 성공적으로 구현되었는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| **V-1** | `loadConfig()` export 확인 | `src/config/store.js` 코드 확인 | `loadConfig()` 함수가 export 되어 다른 모듈에서 import 가능함. |
| **V-2** | 기본값 import 확인 | `DEFAULT_CONFIG` import 여부 확인 | 설정 파일이 없거나 깨졌을 때 반환할 기본값을 사용할 수 있음. |
| **V-3** | 설정 파일 경로 재사용 확인 | `CONFIG_FILE_PATH` 사용 여부 확인 | Phase F에서 정의한 설정 파일 경로를 중복 선언하지 않고 재사용함. |
| **V-4** | 파일 원문 로그 출력 금지 | 에러 처리 코드 확인 | parse 실패나 읽기 실패 시 config 파일 원문을 출력하지 않음. |

## 2. 기능 테스트 항목

### T-1: 설정 파일이 없는 경우
- **준비:** 격리된 테스트 환경에서 `config.json`이 없는 상태를 만든다.
- **실행:** `loadConfig()` 호출
- **예상 결과:** `DEFAULT_CONFIG`와 동일한 설정 객체를 반환한다.

### T-2: 정상 JSON 설정 파일이 있는 경우
- **준비:** 테스트용 `config.json`에 아래와 같은 값을 저장한다.
  ```json
  {
    "mode": "batch",
    "language": "en"
  }
  ```
- **실행:** `loadConfig()` 호출
- **예상 결과:** `mode`는 `batch`, `language`는 `en`으로 로드된다.

### T-3: 깨진 JSON 설정 파일이 있는 경우
- **준비:** 테스트용 `config.json`에 `{ "mode": "batch"`처럼 깨진 JSON을 저장한다.
- **실행:** `loadConfig()` 호출
- **예상 결과:** 예외로 프로그램이 종료되지 않고 `DEFAULT_CONFIG` 기반 설정을 반환한다.

### T-4: 일부 필드만 저장된 경우
- **준비:** 테스트용 `config.json`에 `{ "language": "jp" }`만 저장한다.
- **실행:** `loadConfig()` 호출
- **예상 결과:** `language`는 `jp`이고, 누락된 `mode`, `provider`, `authType`, `modelVersion`, `baseURL`, `modelDisplayName`, `confirmBeforeCommit`은 기본값으로 보완된다.

### T-5: 1차 MVP 기본 필드 유지 확인
- **실행:** 어떤 케이스에서든 `loadConfig()` 반환 객체의 key 목록 확인
- **예상 결과:** 아래 필드가 모두 존재한다.
  - `mode`
  - `language`
  - `provider`
  - `authType`
  - `modelDisplayName`
  - `modelVersion`
  - `baseURL`
  - `confirmBeforeCommit`

## 3. 테스트 환경 주의사항
- 실제 사용자 홈의 `~/.config/convention/config.json`을 직접 훼손하지 않습니다.
- 테스트는 임시 디렉터리나 mock 처리된 설정 경로를 사용합니다.
- `.env`, `credentials.json`, private key 등 민감 파일은 테스트 입력으로 사용하지 않습니다.
- 설정 파일 내용 전체를 테스트 로그에 출력하지 않습니다.

## 4. 검증 결과 요약
- **모든 항목 통과 시:** Phase G 완료 및 Phase H(설정 파일 쓰기 구현) 진입 가능.
- **실패 항목 존재 시:** `loadConfig()`의 파일 존재 확인, JSON parse, 기본값 병합, fallback 처리 로직을 수정하고 재테스트 진행.
