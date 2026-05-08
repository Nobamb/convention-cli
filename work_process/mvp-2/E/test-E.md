# Test E: localLLM 기본 설정 테스트

## 테스트 항목
1. **기본 Endpoint 자동 적용**:
   - `convention --model` 명령어 실행 중 `localLLM`을 선택했을 때, 별도의 입력 없이도 기본 baseURL이 설정 파일에 기록되는지 확인.
2. **config 검증 로직**:
   - `config.json`에서 `provider`가 `localLLM`일 때 `baseURL` 필드가 유효한지 검증하는 함수가 정상 작동하는지 확인.
3. **authType 설정**:
   - 설정된 `localLLM` 설정에서 `authType`이 `none`으로 저장되는지 확인.
