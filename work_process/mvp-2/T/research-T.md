# Phase T Model Config 저장 Agent Research

## 1. 개요

Phase T는 `--model` 명령의 결과를 `~/.config/convention/config.json`에 저장하고, 이후 `convention` 실행 시 저장된 Provider/Auth/Model 설정이 실제 AI Provider routing에 사용되도록 보장하는 단계다.

## 2. 작업 목표

- `--model` 결과를 `config.json` schema에 맞게 저장
- 기존 `mode`, `language`, `confirmBeforeCommit` 값 보존
- `provider`, `authType`, `modelDisplayName`, `modelVersion`, `baseURL` 갱신
- localLLM 기본 `baseURL` 자동 적용
- API Key 같은 secret은 `config.json`에 저장하지 않음
- 저장 후 commit flow에서 `loadConfig()`를 통해 Provider routing에 반영

## 3. 구현 범위

- 수정 대상: `src/commands/model.js`, `src/config/store.js`
- 연동 대상: `src/core/ai.js`, `src/providers/index.js`, `src/config/defaults.js`
- 주요 함수:
  - `loadConfig()`
  - `saveConfig(config)`
  - `runModelSetup(...args)`
  - `generateCommitMessage(prompt, config)`
  - `generateWithProvider({ prompt, config })`

## 4. 권장 구현 방향

- 저장 전 `loadConfig()`로 기존 설정을 읽고 변경 대상 필드만 병합한다.
- `DEFAULT_CONFIG`의 schema를 유지한다.
- `modelDisplayName`은 UI 표시용으로 `modelVersion` 또는 Provider가 제공한 display name을 저장한다.
- localLLM은 baseURL이 없으면 `DEFAULT_LOCAL_LLM_BASE_URL`을 사용한다.
- `saveConfig()`는 UTF-8, 2 spaces pretty JSON으로 저장한다.
- commit flow는 별도 인자 전달 없이 `loadConfig()` 결과를 통해 Provider 설정을 사용한다.

## 5. 보안 및 안정성 기준

- `apiKey`, `token`, `secret`, `password` 필드는 config에 저장하지 않는다.
- credentials와 config 저장 책임을 분리한다.
- config 저장 성공 메시지에 전체 config 객체를 출력하지 않는다.
- 저장 실패 또는 JSON 오류 메시지에 secret 원문이 포함되지 않도록 한다.

## 6. 완료 기준

- `convention --model localLLM none qwen2.5:7b` 실행 후 config에 localLLM 설정이 저장된다.
- 이후 `convention` 또는 `convention --batch` 실행 시 저장된 provider가 사용된다.
- `config.json`에는 API Key가 포함되지 않는다.
- 기존 1차 MVP 설정인 mode/language/confirmBeforeCommit이 보존된다.
