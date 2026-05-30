# AJ. Package Version Agent 구현 계획

## 작업 범위

AJ 단계는 현재 실행 중인 `convention-cli`의 패키지 버전을 안전하게 확인하고, `convention --version` 출력으로 연결하는 작업이다.

이 단계는 commit flow와 분리되어야 한다. 사용자가 버전만 확인하려고 실행한 경우 Git 저장소 확인, diff 추출, AI 호출, commit confirm이 실행되면 안 된다.

## 선행 조건

- `package.json`에 `version` 필드가 존재한다.
- `bin/convention.js`가 `commander` 기반으로 옵션을 처리한다.
- 3차 고도화에서 `--version`은 설정 명령과 동일하게 commit flow보다 우선한다.
- package version 확인은 외부 네트워크를 사용하지 않는다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/version.js`
- `bin/convention.js`
- `package.json`
- `tests/version.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/version.js`를 새로 만들고 다음 함수를 제공한다.

```js
export function getCurrentVersion()
```

권장 동작은 다음과 같다.

1. 현재 모듈 기준으로 프로젝트 루트의 `package.json` 경로를 찾는다.
2. `fs.readFileSync`와 `JSON.parse`로 package metadata를 읽는다.
3. `version`이 유효한 문자열이면 반환한다.
4. 파일이 없거나 JSON이 깨져 있거나 version이 없으면 명확한 오류를 던진다.

경로 조합은 `path.join()` 또는 `fileURLToPath(import.meta.url)` 기반으로 처리한다. 문자열로 `../..`를 직접 덧붙이는 방식은 피한다.

## CLI 연결 계획

`bin/convention.js`에서 `--version` 또는 commander의 version 기능을 연결한다.

권장 정책:

- `convention --version`은 현재 버전만 출력하고 종료한다.
- `convention -V`는 commander 기본 alias를 사용할 수 있다.
- `--version`은 `--step`, `--batch`, 기본 commit flow보다 우선한다.
- `--version` 실행 시 config 파일을 읽을 필요가 없다.
- `--version` 실행 시 update check를 함께 수행하지 않는다. update check는 AM 정책에 따른 일반 실행 흐름에서만 고려한다.

## package.json 경로 처리 기준

패키지가 전역 설치, 로컬 실행, npm link 상태 모두에서 동작할 수 있어야 한다.

권장 방식:

- `src/core/version.js`의 위치에서 프로젝트 루트까지 안정적으로 역산한다.
- `process.cwd()`를 기준으로 package.json을 찾지 않는다. 사용자가 임의 Git 저장소에서 CLI를 실행하면 cwd는 대상 프로젝트일 수 있다.
- package.json 내용 전체를 로그로 출력하지 않는다.

## 실패 처리 기준

다음 실패는 commit flow로 fallback하지 않고 버전 확인 실패로 종료한다.

- `package.json`을 찾을 수 없음
- `package.json` JSON parse 실패
- `version` 필드 누락
- `version`이 빈 문자열 또는 문자열이 아님

사용자 메시지는 원인을 짧게 설명하되 파일 전체 내용이나 내부 stack trace를 그대로 출력하지 않는다.

## 보안 기준

- 외부 네트워크 호출 없음
- Git 명령어 실행 없음
- 사용자 홈 디렉터리 전체 스캔 없음
- package.json 전체 내용을 출력하지 않음
- `--version` 실행 중 commit, push, reset 실행 없음

## 완료 기준

- `getCurrentVersion()`이 현재 package version을 반환한다.
- `convention --version`이 `package.json`의 version을 출력한다.
- `convention --version`은 commit flow와 완전히 분리된다.
- 전역 설치, 로컬 실행, npm link 환경에서도 package version을 읽을 수 있다.
- package metadata 오류가 안전하게 처리된다.
