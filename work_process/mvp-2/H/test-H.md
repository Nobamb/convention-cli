# Test H: 로컬 모델 선택 UI 테스트

## 테스트 항목
1. **UI 표시 및 선택**:
   - `convention --model` 실행 중 로컬 모델 목록이 화면에 정상적으로 출력되고 방향키로 선택 가능한지 확인.
2. **modelVersion 저장 확인**:
   - 특정 모델을 선택한 후 `~/.config/convention/config.json` 파일을 열어 `modelVersion` 값이 선택한 값으로 업데이트되었는지 확인.
3. **선택 취소 처리**:
   - 사용자가 UI에서 ESC 등을 눌러 선택을 취소했을 때 설정이 변경되지 않고 안전하게 종료되는지 확인.
