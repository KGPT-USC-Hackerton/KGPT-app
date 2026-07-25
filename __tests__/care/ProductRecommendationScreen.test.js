// __tests__/care/ProductRecommendationScreen.test.js
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-uuid', () => ({
  __esModule: true,
  default: { v4: () => 'fixed-session-key' },
}));
jest.mock('../../src/services/agentService', () => ({
  createSession: jest.fn(),
  getProductRecommendations: jest.fn(),
  createShopifyCart: jest.fn(),
}));

import ProductRecommendationScreen, {
  __RETRY_CONTROLS,
} from '../../src/screens/care/ProductRecommendationScreen';
import {
  createSession,
  getProductRecommendations,
  createShopifyCart,
} from '../../src/services/agentService';

const navigation = { navigate: jest.fn() };

function renderScreen(params = { history_id: 'hist-1', survey_session_id: 'surv-1' }) {
  return render(<ProductRecommendationScreen route={{ params }} navigation={navigation} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  __RETRY_CONTROLS.sleep = () => Promise.resolve(); // 대기 즉시 통과
});

describe('ProductRecommendationScreen', () => {
  test('진입만으로 Cart API는 호출되지 않는다', async () => {
    createSession.mockResolvedValue({ status: 'ready', session_id: 'sess-1' });
    getProductRecommendations.mockResolvedValue({ items: [], proposal_hash: 'h' });
    renderScreen();
    await waitFor(() => expect(getProductRecommendations).toHaveBeenCalled());
    expect(createShopifyCart).not.toHaveBeenCalled();
  });

  test('Session ready 후 추천 조회 + user_id 미전송', async () => {
    createSession.mockResolvedValue({ status: 'ready', session_id: 'sess-XYZ' });
    getProductRecommendations.mockResolvedValue({ items: [], proposal_hash: 'h' });
    renderScreen();
    await waitFor(() => expect(getProductRecommendations).toHaveBeenCalledWith('sess-XYZ'));
    expect(createSession).toHaveBeenCalledWith(
      { history_id: 'hist-1', survey_session_id: 'surv-1' },
      'fixed-session-key',
    );
    expect(JSON.stringify(createSession.mock.calls[0])).not.toContain('user_id');
  });

  test('202 waiting은 최대 3회, 동일 sessionCreateKey, 이후 수동 재시도 UI', async () => {
    createSession.mockResolvedValue({ status: 'waiting_for_analysis', retry_after_seconds: 2 });
    const { getByText } = renderScreen();
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(3));
    createSession.mock.calls.forEach((call) => expect(call[1]).toBe('fixed-session-key'));
    await waitFor(() => getByText('다시 시도'));
    expect(getProductRecommendations).not.toHaveBeenCalled();
  });

  test('전체 해제 시작 / 미선택 시 이동 안됨 / evidence·가격 미표시 / 선택 후 이동', async () => {
    createSession.mockResolvedValue({ status: 'ready', session_id: 'sess-1' });
    getProductRecommendations.mockResolvedValue({
      proposal_hash: 'hash-1',
      items: [
        {
          product_key: 'TOOTHBRUSH_SOFT',
          display_name: '부드러운 칫솔',
          quantity: 1,
          rationale: '일상적인 구강 위생 관리를 위한 기본 칫솔입니다.',
          reason_code: 'GENERAL_DAILY_HYGIENE',
          evidence: [{ source: 'survey_answer', question_code: 'SECRET_Q', answer_code: 'YES' }],
        },
      ],
    });
    const { getByText, queryByText } = renderScreen();
    await waitFor(() => getByText('부드러운 칫솔'));

    // 미선택 상태: 검토 눌러도 이동 없음
    fireEvent.press(getByText('장바구니 검토'));
    expect(navigation.navigate).not.toHaveBeenCalled();

    // evidence 원문/설문 코드 미표시
    expect(queryByText('SECRET_Q')).toBeNull();

    // 선택 후 이동 (부분집합, display_name 포함은 UI 표시용으로 route에만 전달)
    fireEvent.press(getByText('부드러운 칫솔'));
    fireEvent.press(getByText('장바구니 검토 (1)'));
    expect(navigation.navigate).toHaveBeenCalledWith('CartReview', {
      sessionId: 'sess-1',
      proposalHash: 'hash-1',
      selectedItems: [{ product_key: 'TOOTHBRUSH_SOFT', quantity: 1, display_name: '부드러운 칫솔' }],
    });
  });

  test('STALE 재조회: refreshToken 변경 시 추천 GET 재호출 + 새 proposal_hash + 선택 초기화 + 세션 재생성 없음', async () => {
    createSession.mockResolvedValue({ status: 'ready', session_id: 'sess-1' });
    getProductRecommendations
      .mockResolvedValueOnce({
        proposal_hash: 'hash-1',
        items: [{ product_key: 'A', display_name: '상품A', quantity: 1, rationale: 'r', reason_code: 'GENERAL_DAILY_HYGIENE' }],
      })
      .mockResolvedValueOnce({
        proposal_hash: 'hash-2',
        items: [{ product_key: 'B', display_name: '상품B', quantity: 2, rationale: 'r2', reason_code: 'GENERAL_DAILY_HYGIENE' }],
      });

    const { getByText, queryByText, rerender } = render(
      <ProductRecommendationScreen
        route={{ params: { history_id: 'h', survey_session_id: 's' } }}
        navigation={navigation}
      />,
    );
    await waitFor(() => getByText('상품A'));
    fireEvent.press(getByText('상품A')); // 선택해 둠(이후 초기화되어야 함)

    // refreshToken 부여 → 재조회 트리거
    rerender(
      <ProductRecommendationScreen
        route={{ params: { history_id: 'h', survey_session_id: 's', refreshToken: 'r1' } }}
        navigation={navigation}
      />,
    );
    await waitFor(() => getByText('상품B'));

    expect(queryByText('상품A')).toBeNull(); // items 교체됨
    expect(getProductRecommendations).toHaveBeenCalledTimes(2); // 추천 GET 재호출
    expect(createSession).toHaveBeenCalledTimes(1); // 세션 재생성 없음

    // 선택 초기화 확인: 미선택이라 검토 눌러도 이동 없음
    navigation.navigate.mockClear();
    fireEvent.press(getByText('장바구니 검토'));
    expect(navigation.navigate).not.toHaveBeenCalled();

    // 새로 선택 후 이동 → 새 proposal_hash 반영
    fireEvent.press(getByText('상품B'));
    fireEvent.press(getByText('장바구니 검토 (1)'));
    expect(navigation.navigate).toHaveBeenCalledWith('CartReview', {
      sessionId: 'sess-1',
      proposalHash: 'hash-2',
      selectedItems: [{ product_key: 'B', quantity: 2, display_name: '상품B' }],
    });
  });

  test('알 수 없는 reason_code는 배지를 표시하지 않는다', async () => {
    createSession.mockResolvedValue({ status: 'ready', session_id: 'sess-1' });
    getProductRecommendations.mockResolvedValue({
      proposal_hash: 'h',
      items: [
        {
          product_key: 'X',
          display_name: '알수없는상품',
          quantity: 1,
          rationale: 'r',
          reason_code: 'TOTALLY_UNKNOWN_CODE',
        },
      ],
    });
    const { getByText, queryByText } = renderScreen();
    await waitFor(() => getByText('알수없는상품'));
    expect(queryByText('TOTALLY_UNKNOWN_CODE')).toBeNull();
  });
});
