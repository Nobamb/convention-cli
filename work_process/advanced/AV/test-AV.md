# AV. Documentation Update Agent 테스트 계획

## 테스트 목표

3차 고도화 기능 문서가 실제 기능 범위와 일치하고, 사용자가 문서만 보고 안전하게 실행할 수 있는지 검증한다.

중점 검증 항목은 다음과 같다.

- README 갱신
- model/OAuth/template/PR/GitHub Actions 문서 존재
- 명령 예시 정확성
- 보안 주의사항 포함
- 1차·2차 MVP 설명과의 충돌 방지

## 문서 존재 테스트

| 파일 | 기대 결과 |
| --- | --- |
| `README.md` | 3차 기능 요약과 상세 문서 링크가 있다. |
| `docs/model.md` | provider, localLLM, API Key/OAuth 설정 설명이 있다. |
| `docs/oauth.md` | OAuth state/PKCE/token 저장 설명이 있다. |
| `docs/templates.md` | template schema와 명령 설명이 있다. |
| `docs/pr.md` | PR 제목/본문 생성과 preview 설명이 있다. |
| `docs/github-actions.md` | CI/GitHub Actions 사용법이 있다. |

## README 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 기본 사용법 | `convention`, `--step`, `--batch` 설명이 유지된다. |
| model 설정 | `--model` 설명 또는 링크가 있다. |
| preview UX | Commit/Regenerate/Edit/Cancel 흐름이 설명된다. |
| push/reset | confirm과 안전 조건이 설명된다. |
| 상세 문서 링크 | docs 문서로 이동할 수 있는 링크가 있다. |

## 기능별 문서 테스트

| 기능 | 확인 항목 | 기대 결과 |
| --- | --- | --- |
| large diff | chunk/summary 개요 | 원본 diff 로그 금지 주의가 있다. |
| grouping | 그룹 제안/preview | batch fallback 또는 cancel 설명이 있다. |
| template | init/show/validate | schema와 fallback 정책이 있다. |
| OAuth | state/PKCE/callback | token 원문 출력 금지 설명이 있다. |
| PR | print-only/create | create 전 preview 또는 confirm 정책이 있다. |
| GitHub Actions | `--no-interactive` | secret/fork PR/permissions 안내가 있다. |

## 명령 예시 검증

| 명령 | 기대 결과 |
| --- | --- |
| `convention --batch` | commit flow 예시로 설명된다. |
| `convention --step` | 파일별 흐름으로 설명된다. |
| `convention --model mock` | provider 설정 예시로 설명된다. |
| `convention --template validate` | template 문서에 설명된다. |
| `convention --pr --print-only --no-interactive` | CI/PR 문서에 안전 예시로 설명된다. |
| `convention --reset` | transaction 기반 reset과 confirm 설명이 있다. |

## 보안 문서 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 실제 secret 없음 | 문서에 실제 token/API Key처럼 보이는 값이 없다. |
| credentials 분리 | `config.json`에 secret 저장 금지 설명이 있다. |
| 외부 provider | diff 전송 전 보안 gate 설명이 있다. |
| CI secret | GitHub Secrets와 fork PR 주의사항이 있다. |
| reset hard 금지 | `git reset --hard` 예시가 없다. |
| npm publish 금지 | 자동 publish 예시가 없다. |

## 49번 최종 검증 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 범위 일치 | 문서가 `init/03_advanced.md`의 3차 범위를 벗어나지 않는다. |
| B~AV 누락 확인 | 각 단계 핵심 기능이 README 또는 docs에 반영된다. |
| 경로 일치 | 문서에 적힌 파일 경로와 명령이 실제 repo 구조와 맞다. |
| MVP 회귀 설명 | 1차·2차 명령 설명이 3차 기능 설명과 충돌하지 않는다. |
| 보안 기준 | confirm, secret, credentials, external diff 정책이 일관된다. |

## 완료 기준

- 3차 고도화 문서가 실제 기능과 일치한다.
- 주요 명령 예시가 정확하고 안전하다.
- 문서에 실제 secret, 위험 명령, 자동 publish 예시가 없다.
- 49번 기준의 범위, 경로, 보안, 회귀 검증 항목이 문서 테스트에 반영된다.
