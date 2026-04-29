# Phase A (프로젝트 초기화) 검증 테스트 가이드

`research-A.md`에서 확인된 미비 사항을 바탕으로, 프로젝트 초기화 단계(Phase A)가 성공적으로 완료되었는지 확인하기 위한 테스트 항목입니다.

## 1. 파일 내용 및 유효성 검증

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :--- | :--- | :--- |
| **V-1** | `package.json` 유효성 | `cat package.json` 및 `JSON` 형식 확인 | 파일이 비어있지 않으며, `"type": "module"`과 `"bin"` 필드가 올바르게 설정됨. |
| **V-2** | `bin/convention.js` Shebang | `head -n 1 bin/convention.js` | 첫 번째 줄에 `#!/usr/bin/env node`가 포함됨. |
| **V-3** | `.gitignore` 설정 | `cat .gitignore` | `node_modules`, `.env`, `*.pem` 등 보안 및 불필요 파일 제외 설정 포함. |
| **V-4** | `README.md` 내용 | `cat README.md` | 프로젝트 개요 및 설치/실행 방법이 기술되어 있음. |

## 2. 기능성 테스트 (Execution Test)

### T-1: 의존성 설치 테스트
- **명령어:** `npm install`
- **검증:** `package.json`에 정의된 의존성(`commander`, `prompts`, `chalk`, `ora` 등)이 `node_modules`에 정상적으로 설치되는지 확인.

### T-2: CLI 실행 테스트 (로컬)
- **명령어:** `node bin/convention.js --help`
- **검증:** `commander`에 의해 설정된 기본 도움말 메시지가 출력되는지 확인.

### T-3: NPM Link 및 전역 실행 테스트
- **명령어:** `npm link` 실행 후, 임의의 경로에서 `convention --version` 실행.
- **검증:** 전역 커맨드로 인식되어 버전 정보가 정상 출력되는지 확인.

## 3. 구조적 일치성 검증

- `init/structure.md`에서 정의한 폴더 구조와 실제 생성된 구조가 100% 일치하는지 재확인.
  - `src/auth/`
  - `src/commands/`
  - `src/config/`
  - `src/core/`
  - `src/providers/`
  - `src/utils/`

---

## 검증 결과 요약

- **모든 항목 통과 시:** Phase A 완료 및 Phase B(환경 설정 구현) 진입 가능.
- **실패 항목 존재 시:** 해당 파일을 수정하고 `research-A.md`를 업데이트한 후 재테스트.
