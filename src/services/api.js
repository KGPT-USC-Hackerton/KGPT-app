import Config from 'react-native-config';

// API 기본 설정
const API_BASE_URL = Config.API_BASE_URL;

// 공통 fetch 함수
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    // ngrok 무료 플랜 브라우저 경고 페이지 우회 (직접 IP 접속 시엔 무시됨)
    'ngrok-skip-browser-warning': 'true',
  };

  // 토큰이 있으면 헤더에 추가 (나중에 JWT 토큰 사용 시)
  const token = await import('../utils/storage').then(m => m.getToken());
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.message || 'An error occurred while processing the request.',
        data: data,
      };
    }

    return data;
  } catch (error) {
    // 네트워크 오류 처리
    if (error.message === 'Network request failed') {
      throw {
        status: 0,
        message: 'Please check your network connection.',
        data: null,
      };
    }
    throw error;
  }
};

// GET 요청
export const get = (endpoint, options = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'GET',
  });
};

// POST 요청
export const post = (endpoint, body, options = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
};

// PUT 요청
export const put = (endpoint, body, options = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

// DELETE 요청
export const del = (endpoint, options = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'DELETE',
  });
};

// FormData 업로드 (이미지 등) - 타임아웃 및 재시도 로직 포함
export const uploadFormData = async (endpoint, formData, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = options.timeout || 60000; // 기본 60초 타임아웃
  const maxRetries = options.maxRetries || 2; // 최대 2회 재시도
  const retryDelay = options.retryDelay || 1000; // 재시도 간격 1초
  
  const defaultHeaders = {};
  
  // 토큰이 있으면 헤더에 추가
  const token = await import('../utils/storage').then(m => m.getToken());
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const makeRequest = async (attempt = 0) => {
    // AbortController로 타임아웃 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const config = {
      ...options,
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...defaultHeaders,
        ...options.headers,
        // FormData 사용 시 Content-Type은 자동으로 설정되므로 명시하지 않음
      },
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'An error occurred during upload.',
          data: data,
        };
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // AbortError는 타임아웃
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
        throw {
          status: 408,
          message: 'The upload timed out. Please check your network connection.',
          data: null,
          error: error.message || 'Request timeout',
        };
      }
      
      // 네트워크 오류 처리
      if (error.message === 'Network request failed' || error.message?.includes('Network')) {
        throw {
          status: 0,
          message: 'Please check your network connection.',
          data: null,
          error: error.message,
        };
      }
      
      // 재시도 가능한 오류인지 확인 (5xx 서버 오류 또는 타임아웃)
      const isRetryable = 
        (error.status >= 500 && error.status < 600) || 
        error.status === 408 || 
        error.status === 0 ||
        attempt < maxRetries;
      
      if (isRetryable && attempt < maxRetries) {
        console.log(`🔄 업로드 재시도 ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        return makeRequest(attempt + 1);
      }
      
      throw error;
    }
  };

  return makeRequest();
};
  
  
// ============================================
// 치과 API
// ============================================

// 주변 치과 검색
export const getNearbyDentists = async (latitude, longitude, radius = 5) => {
  try {
    const response = await get(`/clinics/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);
    return response;
  } catch (error) {
    console.error('주변 치과 검색 실패:', error);
    throw error;
  }
};

// 전체 치과 목록 (페이지네이션)
export const getClinics = async (page = 1, limit = 20) => {
  try {
    const response = await get(`/clinics?page=${page}&limit=${limit}`);
    return response;
  } catch (error) {
    console.error('치과 목록 조회 실패:', error);
    throw error;
  }
};

// 사용자의 예약 목록 조회
export const getUserAppointments = async (userId, status = null) => {
  try {
    let endpoint = `/users/${userId}/appointments`;
    if (status) {
      endpoint += `?status=${status}`;
    }
    const response = await get(endpoint);
    return response;
  } catch (error) {
    console.error('예약 목록 조회 실패:', error);
    throw error;
  }
};

// 예약 가능한 날짜 조회
export const getAvailableDates = async (clinicId, fromDate = null, toDate = null) => {
  try {
    let endpoint = `/clinics/${clinicId}/available-dates`;
    const params = [];
    if (fromDate) params.push(`from_date=${fromDate}`);
    if (toDate) params.push(`to_date=${toDate}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;
    const response = await get(endpoint);
    return response;
  } catch (error) {
    console.error('예약 가능한 날짜 조회 실패:', error);
    throw error;
  }
};

// 예약 가능한 시간 조회
export const getAvailableSlots = async (clinicId, date) => {
  try {
    const response = await get(`/clinics/${clinicId}/available-slots?date=${date}`);
    return response;
  } catch (error) {
    console.error('예약 가능한 시간 조회 실패:', error);
    throw error;
  }
};

// 사전 자가진단 설문 질문 조회
export const getSurveyQuestions = async () => {
  try {
    const response = await get('/appointments/surveys/questions');
    return response;
  } catch (error) {
    console.error('설문 질문 조회 실패:', error);
    throw error;
  }
};

// 예약 생성
export const createAppointment = async (appointmentData) => {
  try {
    const response = await post('/appointments', appointmentData);
    return response;
  } catch (error) {
    console.error('예약 생성 실패:', error);
    throw error;
  }
};