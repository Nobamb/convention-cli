# Phase 3 / P Grouping Preview Agent Test

`research-P.md` 기준으로 grouping preview가 사용자에게 안전하게 표시되고, 사용자의 선택이 commit flow에 올바르게 전달되는지 검증합니다. 이 단계의 핵심은 그룹 승인 전과 최종 commit confirm 전에는 어떤 Git 히스토리 변경도 일어나지 않는다는 점입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| P-V-1 | grouping preview UI 함수 존재 | `src/utils/ui.js` 확인 | `previewGroups()`, `selectGroupingDecision()` 또는 동등한 함수가 존재한다. |
| P-V-2 | decision 반환값 표준화 | UI 함수 반환값 확인 | `accept`, `edit`, `batch`, `cancel` 중 하나로 분기 가능하다. |
| P-V-3 | commit flow 연결 위치 | `src/commands/commit.js` 확인 | 그룹 생성 이후, 그룹별 commit message 생성 및 Git 작업 이전에 preview가 호출된다. |
| P-V-4 | Yes 의미 분리 | 분기 로직 확인 | `Yes` 선택 직후 바로 `git add` 또는 `git commit`을 호출하지 않는다. |
| P-V-5 | batch 전환 | 분기 로직 확인 | `Use batch instead` 선택 시 기존 batch flow로 전환한다. |
| P-V-6 | cancel 안전성 | 분기 로직 확인 | `Cancel` 선택 시 Git 작업 없이 종료한다. |
| P-V-7 | secret 출력 방지 | logger/UI 출력 확인 | diff 원문, secret, token, credentials 내용이 preview에 포함되지 않는다. |

## 2. 기능 테스트 체크리스트

### P-T-1: 그룹 preview 출력

- **준비:** 다음 그룹 목록을 mock으로 전달합니다.

```javascript
[
  {
    groupName: "login-feature",
    type: "feat",
    files: ["src/auth/login.js", "src/pages/LoginPage.jsx"]
  },
  {
    groupName: "docs-update",
    type: "docs",
    files: ["README.md"]
  }
]
```

- **실행:** grouping preview UI 함수를 호출합니다.
- **예상 결과:** 그룹 번호, type, groupName, 파일 목록이 표시됩니다.
- **안전 확인:** diff 원문은 출력되지 않습니다.

### P-T-2: Yes 선택 시 grouped flow로 진행

- **준비:** decision UI가 `accept`를 반환하도록 mock 처리합니다.
- **실행:** grouping commit flow를 실행합니다.
- **예상 결과:** 그룹 목록이 grouped commit flow로 전달됩니다.
- **안전 확인:** 이 시점에서 즉시 `git add`, `git commit`, `git push`가 호출되지 않고, 이후 그룹별 commit message preview와 confirm을 기다립니다.

### P-T-3: Edit manually 선택 시 편집 흐름으로 진행

- **준비:** decision UI가 `edit`을 반환하도록 mock 처리합니다.
- **실행:** grouping commit flow를 실행합니다.
- **예상 결과:** 수동 편집 함수 또는 편집 placeholder 흐름이 호출됩니다.
- **검증:** 편집된 그룹이 빈 그룹, 중복 파일, 누락 파일 없이 반환되어야 합니다.
- **안전 확인:** 편집 완료만으로 commit하지 않고 이후 preview/confirm을 다시 거칩니다.

### P-T-4: Use batch instead 선택 시 batch flow로 전환

- **준비:** decision UI가 `batch`를 반환하도록 mock 처리합니다.
- **실행:** grouping commit flow를 실행합니다.
- **예상 결과:** grouped commit flow는 중단되고 기존 `runBatchCommit()` 또는 동등한 batch flow가 호출됩니다.
- **안전 확인:** batch flow에서도 기존 commit message preview와 사용자 confirm 전에는 commit하지 않습니다.

### P-T-5: Cancel 선택 시 안전 종료

- **준비:** decision UI가 `cancel`을 반환하도록 mock 처리합니다.
- **실행:** grouping commit flow를 실행합니다.
- **예상 결과:** 취소 메시지를 출력하고 종료합니다.
- **안전 확인:** `git add`, `git commit`, `git push`가 호출되지 않습니다.

### P-T-6: 빈 그룹 목록 처리

