# Phase H 설정 파일 쓰기 검증 Test

`research-H.md`의 구현 기준을 바탕으로, 설정 파일 쓰기 기능이 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `ensureConfigDir()` export 확인 | `src/config/store.js` 코드 확인 | 다른 모듈에서 `ensureConfigDir()`를 import할 수 있다. |
| V-2 | `saveConfig(config)` export 확인 | `src/config/store.js` 코드 확인 | 다른 모듈에서 `saveConfig(config)`를 import할 수 있다. |
| V-3 | 경로 상수 재사용 확인 | `CONFIG_DIR`, `CONFIG_FILE_PATH` 사용 여부 확인 | 저장 함수가 경로 문자열을 직접 조합하지 않는다. |
| V-4 | JSON pretty format 확인 | `JSON.stringify(config, null, 2)` 사용 여부 확인 | 저장된 `config.json`이 들여쓰기 2칸 JSON 형식이다. |
| V-5 | UTF-8 저장 확인 | `writeFileSync` encoding 확인 | 한글 등 비ASCII 설정값이 깨지지 않도록 UTF-8로 저장한다. |

## 2. 기능 테스트 항목

### T-1: config 디렉터리 자동 생성
- **준비:** 격리된 테스트 홈 디렉터리에서 `.config/convention` 폴더가 없는 상태를 만든다.
- **실행:** `ensureConfigDir()` 또는 `saveConfig(DEFAULT_CONFIG)`를 호출한다.
- **예상 결과:** `.config/convention` 디렉터리가 자동 생성된다.

### T-2: config.json 파일 생성
- **준비:** 격리된 테스트 홈 디렉터리에서 설정 디렉터리와 설정 파일이 없는 상태를 만든다.
- **실행:** `saveConfig(DEFAULT_CONFIG)`를 호출한다.
- **예상 결과:** `~/.config/convention/config.json` 위치에 설정 파일이 생성된다.

### T-3: 저장 후 재로드
- **준비:** 테스트 설정 객체를 준비한다.
  ```json
  {
    "mode": "batch",
    "language": "en",
    "provider": null,
    "authType": null,
    "modelDisplayName": null,
    "modelVersion": null,
    "baseURL": null,
    "confirmBeforeCommit": true
  }
  ```
- **실행:** `saveConfig(config)` 호출 후 `loadConfig()`를 호출한다.
- **예상 결과:** `mode`는 `batch`, `language`는 `en`으로 유지된다.

### T-4: 기존 값 덮어쓰기
- **준비:** 먼저 `mode: "step"`, `language: "ko"` 설정을 저장한다.
- **실행:** 이후 `mode: "batch"`, `language: "jp"` 설정을 다시 저장한다.
- **예상 결과:** `config.json`의 기존 값이 새 값으로 덮어써지고, 재로드 결과도 `batch`, `jp`를 반환한다.

### T-5: JSON pretty format 저장
- **준비:** 임의의 정상 config 객체를 준비한다.
- **실행:** `saveConfig(config)`를 호출한 뒤 저장된 파일 내용을 확인한다.
- **예상 결과:** JSON이 한 줄로 압축되지 않고 2칸 들여쓰기 형식으로 저장된다.

### T-6: 일부 필드 저장 후 기본 필드 유지
- **준비:** `{ "language": "cn" }`처럼 일부 필드만 가진 객체를 저장한다.
- **실행:** `saveConfig(partialConfig)` 호출 후 `loadConfig()`를 호출한다.
- **예상 결과:** `language`는 `cn`이고, 누락된 `mode`, `provider`, `authType`, `modelDisplayName`, `modelVersion`, `baseURL`, `confirmBeforeCommit`은 `DEFAULT_CONFIG` 값으로 보완된다.

### T-7: Windows/macOS/Linux 경로 안전성
- **준비:** OS별 path separator를 직접 가정하지 않는지 코드와 테스트 환경을 확인한다.
- **실행:** `CONFIG_DIR`, `CONFIG_FILE_PATH` 값을 확인하거나 mock home 경로에서 저장을 수행한다.
- **예상 결과:** `path.join()` 기반 경로를 사용하므로 Windows, macOS, Linux에서 설정 파일 경로가 안전하게 구성된다.

### T-8: 실제 사용자 홈 오염 방지
- **준비:** 테스트에서는 실제 사용자 `~/.config/convention/config.json` 대신 임시 홈 또는 mock 처리된 경로를 사용한다.
- **실행:** 저장 테스트를 수행한다.
- **예상 결과:** 실제 사용자 설정 파일이 생성, 수정, 삭제되지 않는다.

## 3. 테스트 환경 주의사항
- 실제 사용자 홈의 `~/.config/convention/config.json`을 직접 수정하지 않습니다.
- 테스트는 임시 디렉터리 또는 mock 처리된 home 경로에서 수행합니다.
- `.env`, `credentials.json`, private key 파일을 테스트 입력으로 사용하지 않습니다.
- 저장된 설정 파일 전체 내용을 불필요하게 로그로 출력하지 않습니다.

## 4. 검증 결과 요약
- **모든 항목 통과 시:** Phase H 완료 및 Phase I(`--set-mode`) 진입 가능
- **실패 항목 존재 시:** `ensureConfigDir()`의 디렉터리 생성 로직, `saveConfig(config)`의 저장 경로, JSON 직렬화 방식, UTF-8 저장 여부를 우선 점검합니다.
