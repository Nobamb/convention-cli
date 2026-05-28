# FIX-RS. convention --reset 개편 테스트 계획

## 테스트 목표

FIX-RS 테스트는 `convention --reset`이 마지막 convention 실행 단위를 안전하게 되돌리는지 검증한다.

중점 검증 항목은 다음과 같다.

- transaction 상태 파일 저장과 로드
- 상태 파일 schema 검증
- commit flow에서 commit hash와 파일 목록 기록
- `convention --reset`의 정상 reset 흐름
- 상태 없음 또는 HEAD 불일치 시 자동 reset 중단
- `git reset --hard` 미사용
- secret, raw diff, Git stderr 원문 미출력
- 격리된 임시 Git 저장소에서만 reset 테스트 수행

## reset state 모듈 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 상태 파일 경로 계산 | 임시 Git 저장소 생성 | `.git/convention/last-run.json` 경로를 반환한다. |
| 상태 파일 없음 | `.git/convention/last-run.json` 없음 | `loadLastConventionRun()`이 `null`을 반환한다. |
| 정상 상태 저장 | 유효한 transaction 입력 | 상태 파일이 생성되고 다시 로드할 수 있다. |
| 기존 상태 덮어쓰기 | 상태 파일이 이미 존재 | 최신 transaction으로 교체된다. |
| 상태 삭제 | 상태 파일 존재 | `clearLastConventionRun()` 후 상태 파일이 없어지거나 archive로 이동한다. |
| 깨진 JSON | 잘못된 JSON 파일 작성 | reset이 진행되지 않고 안전한 오류로 중단된다. |
| schemaVersion 누락 | `schemaVersion` 없음 | invalid state로 처리한다. |
| invalid beforeHead | 40자리 hash가 아님 | invalid state로 처리하고 reset하지 않는다. |
| invalid afterHead | 40자리 hash가 아님 | invalid state로 처리하고 reset하지 않는다. |
| invalid commit hash | commits 내부 hash가 잘못됨 | invalid state로 처리하고 reset하지 않는다. |
| commits 빈 배열 | `commits: []` | reset 대상 없음으로 처리하고 reset하지 않는다. |
| files 타입 오류 | `files`가 문자열 또는 객체 | invalid state로 처리한다. |

## Git helper 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 현재 HEAD 조회 | 임시 repo에 commit 1개 생성 | `getCurrentHead()`가 40자리 commit hash를 반환한다. |
| mixed reset 실행 | commit 2개 생성 후 첫 hash로 reset | HEAD가 지정 hash로 이동하고 변경사항은 working tree에 남는다. |
| invalid hash 차단 | `HEAD~1`, `main`, `abc`, `--hard` 입력 | `resetToCommit()`이 Git 명령을 실행하지 않고 오류 처리한다. |
| argv 배열 사용 | git wrapper mock | `execFileSync("git", ["reset", hash])` 형태로 호출된다. |
| stderr 원문 차단 | git reset 실패 mock | Git stderr 원문을 그대로 출력하지 않는다. |

## commit flow transaction 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| batch commit 1개 | 변경 파일 여러 개, batch 모드 | transaction에 commit 1개와 전체 파일 목록이 저장된다. |
| step commit N개 | 변경 파일 N개, step 모드 | transaction에 실제 성공한 commit N개가 저장된다. |
| step 일부 cancel | 중간 파일에서 사용자 cancel | 성공한 commit만 transaction에 저장된다. |
| commit 실패 | git commit 실패 mock | 실패한 commit은 transaction에 기록되지 않는다. |
| commit 0개 | 변경 없음 또는 모두 cancel | `last-run.json`을 새로 저장하지 않는다. |
| 기존 기록 보호 | commit 0개 실행 | 이전 정상 `last-run.json`을 덮어쓰지 않는다. |
| message 저장 범위 | commit message 포함 | message는 commit 요약만 저장되고 diff/prompt는 저장되지 않는다. |
| 파일 경로 저장 범위 | 파일 목록 기록 | 저장소 내부 상대 경로만 저장한다. |

## reset command 정상 흐름 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| batch reset | batch commit 1개와 정상 state | `convention --reset` 1회로 `beforeHead`로 돌아간다. |
| step reset | step commit 3개와 정상 state | `convention --reset` 1회로 3개 commit이 모두 취소된다. |
| 변경사항 유지 | reset 대상 commit에 파일 변경 포함 | reset 후 변경사항이 working tree에 남는다. |
| preview 출력 | 정상 state 로드 | 되돌릴 commit 목록과 파일 목록을 보여준다. |
| 사용자 confirm yes | confirm true mock | `resetToCommit(beforeHead)`가 호출된다. |
| 사용자 confirm no | confirm false mock | reset 명령이 호출되지 않는다. |
| reset 성공 후 state 정리 | reset 성공 | `last-run.json`이 삭제되거나 reset archive로 이동한다. |
| reset 실패 | git reset 실패 mock | state를 삭제하지 않고 안전한 오류를 출력한다. |

