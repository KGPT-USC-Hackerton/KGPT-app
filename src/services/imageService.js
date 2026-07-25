import { get, del, uploadFormData } from './api';
import { getUser } from '../utils/storage';

/**
 * 이미지 업로드
 */
export const uploadImage = async (file, options = {}, onProgress = null) => {
  try {
    let imageUri = file.uri;
    if (imageUri.startsWith('file://')) {
      imageUri = imageUri;
    }

    const fileName =
      file.fileName || file.originalFileName || `image_${Date.now()}.jpg`;

    let mimeType = file.type || 'image/jpeg';
    if (!mimeType && fileName) {
      const ext = fileName.split('.').pop().toLowerCase();
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      mimeType = mimeTypes[ext] || 'image/jpeg';
    }

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: mimeType,
      name: fileName,
    });

    if (options.user_id) formData.append('user_id', options.user_id.toString());
    if (options.image_type) formData.append('image_type', options.image_type);
    if (options.position) formData.append('position', options.position);

    if (onProgress) {
      onProgress(10);
      setTimeout(() => onProgress(50), 100);
      setTimeout(() => onProgress(80), 200);
    }

    const response = await uploadFormData('/images/upload', formData);

    if (onProgress) onProgress(100);

    console.log('uploadImage 응답:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('uploadImage 상세 오류:', {
      error,
      file: {
        uri: file?.uri,
        type: file?.type,
        fileName: file?.fileName,
      },
      options,
    });

    throw {
      status: error.status || 500,
      message: error.message || getErrorMessage(error.status, 'image upload'),
      data: error.data || null,
    };
  }
};

/**
 * 이미지 1장 상태 조회
 */
export const getImageStatus = async imageId => {
  try {
    return await get(`/images/${imageId}/status`);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'analysis status check'),
      data: error.data || null,
    };
  }
};

/**
 * 이미지 1장 분석 결과 조회
 */
export const getImageAnalysis = async imageId => {
  try {
    return await get(`/images/${imageId}/analysis`);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'analysis result retrieval'),
      data: error.data || null,
    };
  }
};

/**
 * 사용자 이미지 목록 조회
 */
export const getUserImages = async (userId, options = {}) => {
  try {
    let endpoint = `/images/user/${userId}`;
    const queryParams = [];

    if (options.status) queryParams.push(`status=${options.status}`);
    if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;

    return await get(endpoint);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'image list retrieval'),
      data: error.data || null,
    };
  }
};

/**
 * 이미지 삭제
 */
export const deleteImage = async imageId => {
  try {
    return await del(`/images/${imageId}`);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'image deletion'),
      data: error.data || null,
    };
  }
};

/**
 * 이미지 1장 폴링
 */
export const pollAnalysisStatus = async (imageId, options = {}) => {
  const { interval = 2500, maxAttempts = 60, onStatusChange = null } = options;

  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;

        const statusResponse = await getImageStatus(imageId);
        const status = statusResponse.data?.analysis_status;

        if (onStatusChange) onStatusChange(status, attempts);

        if (status === 'completed') {
          const analysisResponse = await getImageAnalysis(imageId);
          resolve(analysisResponse);
          return;
        }

        if (status === 'failed') {
          reject({
            status: 500,
            message: 'Analysis failed. Please try again.',
            data: statusResponse.data,
          });
          return;
        }

        if (attempts >= maxAttempts) {
          reject({
            status: 408,
            message: 'Analysis timed out. Please check back in a moment.',
            data: statusResponse.data,
          });
          return;
        }

        setTimeout(poll, interval);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};

/**
 * History ID 기반 분석 결과 조회 (3장 세트)
 */
export const getHistoryAnalysis = async historyId => {
  try {
    return await get(`/images/history/${historyId}/analysis`);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'analysis result retrieval'),
      data: error.data || null,
    };
  }
};

/**
 * 사용자 history_id 목록 조회
 */
export const getUserHistories = async userId => {
  try {
    return await get(`/images/user/${userId}/histories`);
  } catch (error) {
    throw {
      status: error.status || 500,
      message: getErrorMessage(error.status, 'history list retrieval'),
      data: error.data || null,
    };
  }
};

/**
 * History ID 기반 분석 폴링 (3장 세트 분석 완료 대기)
 */
export const pollHistoryAnalysisStatus = async (historyId, options = {}) => {
  const { interval = 2500, maxAttempts = 60, onStatusChange = null } = options;

  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;

        const response = await getHistoryAnalysis(historyId);

        const images = response.data?.images || {};
        const upper = images.upper;
        const lower = images.lower;
        const front = images.front;

        const allCompleted =
          upper?.analysis_status === 'completed' &&
          lower?.analysis_status === 'completed' &&
          front?.analysis_status === 'completed';

        const anyFailed =
          upper?.analysis_status === 'failed' ||
          lower?.analysis_status === 'failed' ||
          front?.analysis_status === 'failed';

        if (onStatusChange) {
          let status = 'processing';
          if (allCompleted) status = 'completed';
          else if (anyFailed) status = 'failed';
          onStatusChange(status, attempts);
        }

        if (allCompleted) {
          resolve(response);
          return;
        }

        if (anyFailed) {
          reject({
            status: 500,
            message: 'Analysis failed for some images.',
            data: response.data,
          });
          return;
        }

        if (attempts >= maxAttempts) {
          reject({
            status: 408,
            message: 'Analysis timed out. Please check back in a moment.',
            data: response.data,
          });
          return;
        }

        setTimeout(poll, interval);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};

/**
 * 에러 메시지 매핑
 */
const getErrorMessage = (status, action) => {
  switch (status) {
    case 400:
      return `Invalid ${action} request.`;
    case 401:
      return 'Authentication is required.';
    case 403:
      return 'You do not have access permission.';
    case 404:
      return 'The requested resource was not found.';
    case 408:
      return 'The request timed out.';
    case 500:
      return 'A server error occurred.';
    case 503:
      return 'The service is unavailable.';
    default:
      return `An error occurred during ${action}.`;
  }
};
