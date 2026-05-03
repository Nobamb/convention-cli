# Phase J --language 검증 Test

`research-J.md`의 구현 기준을 바탕으로, `--language` 기능이 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `setLanguage(language)` export 확인 | `src/commands/config.js` 코드 확인 | 다른 모듈과 CLI 라우팅에서 `setLanguage(language)`를 import할 수 있다. |
| V-2 | language 검증 로직 확인 | `isValidLanguage(language)` 사용 또는 동일 책임의 검증 코드 확인 | `ko`, `en`, `jp`, `cn`만 허용하고 나머지는 거부한다. |
| V-3 | 지원 언어 상수 확인 | `src/config/defaults.js` 코드 확인 | `SUPPORTED_LANGUAGES`가 `ko`, `en`, `jp`, `cn`을 포함한다. |
| V-4 | 기존 config 로드 확인 | `loadConfig()` 호출 여부 확인 | 저장 전 기존 설정을 불러온다. |
| V-5 | config 저장 확인 | `saveConfig(config)` 호출 여부 확인 | language 변경 후 설정 파일에 저장한다. |
| V-6 | 직접 `console.log` 남발 방지 | logger 사용 여부 확인 | 성공/실패 메시지는 `logger.success/error` 계열로 출력한다. |
| V-7 | CLI 라우팅 확인 | `bin/convention.js` 코드 확인 | `--language <lang>` 옵션이 `setLanguage(options.language)`로 전달된다. |

## 2. 기능 테스트 항목

### T-1: `convention --language ko`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `language`가 `en`인 상태를 만든다.
- **실행:** `convention --language ko` 또는 `setLanguage('ko')`를 실행한다.
- **예상 결과:** `config.json`의 `language` 값이 `ko`로 저장된다.

### T-2: `convention --language en`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `language`가 `ko`인 상태를 만든다.
- **실행:** `convention --language en` 또는 `setLanguage('en')`를 실행한다.
- **예상 결과:** `config.json`의 `language` 값이 `en`으로 저장된다.

### T-3: `convention --language jp`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `language`가 `ko`인 상태를 만든다.
- **실행:** `convention --language jp` 또는 `setLanguage('jp')`를 실행한다.
- **예상 결과:** `config.json`의 `language` 값이 `jp`로 저장된다.

### T-4: `convention --language cn`
- **준비:** 격리된 테스트 home 경로에서 config 파일이 없거나 `language`가 `ko`인 상태를 만든다.
- **실행:** `convention --language cn` 또는 `setLanguage('cn')`를 실행한다.
- **예상 결과:** `config.json`의 `language` 값이 `cn`으로 저장된다.

### T-5: 잘못된 언어값 입력
- **준비:** 기존 config에 `language: "ko"`를 저장해 둔다.
- **실행:** `convention --language de`, `setLanguage('kr')`, `setLanguage('')`, `setLanguage(undefined)` 같은 무효 입력을 실행한다.
- **예상 결과:** 실패 메시지가 출력되고 `config.json`의 `language` 값은 기존 `ko`로 유지된다.

### T-6: 기존 저장값 유지
- **준비:** 기존 config에 아래 값을 저장한다.
  ```json
  {
    "mode": "batch",
    "language": "ko",
    "provider": null,
    "authType": null,
    "modelDisplayName": null,
    "modelVersion": null,
    "baseURL": null,
    "confirmBeforeCommit": true
  }
  ```
- **실행:** `setLanguage('en')`을 실행한다.
- **예상 결과:** `language`만 `en`으로 변경되고 `mode`, provider 관련 placeholder, `confirmBeforeCommit` 값은 유지된다.

### T-7: config 파일이 없는 첫 실행
- **준비:** 격리된 테스트 home 경로에서 `.config/convention/config.json`이 없는 상태를 만든다.
- **실행:** `setLanguage('jp')`를 실행한다.
- **예상 결과:** `DEFAULT_CONFIG` 기반 설정 파일이 새로 생성되고 `language`는 `jp`로 저장된다.

### T-8: 저장 후 `loadConfig()` 반영
- **준비:** 격리된 테스트 home 경로를 사용한다.
- **실행:** `setLanguage('cn')` 실행 후 `loadConfig()`를 호출한다.
- **예상 결과:** `loadConfig()` 반환 객체의 `language` 값이 `cn`이다.

### T-9: 실패 시 저장 파일 변경 금지
- **준비:** 기존 config 파일 내용을 저장 전후로 비교할 수 있게 준비한다.
- **실행:** `setLanguage('de')`, `setLanguage('korean')`, `setLanguage(null)` 같은 무효 입력을 실행한다.
- **예상 결과:** 실패 메시지만 출력되고 기존 config 파일 내용은 변경되지 않는다.

### T-10: prompt 생성 단계 연결 가능성
- **준비:** `setLanguage('en')` 실행 후 config를 로드한다.
- **실행:** 이후 prompt 생성 단계에서 사용할 config 객체의 `language` 값을 확인한다.
- **예상 결과:** `buildCommitPrompt({ diff, language, mode })`에 전달 가능한 `language: "en"` 값이 유지된다.

## 3. CLI 통합 확인 항목
- `node bin/convention.js --language ko`
- `node bin/convention.js --language en`
- `node bin/convention.js --language jp`
- `node bin/convention.js --language cn`
- `node bin/convention.js --language de`

위 명령은 실제 사용자 홈이 아니라 테스트용 home/mock 경로에서 확인해야 합니다. 실제 사용자 설정 파일을 직접 오염시키지 않는 것이 우선입니다.

## 4. 테스트 환경 주의사항
- 실제 사용자 `~/.config/convention/config.json`을 직접 수정하지 않습니다.
- 테스트는 임시 디렉터리 또는 mock 처리된 home 경로에서 수행합니다.
- `.env`, `credentials.json`, private key 파일을 테스트 입력으로 사용하지 않습니다.
- 실패 케이스에서 설정 객체 전체를 로그로 출력하지 않습니다.
- `--language` 테스트는 Git 커밋을 만들지 않으며 실제 사용자 Git 히스토리를 변경하지 않습니다.

## 5. 검증 결과 요약
- **모든 항목 통과 시:** Phase J 완료 및 Phase K(Validator) 진입 가능
- **실패 항목 존재 시:** language 검증, `loadConfig()` 호출, `saveConfig()` 호출, 기존 필드 보존, 실패 시 저장 방지 로직을 우선 점검합니다.
