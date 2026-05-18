# Phase 3 / Q Grouped Commit Flow Agent Test

`research-Q.md` 기준으로 그룹별 diff 추출, prompt 생성, AI commit message 생성, preview/confirm, 그룹 파일 staging, 그룹 commit이 안전하게 연결되는지 검증합니다. 모든 Git 히스토리 변경 테스트는 실제 사용자 저장소가 아니라 `fixtures/test-repo` 또는 임시 테스트 저장소에서만 수행합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| Q-V-1 | grouped commit orchestration 존재 | `src/commands/commit.js` 확인 | `runGroupedCommit()` 또는 동등한 함수가 그룹 배열을 순차 처리한다. |
| Q-V-2 | 그룹 파일 diff 사용 | 구현 확인 | 그룹별로 `getFileDiffs(group.files)` 또는 동등한 안전 wrapper를 사용한다. |
| Q-V-3 | 그룹별 prompt 생성 | 구현 확인 | 각 그룹 diff 또는 마스킹된 safe diff로 commit prompt를 만든다. |
| Q-V-4 | confirm gate 유지 | 구현 확인 | preview/confirm 이전에는 `git add`, `git commit`이 호출되지 않는다. |
| Q-V-5 | 그룹 파일만 staging | 구현 확인 | grouped flow에서 `git add -A`를 사용하지 않고 그룹 파일만 `addFile(file)` 처리한다. |
| Q-V-6 | push 분리 | 구현 확인 | `--push`가 없는 grouped flow는 push를 호출하지 않는다. |
| Q-V-7 | raw diff logging 금지 | logger/error 호출부 확인 | raw diff, prompt 원문, provider 응답 원문 전체를 출력하지 않는다. |

## 2. 기능 테스트 항목

### Q-T-1: 단일 그룹 정상 commit

- **준비:** 임시 Git 저장소에 변경 파일 2개를 만들고 하나의 그룹에 포함한다.
- **실행:** grouped commit flow를 실행하고 confirm을 승인으로 mock 처리한다.
- **예상 결과:** 그룹 파일 2개만 staging된 뒤 하나의 commit이 생성된다. commit message는 정리된 AI 응답을 사용한다.

### Q-T-2: 여러 그룹 순차 commit

- **준비:** source 그룹과 docs 그룹을 각각 다른 파일로 구성한다.
- **실행:** 두 그룹 모두 confirm 승인으로 처리한다.
- **예상 결과:** commit이 2개 생성되고, 각 commit에는 자기 그룹 파일만 포함된다.

### Q-T-3: 중간 그룹 취소

- **준비:** 그룹 3개를 만들고 1번과 3번은 승인, 2번은 취소로 mock 처리한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 1번과 3번 그룹만 commit되고 2번 그룹 파일은 commit되지 않는다. 취소된 그룹에서 `git add`와 `git commit`은 호출되지 않는다.

### Q-T-4: 첫 그룹 commit 후 두 번째 그룹 실패

- **준비:** 1번 그룹 commit은 성공시키고 2번 그룹 commit은 실패하도록 git wrapper를 mock 처리한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 1번 commit은 유지된다. 2번 실패 후 자동 rollback은 수행하지 않는다. 결과 또는 에러 메시지에 non-atomic caveat이 반영된다.

### Q-T-5: 그룹 diff가 비어 있음

- **준비:** 그룹 파일 목록은 있지만 diff가 없는 파일을 포함한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** provider 호출 없이 해당 그룹을 건너뛰거나 안전하게 중단한다. 빈 diff로 commit을 생성하지 않는다.

### Q-T-6: 그룹 목록이 비어 있음

- **준비:** 그룹 배열을 빈 배열로 전달한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** AI 호출, git add, git commit 없이 명확한 메시지로 종료한다.

### Q-T-7: 중복 파일이 여러 그룹에 포함됨

- **준비:** 같은 파일이 두 그룹에 포함되도록 구성한다.
- **실행:** grouped commit flow를 시작한다.
- **예상 결과:** 시작 전에 검증 오류로 중단하거나 재그룹화 안내를 표시한다. 어느 그룹도 commit하지 않는다.

### Q-T-8: 민감 파일 제외

- **준비:** `.env`, `credentials.json`, 일반 소스 파일을 같은 그룹에 포함한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 민감 파일 diff는 AI prompt에 포함되지 않으며, 별도 사용자 confirm이 없으면 민감 파일은 `addFile(file)` 및 commit 대상에서도 제외된다. 민감 파일 제외 사실은 요약 수준으로만 안내하고 원문은 출력하지 않는다.

### Q-T-9: secret 패턴 마스킹

- **준비:** 일반 파일 diff 안에 `API_KEY=SECRET_SENTINEL` 같은 sentinel을 넣는다.
- **실행:** grouped commit flow를 실행하고 provider prompt 및 logger 출력을 spy 처리한다.
- **예상 결과:** provider로 전달되는 값은 정책에 따라 마스킹 또는 전송 차단된다. stdout, stderr, logger에 `SECRET_SENTINEL`이 출력되지 않는다.

