# Phase K Validator Agent Test

`research-K.md`의 기준을 바탕으로 `src/utils/validator.js`가 1차 MVP의 mode/language 입력값 검증 계약을 만족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `isValidMode(mode)` export 확인 | `src/utils/validator.js` 코드 확인 | 다른 모듈에서 `isValidMode`를 import할 수 있다. |
| V-2 | `isValidLanguage(language)` export 확인 | `src/utils/validator.js` 코드 확인 | 다른 모듈에서 `isValidLanguage`를 import할 수 있다. |
| V-3 | mode 지원값 상수 재사용 | `SUPPORTED_MODES` import 확인 | mode 허용값을 validator 내부에 중복 정의하지 않는다. |
| V-4 | language 지원값 상수 재사용 | `SUPPORTED_LANGUAGES` import 확인 | language 허용값을 validator 내부에 중복 정의하지 않는다. |
| V-5 | 부작용 없음 | validator 코드 확인 | 파일 저장, Git 명령, logger 출력, 외부 API 호출이 없다. |
| V-6 | boolean 반환 확인 | 함수 구현 확인 | 유효/무효 입력 모두 예외 없이 `true` 또는 `false`를 반환한다. |
| V-7 | command 계층 연결 확인 | `src/commands/config.js` 코드 확인 | `setMode()`와 `setLanguage()`가 저장 전에 validator를 사용한다. |

## 2. 기능 테스트 항목

### T-1: 유효 mode `step`
- **실행:** `isValidMode('step')`
- **예상 결과:** `true`

### T-2: 유효 mode `batch`
- **실행:** `isValidMode('batch')`
- **예상 결과:** `true`

### T-3: 무효 mode 값
- **실행:** `isValidMode('fast')`, `isValidMode('auto')`, `isValidMode('all')`
- **예상 결과:** 모두 `false`

### T-4: mode 대소문자 및 공백 검증
- **실행:** `isValidMode('Step')`, `isValidMode(' batch')`, `isValidMode('batch ')`
- **예상 결과:** 모두 `false`

### T-5: mode 빈 값 검증
- **실행:** `isValidMode('')`
- **예상 결과:** `false`

### T-6: mode null/undefined 검증
- **실행:** `isValidMode(null)`, `isValidMode(undefined)`
- **예상 결과:** 모두 `false`

### T-7: mode 타입 오류 입력 검증
- **실행:** `isValidMode(1)`, `isValidMode({})`, `isValidMode([])`
- **예상 결과:** 모두 `false`

### T-8: 유효 language `ko`
- **실행:** `isValidLanguage('ko')`
- **예상 결과:** `true`

### T-9: 유효 language `en`
- **실행:** `isValidLanguage('en')`
- **예상 결과:** `true`

### T-10: 유효 language `jp`
- **실행:** `isValidLanguage('jp')`
- **예상 결과:** `true`

### T-11: 유효 language `cn`
- **실행:** `isValidLanguage('cn')`
- **예상 결과:** `true`

### T-12: 무효 language 값
- **실행:** `isValidLanguage('kr')`, `isValidLanguage('de')`, `isValidLanguage('ja')`, `isValidLanguage('zh')`
- **예상 결과:** 모두 `false`

### T-13: language 대소문자 검증
- **실행:** `isValidLanguage('EN')`, `isValidLanguage('KO')`
- **예상 결과:** 모두 `false`

### T-14: language 빈 값 검증
- **실행:** `isValidLanguage('')`
- **예상 결과:** `false`

### T-15: language null/undefined 검증
- **실행:** `isValidLanguage(null)`, `isValidLanguage(undefined)`
- **예상 결과:** 모두 `false`

### T-16: language 타입 오류 입력 검증
- **실행:** `isValidLanguage(1)`, `isValidLanguage({})`, `isValidLanguage([])`
- **예상 결과:** 모두 `false`

## 3. command 연동 확인 항목

### T-17: `setMode()`에서 validator 사용
- **확인 대상:** `src/commands/config.js`
- **검증 방법:** `setMode(mode)`가 저장 전에 `isValidMode(mode)`를 호출하는지 확인한다.
- **예상 결과:** 무효 mode 입력 시 `saveConfig()`가 호출되지 않는다.

### T-18: `setLanguage()`에서 validator 사용
- **확인 대상:** `src/commands/config.js`
- **검증 방법:** `setLanguage(language)`가 저장 전에 `isValidLanguage(language)`를 호출하는지 확인한다.
- **예상 결과:** 무효 language 입력 시 `saveConfig()`가 호출되지 않는다.

## 4. 테스트 환경 주의사항
- Validator 단위 테스트는 실제 Git 저장소 상태를 변경하지 않습니다.
- 실제 사용자 `~/.config/convention/config.json`을 직접 수정하지 않습니다.
- `.env`, `credentials.json`, private key 파일을 테스트 입력으로 사용하지 않습니다.
- 실패 케이스에서 config 전체 객체나 민감 정보를 로그로 출력하지 않습니다.
- Provider 검증은 1차 MVP 필수 테스트가 아니며, 추후 `SUPPORTED_PROVIDERS`가 추가될 때 별도 테스트로 분리합니다.

## 5. 검증 결과 요약
- **모든 항목 통과 시:** Phase K 완료 및 Phase L(Logger) 진입 가능
- **실패 항목 존재 시:** 지원값 상수 import, 유효값 목록, 빈 값 처리, command 계층의 저장 중단 로직을 우선 점검합니다.
