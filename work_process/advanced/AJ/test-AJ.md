# AJ. Package Version Agent 테스트 계획

## 테스트 목표

현재 패키지 버전을 읽고 `convention --version`으로 출력하는 흐름이 commit flow와 분리되어 안전하게 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- `getCurrentVersion()` 반환값
- `convention --version` 출력
- package.json 경로 안정성
- 오류 처리
- commit flow 미실행

## getCurrentVersion 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 version | package.json에 `"version": "1.0.0"` | `1.0.0`을 반환한다. |
| prerelease version | package.json에 `"1.2.0-beta.1"` | prerelease 문자열을 그대로 반환한다. |
| version 누락 | version 필드 제거 mock | 명확한 오류를 던진다. |
| 빈 version | version이 `""` | 명확한 오류를 던진다. |
| 문자열 아님 | version이 숫자 | 명확한 오류를 던진다. |
| JSON parse 실패 | 깨진 package.json mock | 파일 내용 원문 없이 안전한 오류를 던진다. |

## CLI 출력 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| version 출력 | `node bin/convention.js --version` | 현재 package version이 stdout에 출력된다. |
| commander alias | `node bin/convention.js -V` | 현재 package version이 stdout에 출력된다. |
| help와 분리 | `node bin/convention.js --help` | help 출력은 기존대로 유지된다. |
| version 우선순위 | `node bin/convention.js --version --batch` | version만 출력하고 batch flow는 실행하지 않는다. |
| version 우선순위 2 | `node bin/convention.js --version --step` | version만 출력하고 step flow는 실행하지 않는다. |

## commit flow 분리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| Git 저장소 밖 실행 | Git 저장소가 아닌 임시 폴더 | version 출력이 성공하고 Git 저장소 오류가 발생하지 않는다. |
| 변경 파일 존재 | 테스트 Git 저장소에 변경 파일 생성 | version 출력만 수행하고 diff를 읽지 않는다. |
| AI provider 설정 존재 | config에 provider 설정 | AI provider 호출이 발생하지 않는다. |
| confirm mock | confirm 함수 mock | confirm 함수가 호출되지 않는다. |
| git command mock | git wrapper mock | git add, commit, push, reset이 호출되지 않는다. |

## 경로 안정성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 다른 cwd | 임시 하위 디렉터리에서 CLI 실행 | CLI 자신의 package.json version을 읽는다. |
| npm link 유사 환경 | symlink 또는 실제 repo 외부 cwd mock | cwd package.json이 아니라 CLI package.json을 읽는다. |
| Windows 경로 | Windows path separator 환경 | 경로 조합 오류 없이 읽는다. |
| POSIX 경로 mock | path 동작 mock | `path.join()` 기반으로 안전하게 처리된다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| package 전체 출력 방지 | package.json에 임의 metadata 추가 | version 외 metadata가 출력되지 않는다. |
| stack trace 방지 | package read 실패 mock | raw stack trace를 사용자 출력에 그대로 노출하지 않는다. |
| 외부 호출 방지 | fetch mock | `--version`에서 fetch가 호출되지 않는다. |
| Git 호출 방지 | git mock | `--version`에서 Git 명령이 호출되지 않는다. |

## 완료 기준

- `getCurrentVersion()` 정상/오류 케이스가 테스트된다.
- `convention --version`과 `-V`가 테스트된다.
- version 확인이 commit flow를 실행하지 않는 것이 검증된다.
- 다른 cwd에서도 CLI 자신의 package version을 읽는 것이 검증된다.
- 오류 출력에 민감 정보나 package 원문이 포함되지 않는다.
