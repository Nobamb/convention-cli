# Phase D Provider 목록 정의 Agent Research

## 1. 개요

Phase D는 2차 MVP에서 지원할 Provider들의 목록을 명확히 정의하고, 사용자가 입력한 Provider 값이 유효한지 검증하는 체계를 마련하는 단계입니다. 구현 대상은 주로 `src/utils/validator.js`와 `src/providers/index.js`(혹은 관련 설정 파일) 입니다.

## 2. 작업 목표

- 전체 Provider 목록을 Stable과 Experimental로 분류하여 정의
- 2차 MVP에서 우선 지원할 Provider 명시 (`mock`, `localLLM`, `gemini`, `openaiCompatible`)
- `isValidProvider(provider)` 유효성 검증 함수 구현 및 추가

## 3. 구체적인 구현 로직

### Provider 목록 정의

- `src/providers/index.js` 또는 `src/config/defaults.js` 내에 지원하는 Provider 목록 상수(예: `SUPPORTED_PROVIDERS`)를 정의합니다.
- **Stable Providers:** `gemini`, `github-copilot`, `codex`, `claude`, `grok`, `deepseek`, `kimi`, `glm`, `localLLM` (이 중 2차 MVP 구현 대상은 `localLLM`, `gemini` 등)
- **Experimental Providers:** `antigravity`, `manus`
- **Fallback/Test:** `mock`
- 이 중에서 현재 CLI가 실제로 라우팅 가능한 값들만 `isValidProvider`에서 통과시키거나, 설정 가능하도록 허용하는 정책이 필요합니다. 2차 MVP 단계에서는 `mock`, `localLLM`, `gemini`, `openaiCompatible` 만을 유효한 것으로 처리합니다.

### `isValidProvider(provider)` 함수 구현

- `src/utils/validator.js`에 `isValidProvider(provider)` 함수를 추가합니다.
- 인자로 들어온 문자열이 2차 MVP 지원 Provider 목록(`['mock', 'localLLM', 'gemini', 'openaiCompatible']`)에 포함되는지 확인하여 불리언 값을 반환합니다.
- 대소문자 구분 없이 비교하거나, 소문자로 정규화하여 검증하는 방안을 고려합니다.

## 4. 보안 및 안정성 기준

- 사용자가 악의적이거나 지원하지 않는 Provider 이름을 `--model` 명령어나 config 파일을 통해 주입하려고 할 때, 이 검증 함수가 안전망 역할을 해야 합니다.
- 유효하지 않은 값이 들어올 경우 안전하게 기본값(`mock` 등)으로 떨어지거나 명확한 에러를 발생시켜 프로그램 오동작을 방지합니다.

## 5. 다음 단계 연결

Phase D에서 유효성 검증 체계가 마련되면, Phase E부터 본격적으로 `localLLM`의 구체적인 설정 및 연동 작업을 안전하게 시작할 수 있습니다.
