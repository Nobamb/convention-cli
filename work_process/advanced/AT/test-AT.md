# AT. Regression Test Agent 테스트 계획

## 테스트 목표

3차 고도화 이후에도 1차·2차 MVP 명령과 안전 정책이 유지되는지 검증한다.

중점 검증 항목은 다음과 같다.

- 기본 commit flow 회귀
- config 명령 회귀
- provider/model 명령 회귀
- localLLM/API Key provider 회귀
- push/reset 회귀
- confirm 및 보안 gate 회귀

## 1차 MVP 명령 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| 기본 실행 | `node bin/convention.js` | config mode에 따라 step 또는 batch flow를 실행한다. |
| step 우선 | `node bin/convention.js --step` | 저장된 mode와 무관하게 step flow를 실행한다. |
| batch 우선 | `node bin/convention.js --batch` | 저장된 mode와 무관하게 batch flow를 실행한다. |
| help | `node bin/convention.js --help` | commit flow를 실행하지 않고 도움말을 출력한다. |
| short help | `node bin/convention.js -h` | commit flow를 실행하지 않고 도움말을 출력한다. |

## config 명령 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| set mode step | `--set-mode step` | config mode가 `step`으로 저장된다. |
| set mode batch | `--set-mode batch` | config mode가 `batch`로 저장된다. |
| invalid mode | `--set-mode fast` | 명확한 오류를 출력하고 저장하지 않는다. |
| language ko/en/jp/cn | `--language <lang>` | config language가 저장된다. |
| invalid language | `--language fr` | 명확한 오류를 출력하고 저장하지 않는다. |

## commit flow 회귀 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| Git repo 아님 | temp dir | Git 저장소 오류를 출력한다. |
| 변경 없음 | clean fixture repo | commit을 실행하지 않고 안내한다. |
| mock provider | provider null 또는 mock | `chore: update project files` 또는 mock 응답을 사용한다. |
| confirm 거절 | confirm false mock | `git add`와 `git commit`이 호출되지 않는다. |
| confirm 승인 | confirm true mock | `git add` 후 `git commit`이 호출된다. |

## 2차 MVP provider 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `--model` 대화형 | UI mock | provider 선택 flow가 호출된다. |
| `--model mock` | provider 인자 | config provider가 `mock`으로 저장된다. |
| unsupported provider | 잘못된 provider | mock fallback 없이 오류로 중단한다. |
| localLLM list | fetch mock | `/v1/models` 결과를 model 목록으로 변환한다. |
| API Key 저장 | secret prompt mock | credentials에 저장하고 원문을 출력하지 않는다. |

## push/reset 회귀 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| push after commit | commit 성공 mock | commit 이후 `git push`가 호출된다. |
| push failure | git stderr mock | token/remote secret 없이 오류를 출력한다. |
| reset confirm 거절 | transaction 기록 있음 | reset을 실행하지 않는다. |
| reset 기록 없음 | transaction 없음 | 자동 reset을 중단한다. |
| reset HEAD 불일치 | current HEAD != afterHead | reset을 중단한다. |
| reset 정상 | current HEAD == afterHead | `git reset <beforeHead>`만 호출한다. |

## 보안 회귀 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| `git reset --hard` | 호출되지 않는다. |
| shell 문자열 Git 명령 | 사용자 입력을 shell 문자열에 삽입하지 않는다. |
| credentials 출력 | 원문이 stdout/stderr에 없다. |
| diff secret | 외부 provider 호출 전 보안 gate가 동작한다. |
| confirm 없는 commit | 실행되지 않는다. |

## 완료 기준

- 1차·2차 MVP 명령이 기존 우선순위와 동일하게 동작한다.
- 3차 기능이 기존 commit, provider, push, reset 흐름을 깨지 않는다.
- 실제 사용자 저장소, 실제 remote, 실제 외부 provider를 사용하지 않는다.
- 회귀 실패가 명확한 테스트 이름과 기대 결과로 추적된다.