## reset command 방어 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| state 없음 | `.git/convention/last-run.json` 없음 | `HEAD~1` fallback 없이 중단한다. |
| HEAD 불일치 | state.afterHead 이후 사용자 commit 추가 | 자동 reset을 중단한다. |
| beforeHead 존재하지 않음 | 유효 형식이지만 repo에 없는 hash | reset 실패를 안전하게 처리한다. |
| afterHead 형식 오류 | 잘못된 state | reset 명령을 실행하지 않는다. |
| commits 형식 오류 | 잘못된 state | reset 명령을 실행하지 않는다. |
| Git 저장소 아님 | 일반 임시 디렉터리 | reset을 실행하지 않고 안내한다. |
| pushed commit | remote가 있어도 push 여부 기록 존재 | remote rewrite 없이 local reset만 시도한다. |
| legacy fallback 금지 | state 없음 | `resetLastCommit()` 또는 `git reset HEAD~1`이 호출되지 않는다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| state에 secret 미저장 | diff에 `API_KEY=abc` 포함 후 commit | `last-run.json`에 secret 원문이 없다. |
| raw diff 미저장 | 큰 diff 포함 | 상태 파일에 diff 본문이 없다. |
| prompt 미저장 | AI provider 사용 | 상태 파일에 prompt 원문이 없다. |
| AI 응답 원문 미저장 | provider 응답 mock | commit message 외 AI 원문 전체가 저장되지 않는다. |
| credentials 미저장 | provider credentials 설정 | 상태 파일에 API Key, token, Authorization 값이 없다. |
| stderr redaction | Git 실패 stderr에 token 포함 | stdout/stderr/logger에 token 원문이 없다. |
| hard reset 금지 | 코드 문자열 검색 | `git reset --hard` 또는 `["reset", "--hard"]`가 없다. |
| shell 문자열 금지 | git wrapper mock 또는 코드 검색 | `execSync("git reset ...")` 형태가 없다. |

## CLI 및 help 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `convention --reset` help | `node bin/convention.js --help` | 마지막 convention 실행 단위 reset 정책이 표시된다. |
| 상태 없음 안내 | reset 실행 | `git reset HEAD~1`을 자동 실행하지 않는다는 안내가 나온다. |
| HEAD 불일치 안내 | afterHead와 현재 HEAD 다름 | 수동으로 `git log` 확인 후 reset하라는 안내가 나온다. |
| working tree 유지 안내 | 정상 reset preview | 변경사항이 working tree에 남는다는 문구가 표시된다. |
| confirm 필수 | interactive mock | confirm 없이 reset이 실행되지 않는다. |

## 문서 정합성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `init/00_rule.md` 갱신 | reset 규칙 확인 | transaction 기반 reset 허용 조건이 명시된다. |
| `AGENTS.md` 갱신 | reset 규칙 확인 | `HEAD~1`만 허용한다는 기존 문구가 개편 정책과 충돌하지 않는다. |
| help 문구 갱신 | CLI help 확인 | 사용자에게 실제 reset 범위가 명확히 안내된다. |
| dangerous 검토 | 보안 리뷰 문서 확인 | 자동 fallback, HEAD 불일치, secret 저장 문제가 위험 항목으로 점검된다. |

## 통합 테스트 시나리오

### 시나리오 1. batch 실행 후 reset

1. 임시 Git 저장소를 만든다.
2. initial commit을 만든다.
3. 파일 2개를 수정한다.
4. batch 모드로 convention commit을 만든다.
5. `last-run.json`에 commit 1개가 기록되는지 확인한다.
6. `convention --reset`을 실행한다.
7. HEAD가 `beforeHead`로 돌아가는지 확인한다.
8. 수정 파일 2개가 working tree에 남는지 확인한다.

### 시나리오 2. step 실행 후 reset

1. 임시 Git 저장소를 만든다.
2. initial commit을 만든다.
3. 파일 3개를 수정한다.
4. step 모드로 파일별 commit 3개를 만든다.
5. `last-run.json`에 commit 3개가 기록되는지 확인한다.
6. `convention --reset`을 한 번만 실행한다.
7. HEAD가 step 실행 전 `beforeHead`로 돌아가는지 확인한다.
8. 파일 3개의 변경사항이 working tree에 남는지 확인한다.

### 시나리오 3. convention 이후 사용자 commit 추가

1. convention 실행으로 commit을 만든다.
2. 상태 파일의 `afterHead`를 확인한다.
3. 사용자가 직접 commit을 하나 더 만든다.
4. `convention --reset`을 실행한다.
5. 현재 HEAD가 `afterHead`와 다르므로 reset이 중단되는지 확인한다.
6. 사용자 commit이 유지되는지 확인한다.

### 시나리오 4. 상태 파일 없음

1. 임시 Git 저장소를 만든다.
2. commit을 여러 개 만든다.
3. `.git/convention/last-run.json`이 없는 상태로 둔다.
4. `convention --reset`을 실행한다.
5. `HEAD~1` fallback 없이 중단되는지 확인한다.
6. HEAD가 변경되지 않았는지 확인한다.

## 권장 테스트 명령

구현 후 실행할 명령 후보는 다음과 같다.

```bash
node --test tests/reset-phase-fix-rs.test.js
npm test
node --check src/core/resetState.js
node --check src/core/git.js
node --check src/commands/reset.js
```

문서 작업만 수행한 현재 단계에서는 코드 테스트를 실행할 필요는 없다.

## 완료 기준

- transaction 상태 파일의 저장, 로드, 검증, 삭제가 테스트된다.
- batch와 step 모드에서 마지막 convention 실행 전체가 reset되는지 테스트된다.
- 상태 없음, HEAD 불일치, invalid state에서 자동 reset이 중단되는지 테스트된다.
- reset 후 변경사항이 working tree에 남는지 테스트된다.
- `HEAD~1` fallback과 `--hard` reset이 사용되지 않는지 테스트된다.
- secret, raw diff, prompt, credentials가 상태 파일이나 로그에 노출되지 않는지 테스트된다.
- 모든 reset 테스트는 실제 사용자 저장소가 아니라 임시 Git 저장소에서만 수행된다.
