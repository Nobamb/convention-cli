# Phase C Commit Preview Agent Test

`research-C.md` 기준으로 커밋 메시지 미리보기가 commit 전 단계에서 안전하게 동작하는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| C-V-1 | preview UI 함수 존재 | `src/utils/ui.js` 확인 | `previewCommitMessage()` 또는 동등한 함수가 존재한다. |
| C-V-2 | commit flow 연결 | `src/commands/commit.js` 확인 | AI 메시지 생성 후, `git add` 전 preview가 호출된다. |
| C-V-3 | diff 원문 출력 금지 | preview 관련 코드 확인 | diff 문자열을 logger나 console로 직접 출력하지 않는다. |
| C-V-4 | batch/step 공통 사용 | commit flow 확인 | batch와 step 모두 같은 preview 구조를 재사용한다. |

## 2. 기능 테스트 항목

### C-T-1: batch preview 출력

- **준비:** 격리된 Git 저장소에 변경 파일 1개를 만든다.
- **실행:** mock provider 설정으로 `convention --batch`를 실행하고 commit 직전 입력 단계에서 중단한다.
- **예상 결과:** 생성된 커밋 메시지와 변경 파일 목록이 출력되고, 아직 commit은 생성되지 않는다.

### C-T-2: step preview 출력

- **준비:** 격리된 Git 저장소에 변경 파일 2개를 만든다.
- **실행:** `convention --step`을 실행한다.
- **예상 결과:** 파일별 또는 step 단위 메시지 preview가 출력된다.

### C-T-3: provider/model 정보 표시

- **준비:** config에 `provider: "mock"`, `modelVersion` 값을 설정한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** provider와 model 정보가 표시되며 config 원문은 출력되지 않는다.

### C-T-4: diff 원문 미출력

- **준비:** 변경 파일 내용에 `TOKEN=sample` 같은 민감 패턴을 포함한다.
- **실행:** preview 단계까지 실행한다.
- **예상 결과:** diff 원문과 민감 문자열이 preview에 출력되지 않는다.

### C-T-5: 사용자 승인 전 commit 미실행

- **준비:** 변경사항이 있는 격리 저장소를 만든다.
- **실행:** preview 이후 Cancel 또는 No를 선택한다.
- **예상 결과:** git log에 새 commit이 생기지 않는다.

## 3. 테스트 절차

1. 테스트용 임시 Git 저장소를 생성한다.
2. mock provider를 사용해 외부 네트워크 호출을 막는다.
3. stdout을 캡처해 preview 출력 항목을 확인한다.
4. git log/status로 commit 여부를 검증한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** commit 전 preview 구조가 안전하게 동작함.
- **실패 항목 존재 시:** commit 실행 순서와 출력 보안 정책을 먼저 수정한다.

