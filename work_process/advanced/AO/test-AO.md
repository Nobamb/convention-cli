# AO. Non-interactive Mode Agent 테스트 계획

## 테스트 목표

`--yes`와 `--no-interactive` 옵션이 prompt 호출 없이 안전하게 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- CLI 옵션 파싱
- prompt 호출 금지
- `--yes` 승인 정책
- `--no-interactive` 실패 정책
- 보안 gate 유지

## CLI 옵션 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| yes 옵션 | `node bin/convention.js --batch --yes` | options에 `yes: true`가 전달된다. |
| no-interactive 옵션 | `node bin/convention.js --batch --no-interactive` | options에 `interactive: false`가 전달된다. |
| 둘 다 사용 | `node bin/convention.js --batch --yes --no-interactive` | prompt 없이 승인 가능한 경로로 진행한다. |
| help 출력 | `node bin/convention.js --help` | 새 옵션 설명이 포함된다. |
| 기존 옵션 유지 | `node bin/convention.js --set-mode batch` | commit flow를 실행하지 않는다. |

## commit flow 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| no-interactive만 사용 | confirm 필요 | `git commit` 없이 명확한 오류로 실패한다. |
| yes 사용 | confirm 필요, 안전 diff | prompt 없이 `git commit` 호출 경로로 진행한다. |
| yes + sensitive diff | diff에 `TOKEN=` 포함 | 외부 전송 또는 commit 전 보안 정책에 따라 중단한다. |
| AI 응답 빈 값 | provider mock이 빈 문자열 반환 | prompt 재입력 없이 실패한다. |
| provider 누락 | config provider 없음 | model setup prompt 없이 실패한다. |

## prompt 호출 방지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| confirmAction mock | `--no-interactive` | confirm prompt 함수가 호출되지 않는다. |
| selectProvider mock | provider 누락, `--no-interactive` | provider 선택 UI가 호출되지 않는다. |
| manual edit mock | edit 필요 상태 | 수동 입력 UI가 호출되지 않는다. |
| regenerate choice mock | preview decision 필요 상태 | 선택 UI가 호출되지 않는다. |

## CI 조합 테스트

| 케이스 | env/명령 | 기대 결과 |
| --- | --- | --- |
| CI + no-interactive | `CI=true --batch --no-interactive` | prompt 없이 실행 또는 안전 실패한다. |
| CI + yes | `CI=true --batch --yes --no-interactive` | 승인 가능한 경우 commit flow가 진행된다. |
| GitHub Actions + yes | `GITHUB_ACTIONS=true --batch --yes` | interactive prompt 없이 진행한다. |
| 로컬 + yes | env 없음, `--yes` | 명시 승인으로 처리하되 보안 gate는 유지된다. |

## PR flow 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| print only | `--pr --print-only --no-interactive` | PR 제목/본문을 출력하고 생성하지 않는다. |
| create without yes | `--pr --no-interactive` | `gh pr create`를 호출하지 않고 실패 또는 안내한다. |
| create with yes | `--pr --yes --no-interactive` | 필요한 값이 모두 있으면 생성 경로로 진행한다. |
| remote 부족 | remote 없음 | remote 입력 prompt 없이 명확한 오류를 출력한다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| yes가 scan 우회하지 않음 | sensitive diff mock | secret scan이 호출된다. |
| 외부 전송 정책 유지 | cloud provider mock | 전송 정책이 불명확하면 중단한다. |
| token 출력 방지 | env에 token 포함 | stdout/stderr에 token 원문이 없다. |
| raw provider 응답 방지 | provider raw response mock | 전체 원문이 로그에 출력되지 않는다. |
| reset 자동 승인 방지 | reset flow mock | reset 고유 confirm 정책을 유지한다. |

## 완료 기준

- `--yes`, `--no-interactive` 옵션이 테스트된다.
- 비대화형 모드에서 prompt 호출이 없는 것이 검증된다.
- `--no-interactive`가 자동 승인으로 동작하지 않는 것이 검증된다.
- `--yes`가 보안 gate를 우회하지 않는 것이 검증된다.
