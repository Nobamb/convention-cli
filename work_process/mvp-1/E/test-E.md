# Phase E (기본 설정값 구현) 검증 테스트 가이드

`research-E.md`에서 도출된 작업 계획을 바탕으로, 기본 설정값 관리 기능(Phase E)이 성공적으로 구현되었는지 확인하기 위한 테스트 항목입니다.

## 1. 파일 생성 및 내장 변수 검증

| ID      | 테스트 항목                | 검증 방법                               | 예상 결과                                                                                                                               |
| :------ | :------------------------- | :-------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **V-1** | `defaults.js` 생성 여부    | `cat src/config/defaults.js` 확인       | `src/config` 폴더 내에 파일이 정상적으로 존재함.                                                                                        |
| **V-2** | `DEFAULT_CONFIG` 객체 검증 | 파일 내 `DEFAULT_CONFIG` 객체 내용 확인 | `mode`, `language`, `provider`, `authType`, `modelVersion`, `baseURL` 필드가 존재하며 기본값이 할당됨 (예: mode="step", language="ko"). |
| **V-3** | Export 구문 확인           | 파일 하단 또는 변수 선언부 확인         | `export const DEFAULT_CONFIG` 형태로 정상 모듈 export 됨.                                                                               |

## 2. 기능성 테스트 (Execution Test)

### T-1: 모듈 Import 테스트

- **테스트 코드 작성 (임시):** 프로젝트 루트에서 임시 스크립트(`test-import.js`) 작성
  ```javascript
  import { DEFAULT_CONFIG } from "./src/config/defaults.js";
  console.log(DEFAULT_CONFIG.mode);
  ```
- **명령어:** `node test-import.js`
- **검증:** 오류 없이 기본 모드 값(예: `step`)이 정상 출력되는지 확인.

## 3. 연관 데이터 무결성 검증

- 추후 추가될 `SUPPORTED_MODES` (예: `['step', 'batch']`) 또는 `SUPPORTED_LANGUAGES` (예: `['ko', 'en', 'jp', 'cn']`) 와 같은 상수 배열이 필요하다면, 함께 선언되어 내보내지고 있는지 구조적 검토.

---

## 검증 결과 요약

- **모든 항목 통과 시:** Phase E 완료 및 Phase F(설정 파일 경로 구현) 진입 가능.
- **실패 항목 존재 시:** `src/config/defaults.js`를 수정하고 `research-E.md`를 업데이트한 후 재테스트.
