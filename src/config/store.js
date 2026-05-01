import os from 'os';
import path from 'path';

// 사용자 홈 디렉터리 아래에 CLI 설정 파일을 저장할 전용 디렉터리 경로입니다.
// OS별 경로 구분자 차이를 피하기 위해 os.homedir()와 path.join()으로 조합합니다.
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'convention');

// 실제 사용자 설정값을 저장하고 불러올 config.json 파일의 전체 경로입니다.
export const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');
