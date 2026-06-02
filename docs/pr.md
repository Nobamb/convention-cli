# Pull Request 자동화 가이드

이 문서는 `convention --pr`로 PR 제목과 본문을 생성하고, 필요 시 GitHub PR 생성까지 연결하는 방법을 정리합니다.

## 기본 원칙

- PR 제목과 본문은 Git branch metadata, commit log, 변경 파일 목록, 안전한 diff summary를 기반으로 생성합니다.
- raw diff line이나 긴 코드 조각은 PR body에 포함하지 않습니다.
- 원격 PR 생성 전에는 preview 또는 명시 승인 정책을 거칩니다.
- GitHub CLI 인증이 없으면 PR을 생성하지 않고 문서 출력 흐름으로 종료합니다.

## 명령

```bash
convention --pr
convention --pr --base develop
convention --pr --head feature/some-feature
convention --pr --print-only
convention --pr --yes
convention --pr --draft
```

## 옵션

| 옵션 | 설명 |
| --- | --- |
| `--base <branch>` | PR target branch를 지정합니다. |
| `--head <branch>` | PR head branch를 지정합니다. |
| `--remote <name>` | GitHub remote 후보를 지정합니다. |
| `--print-only` | 원격 PR을 만들지 않고 제목/본문만 출력합니다. |
| `--yes` | PR preview/Create 확인을 생략하고 생성 시도를 승인합니다. |
| `--draft` | GitHub PR을 draft 상태로 생성합니다. |

## Preview 선택지

대화형 환경에서는 생성된 PR 문서를 보여준 뒤 다음 선택지를 제공합니다.

- `Create PR`
- `Edit manually`
- `Print only`
- `Cancel`

수동 편집 후에도 PR body cleanup과 안전 검증을 다시 통과해야 합니다.

## GitHub Remote 감지

지원하는 remote 형식:

- `https://github.com/owner/repo.git`
- `git@github.com:owner/repo.git`
- `ssh://git@github.com/owner/repo.git`

remote URL에 credential이 포함되어 있으면 출력 전에 마스킹합니다.

## GitHub CLI

원격 PR 생성에는 `gh` CLI가 필요합니다.

필요 조건:

- `gh` 설치
- `gh auth login` 완료
- target repository에 PR 생성 권한 보유

조건을 만족하지 못하면 CLI는 PR 제목/본문만 출력하고 종료합니다.

## 외부 Provider 전송

Gemini, OpenAI-compatible, remote localLLM, Codex MCP 등 외부 provider로 Git metadata가 전송될 수 있으면 별도 확인이 필요합니다.

`--yes`는 PR 생성 승인일 뿐 외부 provider 전송 동의가 아닙니다.

## 보안 주의사항

- PR title/body에 API Key, token, private key, credentials 원문을 포함하지 않습니다.
- raw diff, provider raw response, credentials JSON 원문을 출력하지 않습니다.
- `.env`, private key, credentials 파일은 분석 대상에서 제외합니다.
- `--print-only`는 CI와 fork PR에서 가장 안전한 기본 흐름입니다.
