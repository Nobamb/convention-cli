# Phase J Credentials 저장 Agent Research

## 1. 개요

Phase J는 입력받은 API Key 등의 민감한 인증 정보를 기존의 `config.json`과 분리하여 안전하게 파일로 저장하는 로직을 구현하는 단계입니다. `~/.config/convention/credentials.json`을 사용하여 권한 제어를 통해 보안을 강화합니다.

## 2. 작업 목표

- `~/.config/convention/credentials.json` 경로 정의
- Credentials 파일 읽기 및 쓰기 로직 구현
- 생성된 파일의 권한을 제한(OS 수준에서 600 등)하여 보안성 확보
- 기존 일반 설정 파일(`config.json`)과 인증 정보의 분리 저장 유지

## 3. 권장 구현 방향

- Node.js의 `fs.promises`를 활용하여 파일 입출력을 구현합니다.
- `fs.chmod()` 또는 파일 생성 시 `mode: 0o600` 옵션을 사용하여 파일 소유자만 읽고 쓸 수 있도록 권한을 설정합니다.
- 파일이 이미 존재하는 경우, 기존 JSON 파싱 후 필요한 Provider의 Key만 업데이트하고 다시 저장하는 형태로 구현합니다.

## 4. 보안 및 안정성 기준

- `credentials.json`은 절대로 `config.json`에 포함되지 않도록 논리적으로 분리되어야 합니다.
- 파일 저장 시 예외(권한 부족, 디렉토리 없음 등)가 발생하면, API Key가 누출되지 않도록 하면서 사용자에게 적절한 원인을 안내해야 합니다.

## 5. 다음 단계 연결

안전하게 저장된 자격 증명은 향후 클라우드 Provider(Gemini, OpenAI-compatible 등)가 API 요청을 보낼 때 로드되어 사용됩니다. Phase K에서는 이 과정에서의 로그 보안 정책을 강화합니다.
