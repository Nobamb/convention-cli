# Model 설정 가이드

이 문서는 `convention --model`로 AI provider와 model을 설정하는 방법을 정리합니다.

## 기본 원칙

- 기본 provider는 외부 네트워크 호출이 없는 `mock`입니다.
- 지원하지 않는 provider는 조용히 `mock`으로 fallback하지 않고 명확한 오류로 중단합니다.
- API Key 같은 secret은 `config.json`에 저장하지 않고 `~/.config/convention/credentials.json`에만 저장합니다.
- 외부 provider로 diff 또는 Git metadata를 보내기 전에는 보안 gate와 전송 확인 정책을 유지합니다.

## 주요 명령

```bash
convention --model
convention --model mock
convention --model localLLM none "qwen2.5:7b"
convention --model gemini api "gemini-model"
convention --model openaiCompatible api "gpt-compatible"
convention --model github-copilot oauth
```

## Provider 기준

| Provider | Auth | 설명 |
| --- | --- | --- |
| `mock` | `none` | API 없이 `chore: update project files`를 반환합니다. |
| `localLLM` | `none` | 기본값은 `http://localhost:11434/v1`입니다. |
| `gemini` | `api` | API Key는 credentials 저장소에만 보관합니다. |
| `openaiCompatible` | `api` | `baseURL`에 credential, query, fragment가 있으면 거부합니다. |
| `github-copilot` | `oauth` | OAuth token은 credentials의 provider namespace에 저장합니다. |
| `codex-mcp` | `none` | Codex CLI가 인증을 처리하므로 convention credentials를 저장하지 않습니다. |

## localLLM

localLLM은 localhost endpoint를 기본 전제로 합니다.

```json
{
  "provider": "localLLM",
  "authType": "none",
  "baseURL": "http://localhost:11434/v1"
}
```

localhost가 아닌 endpoint를 사용하면 외부 전송 확인 대상으로 처리합니다.

## API Key Provider

API Key 입력이 필요한 provider는 secret prompt를 통해 값을 받습니다.

저장 원칙:

- `config.json`에는 provider, authType, modelVersion 같은 비밀이 아닌 값만 저장합니다.
- `credentials.json`에는 provider별 API Key만 저장합니다.
- 이미 저장된 API Key가 있으면 교체 여부를 먼저 확인합니다.
- 성공/실패 메시지에 API Key 원문을 포함하지 않습니다.

## 외부 전송 정책

외부 AI provider는 diff 또는 Git metadata가 프로세스 밖으로 나갈 수 있으므로 확인 정책을 분리합니다.

`--yes`는 commit 또는 PR 생성 승인에만 사용하며, 외부 AI 전송 확인을 대신하지 않습니다.

비대화형 환경에서 외부 provider를 사용하려면 사용자가 설정으로 정책을 명시해야 합니다.

```json
{
  "confirmExternalTransmission": "never"
}
```

이 설정은 외부 전송 가능성을 사전에 이해하고 허용한다는 의미입니다.

## 보안 주의사항

- API Key, OAuth token, refresh token을 로그에 출력하지 않습니다.
- credentials 파일 내용을 그대로 출력하지 않습니다.
- `.env`, private key, credentials 파일은 diff 분석 대상에서 제외합니다.
- `API_KEY=`, `TOKEN=`, `PASSWORD=`, `DATABASE_URL` 같은 패턴은 provider 전송 전 마스킹합니다.
