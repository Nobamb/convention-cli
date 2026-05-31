# AQ. Workflow Example Agent 구현 계획

## 작업 범위

AQ 단계는 GitHub Actions에서 `convention-cli`를 사용하는 예시 문서를 제공하는 작업이다.

핵심 목표는 사용자가 문서만 보고 CI에서 안전하게 `convention`을 실행할 수 있도록 `docs/github-actions.md`와 `README.md`에 예시를 추가하는 것이다. 예시는 `--pr --print-only --no-interactive` 같은 안전한 출력 중심 흐름을 우선한다.

## 선행 조건

- AN 단계의 CI mode 정책이 정리되어 있다.
- AO 단계의 `--yes`, `--no-interactive` 정책이 정리되어 있다.
- AP 단계의 GitHub Actions output 정책이 정리되어 있다.
- PR 자동화 문서 또는 PR flow가 존재하거나 예정되어 있다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `docs/github-actions.md`
- `README.md`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 문서 구성 계획

`docs/github-actions.md` 권장 구성:

1. 개요
2. CI mode 동작 방식
3. PR 제목/본문 출력 예시
4. commit message output 예시
5. GitHub Actions output 사용 예시
6. secret 설정 주의사항
7. fork PR 주의사항
8. 문제 해결

`README.md`에는 긴 설명 대신 GitHub Actions 문서 링크와 최소 예시만 추가한다.

## 권장 workflow 예시

안전한 기본 예시는 PR을 직접 생성하지 않고 출력만 수행한다.

```yaml
name: Convention CLI

on:
  pull_request:

jobs:
  convention:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g convention-cli

      - run: convention --pr --print-only --no-interactive
```

output 사용 예시:

```yaml
- id: convention
  run: convention --pr --print-only --no-interactive

- run: |
    echo "PR title: ${{ steps.convention.outputs.pr_title }}"
```

실제 output 연결은 AP 단계의 구현 방식에 맞춰 수정해야 한다.

## 문서화할 옵션

- `--no-interactive`: CI에서 prompt를 띄우지 않음
- `--yes`: 명시 승인 옵션이며 보안 gate를 우회하지 않음
- `--print-only`: PR 생성 없이 제목/본문 출력
- `--pr`: PR 제목/본문 생성 흐름
- `--batch`: 하나의 commit message 생성 흐름

## Secret 안내

문서에는 다음 내용을 포함한다.

- GitHub Actions secret은 repository settings에서 등록한다.
- secret 값을 workflow 로그에 echo하지 않는다.
- fork PR에서는 secret이 제공되지 않을 수 있다.
- 외부 AI provider 사용 시 diff 전송 정책을 명확히 해야 한다.
- `GITHUB_TOKEN` 권한은 필요한 최소 권한만 부여한다.

권장 permissions 예시:

```yaml
permissions:
  contents: read
  pull-requests: write
```

print-only 예시는 `pull-requests: write`가 필요하지 않다.

## 보안 기준

- 문서 예시에 실제 token/API key 값을 넣지 않는다.
- `npm publish` 또는 자동 업데이트 실행 예시를 넣지 않는다.
- `git reset --hard` 같은 파괴적 명령 예시를 넣지 않는다.
- PR from fork 환경에서 secret 노출 가능성을 안내한다.
- `--yes` 사용은 CI에서만 권장하고 로컬 사용은 신중히 안내한다.

## 완료 기준

- `docs/github-actions.md`에 안전한 workflow 예시가 추가된다.
- `README.md`에 GitHub Actions 사용 요약과 문서 링크가 추가된다.
- 예시는 `--pr --print-only --no-interactive` 중심으로 작성된다.
- secret 노출 주의사항과 fork PR 주의사항이 포함된다.
- 사용자가 문서만 보고 CI 실행 방법을 이해할 수 있다.
