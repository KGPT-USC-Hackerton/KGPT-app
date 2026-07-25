import Config from 'react-native-config';

/**
 * 입술 검출 API 서비스
 * FastAPI 서버의 /detect-lips 엔드포인트 호출
 */

// FastAPI 서버 주소
const LIP_DETECTION_API_URL = Config.LIP_DETECTION_API_URL;

/**
 * 이미지에서 입술 랜드마크 검출
 * @param {string} imageUri - 이미지 파일 경로 (file://...)
 * @returns {Promise<Object>} - { lipPoints: [{x, y}], faceDetected: bool, width, height }
 */
export const detectLips = async (imageUri) => {
  try {
    // API URL 확인
    if (!LIP_DETECTION_API_URL) {
      console.error('❌ LIP_DETECTION_API_URL이 설정되지 않았습니다.');
      throw new Error('The lip detection API URL is not configured.');
    }

    // 이미지 URI 확인
    if (!imageUri) {
      console.error('❌ 이미지 URI가 제공되지 않았습니다.');
      throw new Error('An image path is required.');
    }

    console.log('🔍 입술 검출 시작:', {
      apiUrl: `${LIP_DETECTION_API_URL}/detect-lips`,
      imageUri: imageUri.substring(0, 50) + '...',
    });

    // React Native에서 파일을 FormData로 전송
    const formData = new FormData();
    
    // 파일명 추출
    const fileName = imageUri.split('/').pop() || `image_${Date.now()}.jpg`;
    
    // FormData에 파일 추가
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: fileName,
    });

    // 네트워크 타임아웃 설정 (30초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${LIP_DETECTION_API_URL}/detect-lips`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        // FormData 사용 시 Content-Type은 자동으로 설정됨
        // ngrok 무료 플랜 브라우저 경고 페이지 우회 (직접 IP 접속 시엔 무시됨)
        'ngrok-skip-browser-warning': 'true',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '알 수 없는 오류');
      console.error('❌ 서버 응답 오류:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Server error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    // 응답 데이터 검증
    if (!data || typeof data !== 'object') {
      console.error('❌ 잘못된 응답 형식:', data);
      throw new Error('Received an invalid response from the server.');
    }

    const result = {
      success: true,
      data: {
        lipPoints: Array.isArray(data.lipPoints) ? data.lipPoints : [],
        faceDetected: Boolean(data.faceDetected),
        width: Number(data.width) || 0,
        height: Number(data.height) || 0,
        pointCount: Number(data.pointCount) || (Array.isArray(data.lipPoints) ? data.lipPoints.length : 0),
      },
    };

    console.log('✅ 입술 검출 완료:', {
      faceDetected: result.data.faceDetected,
      pointCount: result.data.pointCount,
      imageSize: `${result.data.width}x${result.data.height}`,
    });

    return result;
  } catch (error) {
    // AbortError는 타임아웃
    if (error.name === 'AbortError') {
      console.error('❌ 입술 검출 타임아웃 (30초 초과)');
      return {
        success: false,
        error: 'The request timed out. Please check your network connection.',
        data: {
          lipPoints: [],
          faceDetected: false,
          width: 0,
          height: 0,
        },
      };
    }

    // 네트워크 오류
    if (error.message === 'Network request failed' || error.message?.includes('Network')) {
      console.error('❌ 네트워크 오류:', error.message);
      return {
        success: false,
        error: 'Please check your network connection.',
        data: {
          lipPoints: [],
          faceDetected: false,
          width: 0,
          height: 0,
        },
      };
    }

    console.error('❌ 입술 검출 오류:', {
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message || 'Lip detection failed.',
      data: {
        lipPoints: [],
        faceDetected: false,
        width: 0,
        height: 0,
      },
    };
  }
};