- **준비:** grouping 결과가 `[]`가 되도록 mock 처리합니다.
- **실행:** grouping preview 단계로 진입합니다.
- **예상 결과:** 명확한 오류 또는 안내 메시지를 출력하고 종료합니다.
- **안전 확인:** batch fallback이나 commit을 조용히 실행하지 않습니다.

### P-T-7: 빈 파일 그룹 처리

- **준비:** `files: []`인 그룹이 포함된 grouping 결과를 전달합니다.
- **실행:** grouping preview 또는 그룹 검증 함수를 실행합니다.
- **예상 결과:** 빈 그룹을 거부하거나 수동 편집을 요구합니다.
- **안전 확인:** 빈 그룹으로 commit message 생성 또는 Git 작업을 진행하지 않습니다.

### P-T-8: 중복 파일 검증

- **준비:** 같은 파일이 두 개 이상의 그룹에 포함되도록 mock 처리합니다.
- **실행:** grouping preview 또는 그룹 검증 함수를 실행합니다.
- **예상 결과:** 중복 파일 오류로 중단합니다.
- **안전 확인:** 어떤 그룹도 commit되지 않습니다.

### P-T-9: 누락 파일 검증

- **준비:** changed file 목록에는 존재하지만 어떤 그룹에도 포함되지 않은 파일을 만듭니다.
- **실행:** 그룹 검증 함수를 실행합니다.
- **예상 결과:** 누락 파일 오류로 중단합니다.
- **안전 확인:** batch로 조용히 fallback하지 않고 사용자에게 명확히 알립니다.

### P-T-10: diff 및 secret 출력 방지

- **준비:** 파일 diff에 `SECRET_SENTINEL=do-not-print`, `API_KEY=do-not-print` 같은 sentinel 문자열을 포함합니다.
- **실행:** grouping preview와 실패 케이스를 실행하고 stdout/stderr/logger 호출을 캡처합니다.
- **예상 결과:** 출력에는 파일 경로와 그룹 metadata만 포함됩니다.
- **안전 확인:** sentinel 문자열, diff hunks, credentials 원문이 출력되지 않습니다.

### P-T-11: interactive prompt 실패 처리

- **준비:** UI prompt가 예외를 던지도록 mock 처리합니다.
- **실행:** grouping preview flow를 실행합니다.
- **예상 결과:** 안전한 오류 메시지를 출력하고 종료합니다.
- **안전 확인:** Git 작업이 호출되지 않습니다.

### P-T-12: 비대화형 환경 처리

- **준비:** CI 또는 non-interactive 환경을 mock 처리합니다.
- **실행:** grouping preview가 필요한 flow를 실행합니다.
- **예상 결과:** 정책상 허용된 옵션이 없으면 명확한 오류로 중단합니다.
- **안전 확인:** prompt 없이 자동으로 Yes 처리하지 않습니다.

## 3. 통합 테스트 시나리오

1. 격리된 테스트 Git 저장소를 준비합니다.
2. 서로 다른 목적의 변경 파일을 2개 이상 만듭니다.
3. grouping 결과를 mock하여 preview 단계로 전달합니다.
4. `Yes` 선택 시 grouped commit flow로만 넘어가고, 최종 commit confirm 전에는 commit되지 않는지 확인합니다.
5. `Edit manually` 선택 시 편집 결과 검증이 수행되는지 확인합니다.
6. `Use batch instead` 선택 시 기존 batch preview/confirm flow가 유지되는지 확인합니다.
7. `Cancel` 선택 시 working tree와 Git history가 변경되지 않는지 확인합니다.
8. 전체 회귀 테스트로 `npm test`를 실행합니다.

## 4. 검증 결과 요약 기준

- **모든 항목 통과:** 그룹 preview와 사용자 선택 분기가 안전하게 동작하고, 최종 승인 전 Git 히스토리가 변경되지 않습니다.
- **실패 항목 존재:** Git 작업 호출 시점, secret 출력, batch fallback, edit 검증 누락을 우선 수정합니다.

## 5. 보안 확인

- preview에는 파일 경로와 grouping metadata만 표시합니다.
- diff 원문, provider 응답 원문, secret 후보 문자열을 출력하지 않습니다.
- `Yes`는 그룹 구성 승인일 뿐 commit 승인으로 취급하지 않습니다.
- commit은 그룹별 commit message preview와 confirm 이후에만 가능합니다.
- `Cancel`, prompt 실패, 그룹 검증 실패 시 Git 작업을 수행하지 않습니다.
