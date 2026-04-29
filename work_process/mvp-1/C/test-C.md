# Phase C (CLI 라우팅) 검증 테스트 가이드

`init/01_mvp-1.md`의 C단계(CLI 라우팅 Agent) 설정을 바탕으로, 사용자의 입력 옵션이 적절한 명령어 로직으로 연결되는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 분석 검증 (Static Analysis)

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :--- | :--- | :--- |
| **V-1** | 모듈 Import 확인 | `cat bin/convention.js` | `src/commands/` 하위 모듈들이 올바르게 import됨. |
| **V-2** | 함수 호출 로직 확인 | `cat bin/convention.js` | `if/else` 블록 내에서 주석이 해제되고 함수가 호출됨. |
| **V-3** | 명령어 함수 존재 확인 | `ls src/commands/` | `commit.js`, `config.js` 파일에 필요한 함수들이 export됨. |

## 2. 기능성 라우팅 테스트 (Routing Test)

현재는 실제 기능 구현 전이므로, 각 함수 호출 시 출력되는 **로그 메시지**로 정상 연결 여부를 확인합니다.

| ID | 명령어 | 예상 출력 (로그) | 결과 |
| :-- | :--- | :--- | :--- |
| **T-1** | `convention --step` | `[DEBUG] runStepCommit 호출됨` | |
| **T-2** | `convention --batch` | `[DEBUG] runBatchCommit 호출됨` | |
| **T-3** | `convention --set-mode batch` | `[DEBUG] setMode 호출됨: batch` | |
| **T-4** | `convention --language en` | `[DEBUG] setLanguage 호출됨: en` | |
| **T-5** | `convention` (기본 실행) | `[DEBUG] runDefaultCommit 호출됨` | |

## 3. 예외 케이스 검증

- `convention --unknown`: `commander`에 의해 정의되지 않은 옵션 에러 메시지 출력 확인.
- `convention --help`: 정의된 모든 옵션이 도움말에 정상적으로 표시되는지 확인.

---

## 검증 결과 요약

- **모든 항목 통과 시:** Phase C 완료 및 Phase 2(설정 시스템) 진입 가능.
- **실패 항목 존재 시:** `bin/convention.js`의 파싱 로직 및 `import` 경로 재확인.
