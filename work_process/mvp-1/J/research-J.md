# Phase J --language 구현 Research

## 1. 개요
Phase J는 `convention --language ko|en|jp|cn` 명령으로 커밋 메시지 생성 언어를 저장하는 단계입니다. 사용자가 선택한 언어는 `~/.config/convention/config.json`의 `language` 필드에 저장되고, 이후 prompt 생성 단계에서 `buildCommitPrompt({ diff, language, mode })`에 전달되어 AI 커밋 메시지 언어를 결정하는 기준으로 사용됩니다.

현재 `bin/convention.js`에는 `--language <lang>` 옵션과 `setLanguage(options.language)` 라우팅이 연결되어 있습니다. 하지만 `src/commands/config.js`의 `setLanguage(lang)`는 debug 출력만 하는 placeholder 상태이므로, Phase G/H에서 준비된 `loadConfig()`와 `saveConfig(config)`를 연결해 실제 설정 저장 흐름으로 바꾸는 것이 목표입니다.

## 2. 작업 목표
- `src/commands/config.js`의 `setLanguage(language)` 구현
- 입력값이 `ko`, `en`, `jp`, `cn` 중 하나인지 검증
- 잘못된 language 값은 저장하지 않고 실패 메시지 처리
- 기존 config를 `loadConfig()`로 불러오기
- 기존 설정 객체에서 `language`만 새 값으로 변경
- 변경된 config를 `saveConfig(config)`로 저장
- 성공/실패 메시지는 `src/utils/logger.js`를 통해 출력
- 이후 prompt 생성 단계에서 저장된 `language` 값을 사용할 수 있도록 config contract 유지

## 3. 구현 기준

### 3.1. 입력값 검증
`setLanguage(language)`는 가장 먼저 입력값을 검증해야 합니다. 허용 값은 1차 MVP 기준 `ko`, `en`, `jp`, `cn` 네 개뿐입니다.

```javascript
if (!isValidLanguage(language)) {
  error('지원하지 않는 language입니다. 사용 가능 값: ko, en, jp, cn');
  return;
}
```

검증 로직은 `src/utils/validator.js`의 `isValidLanguage(language)`로 분리하는 것이 K단계 Validator Agent의 책임 분리에 맞습니다. 현재 `src/config/defaults.js`에는 `SUPPORTED_LANGUAGES = ["ko", "en", "jp", "cn"]`가 이미 있으므로, validator에서는 이 상수를 재사용하는 방식이 적합합니다.

### 3.2. 기존 config 로드
유효한 language 값이면 `loadConfig()`로 기존 설정을 불러옵니다. 설정 파일이 없거나 일부 필드만 저장되어 있어도 Phase G의 병합 로직에 의해 `DEFAULT_CONFIG` 기반 객체가 반환되어야 합니다.

```javascript
const config = loadConfig();
```

### 3.3. language 변경 후 저장
기존 설정의 다른 필드는 유지하고 `language` 필드만 변경합니다. `mode`, provider placeholder, `confirmBeforeCommit` 같은 값은 덮어쓰지 않습니다.

```javascript
saveConfig({
  ...config,
  language,
});
```

### 3.4. 메시지 처리
성공 시에는 저장된 language를 사용자에게 알려야 합니다. 실패 시에는 허용 가능한 값을 포함한 안내 메시지를 출력합니다.

```javascript
success(`커밋 메시지 언어가 ${language}로 저장되었습니다.`);
```

`console.log()`를 직접 사용하지 말고 `src/utils/logger.js`의 `success()`, `error()`를 사용합니다. 설정 객체 전체나 config 파일 원문은 로그로 출력하지 않습니다.

### 3.5. CLI 라우팅 연결
`bin/convention.js`에서 `--language <lang>` 옵션이 들어오면 `setLanguage(lang)`로 전달되어야 합니다. 현재 라우팅은 이미 연결되어 있으므로 J단계에서는 command 내부 구현과 validator 보완이 핵심입니다.

### 3.6. prompt 생성 단계와의 연결
J단계는 prompt를 직접 생성하지 않습니다. 다만 저장된 `language` 값은 이후 S단계 Prompt 생성 Agent에서 `loadConfig()`로 읽혀 `buildCommitPrompt({ diff, language, mode })`의 `language` 인자로 전달되어야 합니다.

언어별 의미는 아래 기준으로 유지합니다.

| 값 | 의미 |
| :--- | :--- |
| `ko` | 한국어 커밋 메시지 |
| `en` | 영어 커밋 메시지 |
| `jp` | 일본어 커밋 메시지 |
| `cn` | 중국어 커밋 메시지 |

## 4. 보안 및 데이터 보호 기준
- `setLanguage(language)`는 Git 명령이나 shell 명령을 실행하지 않습니다.
- credentials, API key, OAuth token, `.env` 파일은 읽거나 쓰지 않습니다.
- config 저장 시 기존 설정 객체 전체를 불필요하게 로그로 출력하지 않습니다.
- 잘못된 language 입력 시 기존 `config.json`을 변경하지 않습니다.
- 실제 사용자 홈을 대상으로 한 자동 테스트는 피하고, 테스트는 임시 home 또는 mock 경로에서 수행합니다.

## 5. 연결 파일 및 다음 단계
- 연결 파일: `src/commands/config.js`, `src/config/store.js`, `src/config/defaults.js`, `src/utils/validator.js`, `src/utils/logger.js`, `bin/convention.js`
- 주요 함수: `setLanguage(language): void`, `loadConfig(): object`, `saveConfig(config): void`, `isValidLanguage(language): boolean`
- 다음 단계: Phase K에서 `isValidMode(mode)`와 `isValidLanguage(language)`를 Validator Agent 기준에 맞게 정리하고, null/undefined/빈 문자열 같은 입력까지 검증합니다.
