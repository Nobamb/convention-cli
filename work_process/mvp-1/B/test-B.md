# Phase B (npm 전역 설치) 검증 테스트 가이드

`init/01_mvp-1.md`의 B단계(npm 전역 설치 Agent) 설정을 바탕으로, `convention` 명령어가 시스템 어디환에서든 실행 가능한 CLI 도구로 올바르게 구성되었는지 확인하기 위한 테스트 항목입니다.

## 1. CLI 구성 요소 검증 (Configuration Check)

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :--- | :--- | :--- |
| **V-1** | `package.json` bin 필드 | `cat package.json` | `"bin": { "convention": "bin/convention.js" }` 설정 포함. |
| **V-2** | `bin/convention.js` Shebang | `head -n 1 bin/convention.js` | 파일 최상단에 `#!/usr/bin/env node` 명시. |
| **V-3** | 실행 권한 (Unix계열) | `ls -l bin/convention.js` | 파일에 실행 권한(`x`)이 부여되어 있음. (Windows 제외) |
| **V-4** | 모듈 타입 설정 | `cat package.json` | `"type": "module"` 설정으로 ESM 지원 확인. |

## 2. 설치 및 실행 테스트 (Installation & Execution)

### T-1: 로컬 링크 테스트
- **명령어:** `npm link`
- **검증:** 현재 개발 중인 패키지를 전역 `node_modules`에 심볼릭 링크로 연결 시 에러가 없는지 확인.

### T-2: 전역 명령어 실행 테스트
- **명령어:** (프로젝트 폴더 밖에서) `convention --help`
- **검증:** `Commander` 도움말 인터페이스가 정상적으로 출력되는지 확인.

### T-3: 버전 확인 테스트
- **명령어:** `convention --version`
- **검증:** `package.json`에 정의된 버전(`1.0.0`)이 정확히 출력되는지 확인.

## 3. 라우팅 기초 검증 (Routing Smoke Test)

현재 기능이 구현되지 않았더라도, 옵션 입력 시 올바른 조건문 분기에 진입하는지 확인합니다. (현재 `console.log` 또는 디버깅을 통해 확인 필요)

- `convention --step`: Step 모드 진입 로직 확인.
- `convention --batch`: Batch 모드 진입 로직 확인.
- `convention --set-mode batch`: 설정 변경 로직 진입 확인.
- `convention --language en`: 언어 설정 로직 진입 확인.

---

## 검증 결과 요약

- **모든 항목 통과 시:** Phase B 완료 및 Phase C (CLI 라우팅 및 기능 구현) 진입 가능.
- **실패 항목 존재 시:** `package.json`의 `bin` 경로 또는 `bin/convention.js`의 문법 오류 확인 후 재테스트.
