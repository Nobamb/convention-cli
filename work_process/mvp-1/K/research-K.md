# Phase K Validator Agent Research

## 1. 개요
Phase K는 CLI 입력값 검증을 담당하는 Validator Agent 단계입니다. 1차 MVP에서는 `src/utils/validator.js`의 `isValidMode(mode)`와 `isValidLanguage(language)`를 기준으로 `--set-mode`, `--language` 명령에서 사용할 공통 검증 규칙을 정리합니다.

현재 `src/utils/validator.js`에는 `isValidMode(mode)`와 `isValidLanguage(language)`가 이미 구현되어 있습니다. 두 함수는 `src/config/defaults.js`의 `SUPPORTED_MODES`, `SUPPORTED_LANGUAGES`를 import해서 허용값 목록을 재사용합니다.

## 2. 현재 상태
- `SUPPORTED_MODES`는 `step`, `batch`를 포함합니다.
- `SUPPORTED_LANGUAGES`는 `ko`, `en`, `jp`, `cn`을 포함합니다.
- `isValidMode(mode)`는 입력값이 `SUPPORTED_MODES`에 포함되면 `true`, 아니면 `false`를 반환합니다.
- `isValidLanguage(language)`는 입력값이 `SUPPORTED_LANGUAGES`에 포함되면 `true`, 아니면 `false`를 반환합니다.
- 빈 문자열, `null`, `undefined`, number/object/array 같은 타입이 다른 입력은 `includes()` 결과에 따라 예외 없이 `false`를 반환해야 합니다.
- Validator는 파일 시스템, Git 명령, logger, 네트워크 호출에 의존하지 않는 순수 검증 계층으로 유지해야 합니다.

## 3. 구현 기준

### 3.1. `isValidMode(mode)`
`isValidMode(mode)`는 1차 MVP에서 `step`, `batch`만 유효한 mode로 인정합니다.

```javascript
export function isValidMode(mode) {
  return SUPPORTED_MODES.includes(mode);
}
```

검증 기준:

| 입력 | 예상 결과 | 비고 |
| :--- | :--- | :--- |
| `step` | `true` | 파일별 커밋 모드 |
| `batch` | `true` | 전체 변경사항 커밋 모드 |
| `fast` | `false` | 지원하지 않는 값 |
| `Step` | `false` | 대소문자 자동 변환 없음 |
| ` batch` / `batch ` | `false` | 공백 자동 trim 없음 |
| `""`, `null`, `undefined` | `false` | 빈 값은 무효 |

대소문자 변환이나 공백 trim은 1차 MVP 범위에 포함하지 않습니다. 사용자는 문서에 명시된 정확한 값인 `step`, `batch`를 입력해야 합니다.

### 3.2. `isValidLanguage(language)`
`isValidLanguage(language)`는 1차 MVP에서 `ko`, `en`, `jp`, `cn`만 유효한 language로 인정합니다.

```javascript
export function isValidLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}
```

검증 기준:

| 입력 | 예상 결과 | 비고 |
| :--- | :--- | :--- |
| `ko` | `true` | 한국어 |
| `en` | `true` | 영어 |
| `jp` | `true` | 일본어 |
| `cn` | `true` | 중국어 |
| `kr`, `de`, `EN` | `false` | 지원하지 않는 값 |
| `""`, `null`, `undefined` | `false` | 빈 값은 무효 |
| number/object/array | `false` | 문자열 목록에 포함되지 않음 |

언어 코드는 `AGENTS.md`, `init/01_mvp-1.md`, `DEFAULT_CONFIG`의 계약과 동일하게 유지합니다. 특히 일본어는 `jp`, 중국어는 `cn`을 사용합니다.

## 4. 빈 값 검증 기준
Validator 함수는 빈 값, `null`, `undefined` 입력에 대해 예외를 던지지 않고 `false`를 반환해야 합니다.

이 기준을 유지하는 이유:

- CLI 옵션 누락이나 잘못된 호출을 command 계층에서 일관되게 처리할 수 있습니다.
- validator는 순수 boolean 함수로 유지되어 테스트가 단순합니다.
- 설정 파일 저장, Git 명령, 외부 API 호출 같은 부작용이 발생하지 않습니다.

실패 처리 위치는 아래처럼 분리합니다.

| 계층 | 책임 |
| :--- | :--- |
| `src/utils/validator.js` | 유효 여부를 `true`/`false`로 반환 |
| `src/commands/config.js` | 실패 메시지 출력 및 `saveConfig()` 호출 중단 |
| `src/utils/logger.js` | 사용자에게 허용값 안내 |

## 5. Provider 검증 확장 가능성
1차 MVP에서는 실제 외부 AI Provider보다 Mock Provider 흐름이 우선이므로 provider 검증은 구현 대상이 아닙니다. `init/prompt.md` 11-1의 요구도 provider 검증의 “확장 가능성”을 정리하는 것이며, `isValidProvider()`를 지금 추가하라는 의미는 아닙니다.

추후 확장 시 고려할 수 있는 형태:

```javascript
export function isValidProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}
```

확장 기준:

- provider 목록은 별도 상수로 관리하고 validator는 목록 포함 여부만 확인합니다.
- provider별 API 세부 검증은 `src/providers/` 또는 `src/auth/`에서 처리합니다.
- API Key, OAuth Token, credentials 원문은 validator 테스트나 로그에 사용하지 않습니다.
- 외부 AI API로 diff를 전송하기 전 사용자 확인이 필요하다는 보안 Gate는 validator가 아니라 AI/commit flow에서 다룹니다.

## 6. 보안 및 데이터 보호 기준
- Validator는 Git 명령을 실행하지 않습니다.
- Validator는 파일 시스템을 읽거나 쓰지 않습니다.
- Validator는 `.env`, credentials, private key 내용을 다루지 않습니다.
- Validator는 logger를 호출하지 않으므로 입력값이나 설정 객체를 직접 출력하지 않습니다.
- 테스트는 실제 사용자 설정 파일이나 Git 히스토리를 변경하지 않는 단위 테스트로 구성합니다.

## 7. 연결 파일 및 다음 단계
- 연결 파일: `src/utils/validator.js`, `src/config/defaults.js`, `src/commands/config.js`
- 주요 함수: `isValidMode(mode): boolean`, `isValidLanguage(language): boolean`
- 다음 단계: K 단계 테스트에서는 유효값, 무효값, 빈 값, 타입이 다른 입력을 직접 검증해 현재 구현의 계약을 고정합니다.
