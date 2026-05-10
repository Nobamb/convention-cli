# Phase M OpenAI-compatible Provider Agent Research

## 1. 개요

Phase M은 OpenAI의 표준 `/v1/chat/completions` API 인터페이스를 지원하는 다양한 LLM 서비스(LM Studio, vLLM, 그 외 클라우드 제공자)와 연동할 수 있는 Provider를 구현하는 단계입니다. 

## 2. 작업 목표

- `src/providers/openai-compatible.js` 구현
- `config.baseURL`을 기반으로 동적인 API 호출 구성
- `Authorization: Bearer <API_KEY>` 형태의 헤더 처리 구현
- `modelVersion` 값을 파라미터로 전송
- `{ role: "user", content: prompt }` 형태의 messages 포맷 구성 및 응답의 `choices[0].message.content` 추출 로직 구현

## 3. 권장 구현 방향

- 범용성을 위해 `@google/generative-ai` 같은 특정 SDK 대신 `fetch` 기반의 범용 HTTP 클라이언트로 요청을 전송하는 것이 유리합니다.
- `localLLM`의 경우 인증이 없는 경우가 많으므로, API Key가 존재하는 경우에만 Bearer 헤더를 추가하도록 유연하게 작성합니다.
- Phase B의 인터페이스 규약(`generateCommitMessage`)을 반드시 준수합니다.

## 4. 보안 및 안정성 기준

- 사용자 지정 `baseURL`에 요청을 보내므로, 의도치 않은 URL 호출 오류를 방어해야 합니다.
- 빈 응답, 잘못된 JSON 포맷 등에 대한 방어 로직(`try-catch`)이 필요합니다.

## 5. 다음 단계 연결

OpenAI-compatible 구조까지 구현되면, 주요 LLM 지원이 모두 준비된 상태가 되며, Phase N 라우터가 이를 묶어주는 역할을 수행합니다.
