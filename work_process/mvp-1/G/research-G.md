# Phase G (설정 파일 읽기 구현) 작업 계획 및 리서치

## 1. 개요
Phase G는 사용자 설정 파일(`config.json`)을 안전하게 불러오는 작업을 담당합니다. Phase F에서 정의한 `CONFIG_FILE_PATH`를 기준으로 설정 파일 존재 여부를 확인하고, 파일이 없거나 읽을 수 없는 경우에도 CLI가 중단되지 않도록 기본 설정값(`DEFAULT_CONFIG`)을 반환해야 합니다.

## 2. 작업 목표
- `src/config/store.js`에 `loadConfig()` 함수 구현
- 설정 파일이 없으면 `DEFAULT_CONFIG` 반환
- 설정 파일이 있으면 UTF-8로 읽고 JSON parse 수행
- JSON parse 실패 시 프로그램이 죽지 않도록 안전한 fallback 처리
- 일부 필드만 저장된 설정 파일은 `DEFAULT_CONFIG`와 병합하여 누락 필드 보완
- 1차 MVP에서는 credentials 파일을 읽지 않고 `config.json`만 대상으로 처리

## 3. 세부 구현 계획

### 3.1. 필요한 모듈 및 기본값 import
`src/config/store.js`에서 파일 시스템 접근을 위해 Node.js 내장 `fs` 모듈을 사용하고, 기본 설정값은 `src/config/defaults.js`에서 가져옵니다.

```javascript
import fs from 'fs';
import { DEFAULT_CONFIG } from './defaults.js';
```

### 3.2. 설정 파일 존재 여부 확인
`CONFIG_FILE_PATH`에 파일이 있는지 먼저 확인합니다. 파일이 없으면 새 파일을 만들지 않고 기본값을 반환합니다.

```javascript
if (!fs.existsSync(CONFIG_FILE_PATH)) {
  return { ...DEFAULT_CONFIG };
}
```

### 3.3. 설정 파일 읽기 및 JSON parse
파일이 있으면 UTF-8 인코딩으로 읽고 JSON으로 변환합니다. 설정 파일은 사용자 로컬 파일이므로 diff나 민감정보 원문을 로그로 출력하지 않습니다.

```javascript
const rawConfig = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
const userConfig = JSON.parse(rawConfig);
```

### 3.4. 기본값 병합
저장된 설정에 일부 필드만 있더라도 1차 MVP의 설정 스키마가 유지되도록 기본값과 병합합니다. 사용자 설정이 있는 필드는 사용자 값을 우선합니다.

```javascript
return {
  ...DEFAULT_CONFIG,
  ...userConfig,
};
```

### 3.5. parse 실패 및 읽기 실패 처리
JSON이 깨졌거나 파일 읽기에 실패하면 CLI가 즉시 종료되지 않도록 기본값을 반환합니다. 에러 메시지를 출력하더라도 파일 내용 원문은 출력하지 않습니다.

```javascript
try {
  // read and parse config
} catch {
  return { ...DEFAULT_CONFIG };
}
```

## 4. 보안 및 데이터 보호 기준
- `loadConfig()`는 `CONFIG_FILE_PATH`의 `config.json`만 읽습니다.
- `.env`, `credentials.json`, private key 등 민감 파일은 Phase G의 읽기 대상이 아닙니다.
- parse 실패 시 설정 파일 원문이나 민감할 수 있는 값을 로그로 출력하지 않습니다.
- 사용자 홈 디렉터리 전체를 스캔하지 않습니다.

## 5. 연관 파일 및 다음 단계
- **연관 파일:** `src/config/store.js`, `src/config/defaults.js`
- **주요 함수:** `loadConfig(): object`
- **다음 단계:** Phase H에서 `saveConfig(config)`와 `ensureConfigDir()`를 구현하여 설정 저장 흐름을 연결합니다.
