module.exports = {
  dependencies: {
    // react-native-image-manipulator의 Android 네이티브 모듈은 RN 0.82 / AGP 8 /
    // Gradle 9 환경에서 빌드되지 않으므로 Android autolink에서만 제외한다.
    // JS 측 CameraGuideComponent는 모듈 부재 시 원본 이미지를 그대로 반환하는
    // fallback을 이미 갖고 있다.
    'react-native-image-manipulator': {
      platforms: {
        android: null,
      },
    },
  },
};