### Q-T-10: 외부 provider 전송 확인 정책

- **준비:** provider를 외부 AI provider로 설정하고 전송 확인 정책이 없는 상태를 만든다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** provider 호출 전에 중단하거나 사용자 confirm을 요구한다. 확인 전에는 diff가 외부 provider로 전송되지 않는다.

### Q-T-11: AI 응답이 비어 있음

- **준비:** provider가 빈 문자열 또는 공백만 반환하도록 mock 처리한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** preview/commit으로 진행하지 않고 해당 그룹 commit을 중단한다.

### Q-T-12: Conventional Commits 형식 검증

- **준비:** provider가 `update files`처럼 type이 없는 메시지를 반환하도록 mock 처리한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 형식 검증 또는 cleanup 정책에 따라 수정 요청, 재생성, 중단 중 하나로 처리되며 잘못된 메시지로 commit하지 않는다.

### Q-T-13: confirm 이전 Git 작업 없음

- **준비:** `addFile`, `commit`, `push`를 spy 처리하고 confirm을 취소로 mock 처리한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** preview는 표시되지만 `addFile`, `commit`, `push`는 호출되지 않는다.

### Q-T-14: `--push` 없는 기본 실행

- **준비:** 모든 그룹 commit은 성공하도록 구성하고 push wrapper를 spy 처리한다.
- **실행:** push 옵션 없이 grouped commit flow를 실행한다.
- **예상 결과:** commit 이후에도 push는 호출되지 않는다.

### Q-T-15: `--push` 명시 실행

- **준비:** 모든 그룹 commit 성공 후 push confirm을 승인으로 mock 처리한다.
- **실행:** `--push` 옵션과 함께 grouped commit flow를 실행한다.
- **예상 결과:** 그룹 commit이 모두 끝난 뒤 별도 confirm gate 이후 push가 1회 호출된다.

### Q-T-16: 일부 그룹만 commit된 상태의 push 확인

- **준비:** 1번 그룹 commit 성공, 2번 그룹 취소 상태에서 `--push`를 지정한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 일부 그룹만 commit되었다는 요약을 보여준 뒤 push 여부를 별도로 확인한다. confirm 없이는 push하지 않는다.

### Q-T-17: push 실패 시 민감정보 비노출

- **준비:** push 실패 stderr에 token 형태의 sentinel을 포함하도록 mock 처리한다.
- **실행:** `--push` grouped flow를 실행한다.
- **예상 결과:** 실패 메시지는 표시되지만 token sentinel, 인증 포함 remote URL, raw stderr는 출력되지 않는다.

### Q-T-18: raw diff 로그 노출 방지

- **준비:** diff에 `RAW_DIFF_SENTINEL`과 `SECRET_SENTINEL`을 넣고 logger 출력을 spy 처리한다.
- **실행:** 성공 및 실패 케이스를 각각 실행한다.
- **예상 결과:** stdout, stderr, logger 호출 인자에 sentinel 값이 포함되지 않는다.

### Q-T-19: staged 상태 오염 방지

- **준비:** 그룹 외 파일이 이미 staged된 상태를 만든다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 구현 정책에 따라 시작 전에 staged 상태를 감지해 중단하거나, 그룹 파일만 commit되도록 보장한다. 그룹 외 staged 파일이 의도치 않게 commit되면 실패로 본다.

### Q-T-20: 한글 및 공백 포함 파일명

- **준비:** `문서 수정.md`, `src/file with space.js`를 그룹 파일에 포함한다.
- **실행:** grouped commit flow를 실행한다.
- **예상 결과:** 파일 경로가 shell 문자열로 조합되지 않고 인자 배열 방식으로 처리되어 정상 diff/stage/commit된다.

## 3. 통합 테스트 절차

1. `fixtures/test-repo` 또는 임시 디렉터리에 테스트 Git 저장소를 새로 초기화한다.
2. 테스트별로 필요한 파일 변경을 생성한다.
3. provider, confirm UI, push wrapper는 mock 또는 spy로 대체한다.
4. grouped commit flow를 실행한다.
5. `git log --oneline`, `git show --name-only --format=`, `git status --porcelain`으로 결과를 확인한다.
6. stdout, stderr, logger spy에서 raw diff와 secret sentinel이 없는지 확인한다.
7. 기존 회귀 테스트인 `npm test`를 함께 실행한다.

## 4. 검증 결과 요약 기준

- **통과:** 승인된 그룹만 commit되고, 각 commit은 해당 그룹 파일만 포함하며, confirm 전 Git 작업과 기본 push가 발생하지 않는다.
- **실패:** raw diff 또는 secret이 출력되거나, 취소 그룹이 staging/commit되거나, `--push` 없이 push가 실행되면 즉시 수정 대상이다.
- **주의:** grouped commit은 non-atomic flow이므로 중간 실패 시 이전 commit이 유지되는 동작은 정상이다. 단, 이 caveat이 사용자 메시지와 문서에 명확히 반영되어야 한다.
