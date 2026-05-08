# Research E: localLLM 기본 설정

## 작업 목표
- localLLM 선택 시 필요한 기본 설정값 정의 및 검증 로직 설계.

## 주요 연구 내용
1. **localLLM 기본 baseURL 정의**:
   - Ollama (http://localhost:11434) 또는 LM Studio (http://localhost:1234) 등 일반적인 로컬 LLM 서버의 기본 주소 정의.
2. **authType 처리**:
   - localLLM은 일반적으로 인증이 필요 없으므로 `authType`을 `none`으로 처리하는 로직 확인.
3. **config 검증**:
   - `localLLM` 프로바이더 선택 시 필수 필드(baseURL) 존재 여부 체크.
4. **기본값 적용 로직**:
   - 사용자가 별도로 baseURL을 입력하지 않았을 때 `http://localhost:11434/v1` 등을 기본값으로 할당하는 로직 설계.
