// Android 환경 설정에 대한 정적 회귀 테스트.
// 빌드를 실행하지 않고 파일 내용만 확인한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appGradle = fs.readFileSync(path.join(ROOT, 'android', 'app', 'build.gradle'), 'utf8');
const rnConfig = require(path.join(ROOT, 'react-native.config.js'));

describe('android/app/build.gradle', () => {
  const applyLines = appGradle
    .split('\n')
    .filter((line) => line.includes('dotenv.gradle'));

  test('react-native-config 의 dotenv.gradle 이 적용된다', () => {
    expect(applyLines.length).toBeGreaterThan(0);
    expect(applyLines[0]).toContain("project(':react-native-config')");
  });

  test('dotenv.gradle 이 중복 apply 되지 않는다', () => {
    expect(applyLines).toHaveLength(1);
  });

  test('envConfigFiles 를 추가하지 않는다', () => {
    expect(appGradle).not.toContain('envConfigFiles');
  });

  test('Secret 을 하드코딩하지 않는다', () => {
    expect(appGradle).not.toMatch(/AGENT_DEMO_TOKEN\s*[:=]/);
    expect(appGradle).not.toMatch(/API_BASE_URL\s*[:=]/);
    expect(appGradle).not.toMatch(/buildConfigField\s*\(?\s*["']String["']\s*,\s*["']AGENT_DEMO_TOKEN/);
  });
});

describe('react-native.config.js', () => {
  test('react-native-image-manipulator 의 Android autolink 만 제외한다', () => {
    const entry = rnConfig.dependencies['react-native-image-manipulator'];
    expect(entry).toBeDefined();
    expect(entry.platforms.android).toBeNull();
  });

  test('iOS 설정은 건드리지 않는다', () => {
    const entry = rnConfig.dependencies['react-native-image-manipulator'];
    expect(entry.platforms.ios).toBeUndefined();
  });

  test('다른 라이브러리의 autolink 에는 영향을 주지 않는다', () => {
    expect(Object.keys(rnConfig.dependencies)).toEqual(['react-native-image-manipulator']);
  });
});
