# Phase D (Help 출력) 검증 테스트 가이드

`init/01_mvp-1.md`의 D단계(Help 출력 Agent) 설정을 바탕으로, `convention --help` 실행 시 기획된 한국어 도움말과 옵션 설명이 올바르게 출력되는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 분석 검증 (Static Analysis)

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :--- | :--- | :--- |
| **V-1** | `help.js` 파일 존재 확인 | `ls src/commands/help.js` | 파일이 존재하며 `printHelp` 함수를 export함. |
| **V-2** | 전역 도움말 커스텀 확인 | `cat bin/convention.js` | `commander`의 기본 도움말이 아닌 커스텀 문구가 설정됨. |

## 2. 도움말 출력 테스트 (Output Test)

| ID | 명령어 | 검증 포인트 | 결과 |
| :-- | :--- | :--- | :--- |
| **T-1** | `convention --help` | 로켓 아이콘(🚀) 및 한국어 설명 포함 여부 | |
| **T-2** | `convention -h` | `--help`와 동일한 결과 출력 여부 | |
| **T-3** | 옵션 설명 확인 | `--step`, `--batch`, `--set-mode`, `--language`에 대한 한글 설명 존재 | |

## 3. 인코딩 및 가독성 검증

- **한글 깨짐 확인:** 터미널 환경(Windows PowerShell, CMD, Bash 등)에서 한글이 깨지지 않고 정상 출력되는지 확인.
- **정렬 상태:** 옵션과 설명 사이의 간격이 일정하고 가독성이 좋은지 확인.

---

## 검증 결과 요약

- **모든 항목 통과 시:** Phase D 완료 및 Phase E(기본 설정값 시스템) 진입 가능.
- **실패 항목 존재 시:** `src/commands/help.js`의 문자열 인코딩 및 `commander` 설정 재확인.
