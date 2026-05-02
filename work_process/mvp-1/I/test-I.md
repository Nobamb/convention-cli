# Phase I --set-mode 검증 Test

`research-I.md`의 구현 기준을 바탕으로, `--set-mode` 기능이 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `setMode(mode)` export 확인 | `src/commands/config.js` 코드 확인 | 다른 모듈과 CLI 라우팅에서 `setMode(mode)`를 import할 수 있다. |
| V-2 | mode 검증 로직 확인 | `isValidMode(mode)` 사용 또는 동일 책임의 검증 코드 확인 | `step`, `batch`만 허용하고 나머지는 거부한다. |
| V-3 | 기존 config 로드 확인 | `loadConfig()` 호출 여부 확인 | 저장 전 기존 설정을 불러온다. |
| V-4 | config 저장 확인 | `saveConfig(config)` 호출 여부 확인 | mode 변경 후 설정 파일에 저장한다. |
| V-5 | 직접 `console.log` 남발 방지 | logger 사용 여부 확인 | 성공/실패 메시지는 `logger.success/error` 계열로 출력한다. |

## 2. 기능 테스트 항목

### T-1: `convention --set-mode step`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `mode`가 `batch`인 상태를 만든다.
- **실행:** `convention --set-mode step` 또는 `setMode('step')`을 실행한다.
- **예상 결과:** `config.json`의 `mode` 값이 `step`으로 저장된다.

### T-2: `convention --set-mode batch`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `mode`가 `step`인 상태를 만든다.
- **실행:** `convention --set-mode batch` 또는 `setMode('batch')`를 실행한다.
- **예상 결과:** `config.json`의 `mode` 값이 `batch`로 저장된다.

### T-3: 잘못된 값 `fast` 입력
- **준비:** 기존 config에 `mode: "step"`을 저장해 둔다.
- **실행:** `convention --set-mode fast` 또는 `setMode('fast')`를 실행한다.
- **예상 결과:** 실패 메시지가 출력되고 `config.json`의 `mode` 값은 기존 `step`으로 유지된다.

### T-4: 기존 저장값 유지
- **준비:** 기존 config에 아래 값을 저장한다.
  ```json
  {
    "mode": "step",
    "language": "en",
    "provider": null,
    "authType": null,
    "modelDisplayName": null,
    "modelVersion": null,
    "baseURL": null,
    "confirmBeforeCommit": true
  }
  ```
- **실행:** `setMode('batch')`를 실행한다.
- **예상 결과:** `mode`만 `batch`로 변경되고 `language`, provider 관련 placeholder, `confirmBeforeCommit` 값은 유지된다.

### T-5: config 파일이 없는 첫 실행
- **준비:** 격리된 테스트 home 경로에서 `.config/convention/config.json`이 없는 상태를 만든다.
- **실행:** `setMode('batch')`를 실행한다.
- **예상 결과:** `DEFAULT_CONFIG` 기반 설정 파일이 새로 생성되고 `mode`는 `batch`로 저장된다.

### T-6: 저장 후 `loadConfig()` 반영
- **준비:** 격리된 테스트 home 경로를 사용한다.
- **실행:** `setMode('step')` 실행 후 `loadConfig()`를 호출한다.
- **예상 결과:** `loadConfig()` 반환 객체의 `mode` 값이 `step`이다.

### T-7: 실패 시 저장 파일 변경 금지
- **준비:** 기존 config 파일 내용을 저장 전후로 비교할 수 있게 준비한다.
- **실행:** `setMode('fast')`, `setMode('')`, `setMode(undefined)` 같은 무효 입력을 실행한다.
- **예상 결과:** 실패 메시지만 출력되고 기존 config 파일 내용은 변경되지 않는다.

## 3. CLI 통합 확인 항목
- `node bin/convention.js --set-mode step`
- `node bin/convention.js --set-mode batch`
- `node bin/convention.js --set-mode fast`

위 명령은 실제 사용자 홈이 아니라 테스트용 home/mock 경로에서 확인해야 합니다. 실제 사용자 설정 파일을 직접 오염시키지 않는 것이 우선입니다.

## 4. 테스트 환경 주의사항
- 실제 사용자 `~/.config/convention/config.json`을 직접 수정하지 않습니다.
- 테스트는 임시 디렉터리 또는 mock 처리된 home 경로에서 수행합니다.
- `.env`, `credentials.json`, private key 파일을 테스트 입력으로 사용하지 않습니다.
- 실패 케이스에서 설정 객체 전체를 로그로 출력하지 않습니다.

## 5. 검증 결과 요약
- **모든 항목 통과 시:** Phase I 완료 및 Phase J(`--language`) 진입 가능
- **실패 항목 존재 시:** mode 검증, `loadConfig()` 호출, `saveConfig()` 호출, 기존 필드 보존, 실패 시 저장 방지 로직을 우선 점검합니다.
