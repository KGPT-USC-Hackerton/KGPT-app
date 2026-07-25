// __tests__/services/authService.test.js
// 회원가입/로그인 성공 시 user_id 저장 회귀 테스트.
// 실제 네트워크·Secret 없이 api 계층과 AsyncStorage 를 mock 한다.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'https://api.invalid/api',
  },
}));

jest.mock('../../src/services/api', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../../src/utils/storage', () => ({
  setUser: jest.fn(async () => {}),
  getUser: jest.fn(async () => null),
  removeUser: jest.fn(async () => {}),
  clearAuthData: jest.fn(async () => {}),
  setSurveyCompleted: jest.fn(async () => {}),
  removeTempSignUpData: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { post } from '../../src/services/api';
import { setUser, setSurveyCompleted } from '../../src/utils/storage';
import { register, login } from '../../src/services/authService';

const FAKE_USER = { id: 42, username: 'e2e-fake.invalid', name: '테스트' };

afterEach(() => {
  jest.clearAllMocks();
});

describe('register', () => {
  test('회원가입 성공 응답의 user.id 를 AsyncStorage user_id 에 저장한다', async () => {
    post.mockResolvedValueOnce({ success: true, data: { user: FAKE_USER } });

    await register({ username: 'e2e-fake.invalid', password: 'pw', name: '테스트' });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user_id', '42');
  });

  test('user_id 저장이 register 반환 이전에 완료된다', async () => {
    const order = [];
    post.mockResolvedValueOnce({ success: true, data: { user: FAKE_USER } });
    AsyncStorage.setItem.mockImplementationOnce(async () => {
      order.push('setItem');
    });

    await register({ username: 'e2e-fake.invalid', password: 'pw', name: '테스트' });
    order.push('registerResolved');

    expect(order).toEqual(['setItem', 'registerResolved']);
  });

  test('사용자 정보와 설문 완료 플래그도 함께 저장한다', async () => {
    post.mockResolvedValueOnce({ success: true, data: { user: FAKE_USER } });

    await register({ username: 'e2e-fake.invalid', password: 'pw', name: '테스트' });

    expect(setUser).toHaveBeenCalledWith(FAKE_USER);
    expect(setSurveyCompleted).toHaveBeenCalledWith(true);
  });

  test('실패 응답에서는 user_id 를 저장하지 않는다', async () => {
    post.mockResolvedValueOnce({ success: false, message: '이미 사용 중인 아이디입니다.' });

    await register({ username: 'e2e-fake.invalid', password: 'pw', name: '테스트' });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test('user 는 있으나 id 가 없으면 0 등으로 fallback 하지 않는다', async () => {
    post.mockResolvedValueOnce({ success: true, data: { user: { username: 'no-id.invalid' } } });

    await register({ username: 'no-id.invalid', password: 'pw', name: '테스트' });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  test('로그인 성공 시 기존 동작(사용자 정보 저장)이 유지된다', async () => {
    post.mockResolvedValueOnce({ success: true, data: { user: FAKE_USER } });

    const response = await login('e2e-fake.invalid', 'pw');

    expect(response.success).toBe(true);
    expect(setUser).toHaveBeenCalledWith(FAKE_USER);
    expect(setSurveyCompleted).toHaveBeenCalledWith(true);
  });

  test('로그인 실패 시 사용자 정보를 저장하지 않는다', async () => {
    post.mockResolvedValueOnce({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });

    await login('e2e-fake.invalid', 'wrong');

    expect(setUser).not.toHaveBeenCalled();
  });
});
