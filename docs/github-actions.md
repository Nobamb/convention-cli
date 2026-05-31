# GitHub Actions 사용 가이드

이 문서는 `convention-cli`를 GitHub Actions에서 안전하게 실행하는 방법을 정리합니다.

## 기본 원칙

- CI에서는 `CI=true` 또는 `GITHUB_ACTIONS=true`를 감지해 interactive prompt를 비활성화합니다.
- `--no-interactive`는 prompt를 띄우지 않는 옵션이며, 자동 승인이 아닙니다.
- `--yes`는 commit 또는 PR 생성 단계의 명시 승인으로만 사용합니다.
- `--yes`는 외부 AI Provider로 diff나 Git metadata를 전송하는 보안 확인을 우회하지 않습니다.
- PR 자동화는 기본적으로 `--print-only`를 사용해 제목/본문만 출력하는 흐름을 권장합니다.

## PR 제목/본문 출력 예시

가장 안전한 기본 예시는 원격 PR을 직접 만들지 않고 제목과 본문만 생성하는 방식입니다.

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

## GitHub Actions Output 사용

GitHub Actions에서는 `GITHUB_OUTPUT` 파일을 통해 다음 step으로 값을 전달할 수 있습니다.

`convention-cli`는 가능한 경우 다음 output을 기록합니다.

- `commit_message`
- `pr_title`
- `pr_body`

예시:

```yaml
name: Convention CLI Outputs

on:
  workflow_dispatch:

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

      - id: convention_pr
        run: convention --pr --print-only --no-interactive

      - run: |
          echo "Generated PR title: ${{ steps.convention_pr.outputs.pr_title }}"
```

## 비대화형 Commit 예시

CI에서 실제 commit을 생성하려면 `--yes`를 명시해야 합니다.

```yaml
- run: convention --batch --yes --no-interactive
```

이 명령은 commit 확인 prompt를 생략하지만, sensitive diff scan과 외부 AI 전송 정책은 유지합니다.

외부 AI Provider를 CI에서 사용하고 prompt 없이 실행하려면 사용자가 설정 파일에 전송 정책을 명시해야 합니다.

```json
{
  "confirmExternalTransmission": "never"
}
```

이 설정은 diff 또는 Git metadata가 외부 provider로 전송될 수 있음을 사용자가 사전에 명확히 허용한다는 뜻입니다.

## Secret 설정

API Key는 workflow 파일에 직접 쓰지 말고 GitHub Secrets에 저장합니다.

```yaml
env:
  CONVENTION_GEMINI_API_KEY: ${{ secrets.CONVENTION_GEMINI_API_KEY }}
```

주의사항:

- secret 값을 `echo`로 출력하지 않습니다.
- `process.env` 전체를 출력하지 않습니다.
- credentials 파일 내용을 로그로 출력하지 않습니다.
- fork PR에서는 repository secret이 제공되지 않을 수 있습니다.
- 외부 AI Provider가 필요한 workflow는 fork PR에서 실패하거나 print-only로 제한될 수 있습니다.

## 권한 최소화

print-only 예시는 원격 PR을 만들지 않으므로 write 권한이 필요하지 않습니다.

원격 PR 생성을 자동화하는 경우에만 필요한 권한을 최소로 지정합니다.

```yaml
permissions:
  contents: read
  pull-requests: write
```

## PR 생성 자동화

원격 PR 생성을 CI에서 실행하려면 `--yes`가 필요합니다.

```yaml
- run: convention --pr --yes --no-interactive
```

다만 기본 workflow 예시로는 `--print-only`를 권장합니다. `pull_request_target`은 checkout 대상 코드와 secret 권한이 섞일 수 있어 기본 예시로 권장하지 않습니다.

## 금지 예시

다음 동작은 workflow 예시로 사용하지 않습니다.

- `npm publish` 자동 실행
- `git reset --hard`
- secret 값 직접 출력
- credentials 파일 원문 출력
- `--yes` 없는 원격 PR 자동 생성
