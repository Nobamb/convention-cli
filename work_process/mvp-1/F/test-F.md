# Phase F (설정 파일 경로 구현) 검증 테스트 가이드

`research-F.md`에서 도출된 작업 계획을 바탕으로, 설정 파일 경로 생성 기능(Phase F)이 성공적으로 구현되었는지 확인하기 위한 테스트 항목입니다.

## 1. 파일 생성 및 내장 모듈 사용 검증

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| **V-1** | `store.js` 파일 존재 확인 | `src/config/store.js` 파일 유무 확인 | `src/config` 폴더 내에 파일이 정상적으로 존재함. |
| **V-2** | 내장 모듈 Import 검증 | 파일 최상단 `import` 구문 확인 | `os` 및 `path` 내장 모듈이 정상적으로 import 되어 있음. |
| **V-3** | `path.join` 사용 여부 | 경로 선언부 코드 분석 | 하드코딩된 슬래시(`/` 또는 `\`) 결합 대신 `path.join` 함수가 사용됨. |
| **V-4** | `os.homedir` 사용 여부 | 경로 선언부 코드 분석 | 사용자의 홈 디렉토리를 가져오기 위해 `os.homedir()`를 명시적으로 호출함. |

## 2. 경로 무결성 테스트 (Execution Test)

### T-1: 크로스 플랫폼 경로 출력 테스트
- **테스트 코드 작성 (임시):** 프로젝트 루트에서 임시 스크립트(`test-path.js`) 작성
  ```javascript
  import { CONFIG_DIR, CONFIG_FILE_PATH } from "./src/config/store.js";
  console.log("Config Directory:", CONFIG_DIR);
  console.log("Config File Path:", CONFIG_FILE_PATH);
  ```
- **명령어:** `node test-path.js`
- **검증 기준:** 
  - **Windows 예시:** `C:\Users\사용자명\.config\convention\config.json` 형태의 올바른 경로 구분자(`\`)가 포함된 절대 경로인지 확인.
  - **macOS/Linux 예시:** `/Users/사용자명/.config/convention/config.json` (또는 `/home/사용자명/...`) 형태인지 확인.
  - 임의의 문자열 결합 오류(예: `//` 연속 등)가 발생하지 않는지 확인.

## 3. 검증 결과 요약
- **모든 항목 통과 시:** Phase F 완료 및 Phase G(설정 파일 읽기 구현) 진입 가능.
- **실패 항목 존재 시:** `src/config/store.js`의 경로 결합 로직(특히 `path.join` 사용 여부)을 수정하고 재테스트 진행.
