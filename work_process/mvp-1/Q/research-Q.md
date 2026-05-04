# Phase Q Git add Agent Research

## 1. 개요

Phase Q는 변경된 파일을 커밋하기 위해 스테이징 영역에 추가하는 `git add` 관련 Agent 기능을 구현하는 단계입니다. 배치 모드에서의 전체 추가(`addAll`)와 스텝 모드에서의 개별 파일 추가(`addFile`)를 지원합니다.

## 2. 작업 목표

- `src/core/git.js`에 `addAll()` 및 `addFile(file)` 구현
- 배치 모드 지원을 위해 `git add -A` 실행 기능 구현
- 스텝 모드 지원을 위해 개별 파일별 `git add -- <file>` 실행 기능 구현
- `execFileSync` 또는 `spawnSync`를 사용한 안전한 인자 배열 방식 명령 실행
- 스테이징 실패 시 에러 처리 및 로깅 기준 수립

## 3. Git 명령 기준

상태 변경 명령은 아래 의미로 실행합니다.

**전체 추가 (Batch Mode):**
```bash
git add -A
```

**개별 파일 추가 (Step Mode):**
```bash
git add -- <file>
```

Node.js 구현 예시:
```javascript
// addAll
execFileSync("git", ["add", "-A"]);

// addFile
execFileSync("git", ["add", "--", file]);
```

`--` 구분자는 파일명이 옵션으로 오해받는 것을 방지하는 필수 안전 장치입니다.

## 4. 공백 및 한글 파일명 처리

파일명에 공백이나 한글이 포함된 경우, shell interpolation(`execSync`)을 사용하면 경로가 깨지거나 보안 취약점이 발생할 수 있습니다.

금지 방식:
```javascript
execSync(`git add ${file}`); // 보안 위험 및 공백 처리 불가
```

허용 방식:
```javascript
execFileSync("git", ["add", "--", file]); // 안전함
```

argv 배열을 통해 파일명을 단일 인자로 전달함으로써 OS 레벨에서 경로를 정확하게 처리합니다.

## 5. 에러 처리 기준

- `git add` 명령이 실패할 경우(예: 권한 문제, 락 파일 존재 등) `try...catch`로 감싸 예외를 포착합니다.
- `src/utils/logger.js`를 통해 에러 원인을 기록합니다.
- 복구 불가능한 명령 실패 시 상위 흐름(Workflow)이 중단되도록 예외를 다시 던집니다.

```javascript
try {
  execFileSync("git", ["add", "--", file]);
} catch (error) {
  Logger.error(`Failed to add file: ${file}`, error);
  throw error;
}
```

## 6. 보안 및 로그 기준

- **Shell Injection 방지:** 반드시 argv 배열 방식을 사용하며, 사용자 입력값(파일명)을 직접 문자열로 결합하지 않습니다.
- **민감 정보 노출 방지:** `git add` 명령 실행 자체는 로그에 남길 수 있으나, diff 내용이나 민감한 파일 경로가 노출되지 않도록 주의합니다.
- **격리된 실행:** 테스트 단계에서는 반드시 격리된 임시 Git 저장소에서만 실행을 검증합니다.

## 7. 테스트 관점

- `addAll()` 호출 후 모든 변경 사항(신규, 수정, 삭제)이 staged 상태가 되는지 확인
- `addFile(file)` 호출 후 특정 파일만 staged 상태가 되는지 확인
- 공백이 포함된 파일명이 정상적으로 스테이징되는지 확인
- 한글 파일명이 정상적으로 스테이징되는지 확인
- 존재하지 않는 파일이나 권한 없는 파일 시도 시 에러 처리가 정상 작동하는지 확인

## 8. 다음 단계

Phase Q에서 스테이징이 완료되면, Phase R에서 스테이징된 변경 사항을 바탕으로 실제 `git commit`을 수행하는 Agent를 구현합니다.
