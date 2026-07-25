import AsyncStorage from '@react-native-async-storage/async-storage';
import { post, get } from './api';
import { setUser, getUser, removeUser, clearAuthData, setSurveyCompleted, removeTempSignUpData } from '../utils/storage';

/**
 * 회원가입
 * @param {Object} userData - { username, password, name, phone?, email?, surveyAnswers? }
 * @returns {Promise<Object>} - { success, message, data: { user } }
 */
export const register = async (userData) => {
  try {
    const response = await post('/users/register', userData);
    
    if (response.success && response.data?.user) {
      const user = response.data.user;

      // 사용자 정보 저장
      await setUser(user);
      // CareScreen 등이 읽는 user_id 키도 로그인 경로와 동일하게 저장한다.
      // 이 값이 없으면 가입 직후 첫 설문 제출이 user_id 없이 전송되어 실패한다.
      if (user.id !== undefined && user.id !== null) {
        await AsyncStorage.setItem('user_id', String(user.id));
      }
      // 설문 완료 여부 저장
      await setSurveyCompleted(true);
      // 임시 회원가입 정보 삭제
      await removeTempSignUpData();
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 로그인
 * @param {string} username - 사용자 아이디
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} - { success, message, data: { user } }
 */
export const login = async (username, password) => {
  try {
    const response = await post('/users/login', { username, password });
    
    if (response.success && response.data?.user) {
      // 사용자 정보 저장
      await setUser(response.data.user);
      // 로그인한 사용자는 이미 설문을 완료한 것으로 간주 (DB에 저장된 사용자)
      await setSurveyCompleted(true);
      // 나중에 JWT 토큰이 추가되면 여기서 토큰도 저장
      // await setToken(response.data.token);
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 로그아웃
 */
export const logout = async () => {
  try {
    await clearAuthData();
    return { success: true, message: '로그아웃되었습니다.' };
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
  }
};

/**
 * 현재 사용자 정보 조회 (저장된 정보)
 * @returns {Promise<Object|null>} - 사용자 정보 또는 null
 */
export const getCurrentUser = async () => {
  try {
    const user = await getUser();
    return user;
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return null;
  }
};

/**
 * 사용자 정보 조회 (서버에서)
 * @param {number} userId - 사용자 ID
 * @returns {Promise<Object>} - 사용자 정보
 */
export const getUserById = async (userId) => {
  try {
    const response = await get(`/users/${userId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 설문 완료 여부 조회
 * @returns {Promise<boolean>} - 설문 완료 여부
 */
export const checkSurveyCompleted = async () => {
  try {
    const { getSurveyCompleted } = await import('../utils/storage');
    return await getSurveyCompleted();
  } catch (error) {
    console.error('설문 완료 여부 조회 오류:', error);
    return false;
  }
};

