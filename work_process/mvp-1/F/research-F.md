# Phase F (설정 파일 경로 구현) 작업 계획 및 리서치

## 1. 개요
Phase F는 운영체제에 맞는 설정 파일(`config.json`)의 경로를 안전하게 생성하는 작업을 담당합니다. 하드코딩된 문자열 대신 Node.js의 내장 모듈인 `os`와 `path`를 활용하여 크로스 플랫폼(Windows, macOS, Linux) 환경에서 일관되게 동작하도록 구현해야 합니다.

## 2. 작업 목표
- 사용자 홈 디렉토리 하위에 `.config/convention` 폴더 경로 지정
- 최종 설정 파일 경로는 `~/.config/convention/config.json`으로 생성
- Node.js의 `os.homedir()`와 `path.join()` 사용 강제 (단순 문자열 결합 금지)
- 대상 파일: `src/config/store.js` 내 경로 생성 로직 반영 (1차 MVP에서는 자격 증명 `credentials.json`은 제외 가능하나 구조적 대비는 고려)

## 3. 세부 구현 계획

### 3.1. 모듈 임포트
`src/config/store.js` 최상단에 필요한 Node.js 내장 모듈을 불러옵니다.
```javascript
import os from 'os';
import path from 'path';
```

### 3.2. 경로 상수 선언
설정 디렉토리와 설정 파일의 경로를 상수로 선언하여 코드 전반에서 재사용할 수 있도록 합니다. 외부에서 필요한 경우를 대비해 `export`를 고려합니다.
```javascript
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'convention');
export const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');
```

### 3.3. 크로스 플랫폼 고려사항
- `path.join`을 사용하면 Windows에서는 `\`, Unix 계열에서는 `/`로 알아서 구분자가 설정됩니다.
- `os.homedir()`는 현재 실행 중인 사용자의 홈 디렉토리를 반환하므로 환경 변수(`$HOME`, `%USERPROFILE%`) 차이를 완벽히 흡수합니다.

## 4. 연관 파일 및 다음 단계
- **연관 파일:** `src/config/store.js`
- **다음 단계:** 정의된 경로(`CONFIG_FILE_PATH`)를 바탕으로, 파일 시스템(`fs`)을 활용하여 실제로 설정 파일을 읽어오거나 저장하는 로직(Phase G: 설정 파일 읽기, Phase H: 설정 파일 쓰기)으로 이어집니다.
