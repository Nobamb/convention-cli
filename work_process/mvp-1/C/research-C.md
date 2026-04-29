# Phase C (CLI 라우팅) 조사 보고서

## 목표: CLI 라우팅 및 명령어 연결 (Phase C) 현황 파악

### 1. 점검 항목 및 현황

| 항목 | 기획 내용 (01_mvp-1.md) | 현재 상태 | 결과 |
| :--- | :--- | :--- | :--- |
| **bin/convention.js 라우팅** | 옵션에 따라 각 command 파일로 연결 | 옵션 정의는 완료되었으나 호출부 주석 처리됨 | ⚠️ 보완 필요 |
| **src/commands/commit.js** | 커밋 관련 로직 (`runDefault`, `runStep` 등) | 파일은 존재하나 **0 bytes (비어있음)** | ❌ 미달 |
| **src/commands/config.js** | 설정 관련 로직 (`setMode`, `setLanguage`) | 파일은 존재하나 **0 bytes (비어있음)** | ❌ 미달 |

### 2. 구체적인 작업 방향 가이드

현재 `bin/convention.js`는 껍데기만 완성된 상태입니다. 실질적인 라우팅을 활성화하기 위해 다음 단계로 작업을 진행합니다.

1.  **명령어 스터브(Stub) 작성**: 
    - `src/commands/` 내의 파일들에 빈 함수가 아닌, 호출 여부를 확인할 수 있는 `console.log`가 포함된 스터브 함수들을 작성합니다.
    - 예: `export const runStepCommit = () => console.log("[DEBUG] runStepCommit 호출됨");`

2.  **라우팅 활성화**:
    - `bin/convention.js`에서 위에서 작성한 함수들을 `import` 합니다.
    - 기존의 `if/else` 문에서 주석을 해제하고 실제 함수를 호출하도록 연결합니다.

3.  **의존성 확인**:
    - `ESM` 환경이므로 `import` 시 파일 확장자(`.js`)를 반드시 포함해야 함을 유의합니다.

### 3. 결론

**Phase C는 라우팅 로직의 "연결"이 핵심입니다.** 명령어 파일들의 실제 구현은 이후 Phase에서 진행되더라도, 현재 단계에서는 **"어떤 명령을 내렸을 때 어디로 도달하는가"**에 대한 지도가 완성되어야 합니다.
