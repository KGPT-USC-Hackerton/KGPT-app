// __tests__/care/CartReviewScreen.test.js
import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockV4 = jest.fn(() => 'fixed-cart-key');
jest.mock('react-native-uuid', () => ({
  __esModule: true,
  default: { v4: (...args) => mockV4(...args) },
}));
jest.mock('../../src/services/agentService', () => ({
  createSession: jest.fn(),
  getProductRecommendations: jest.fn(),
  createShopifyCart: jest.fn(),
}));

import CartReviewScreen from '../../src/screens/care/CartReviewScreen';
import { createShopifyCart } from '../../src/services/agentService';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const baseParams = {
  sessionId: 'sess-1',
  proposalHash: 'h'.repeat(64),
  selectedItems: [{ product_key: 'TOOTHBRUSH_SOFT', quantity: 1, display_name: '부드러운 칫솔' }],
};

function renderScreen(params = baseParams) {
  return render(<CartReviewScreen route={{ params }} navigation={navigation} />);
}

const successData = (checkoutUrl) => ({
  status: 'succeeded',
  checkout_url: checkoutUrl,
  estimated_cart_total: { amount: '18.97', currency_code: 'USD', is_estimated: true },
  pricing_disclaimer: '결제 단계에서 금액이 달라질 수 있습니다.',
  warnings: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockV4.mockReset();
  mockV4.mockReturnValue('fixed-cart-key');
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('CartReviewScreen', () => {
  test('승인 전에는 Cart POST 0회', () => {
    renderScreen();
    expect(createShopifyCart).not.toHaveBeenCalled();
  });

  test('첫 승인 후 POST 1회 + 부분집합만/ display_name·user_id 미전송 + 동일 key', async () => {
    createShopifyCart.mockResolvedValue(successData('https://checkout.invalid/abc'));
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => expect(createShopifyCart).toHaveBeenCalledTimes(1));

    const [sid, payload, key] = createShopifyCart.mock.calls[0];
    expect(sid).toBe('sess-1');
    expect(payload).toEqual({
      proposal_hash: 'h'.repeat(64),
      items: [{ product_key: 'TOOTHBRUSH_SOFT', quantity: 1 }],
    });
    expect(key).toBe('fixed-cart-key');
    expect(JSON.stringify(payload)).not.toContain('display_name');
    expect(JSON.stringify(createShopifyCart.mock.calls[0])).not.toContain('user_id');
  });

  test('빠른 이중 탭에도 POST 1회', async () => {
    createShopifyCart.mockResolvedValue(successData('https://checkout.invalid/abc'));
    const { getByText } = renderScreen();
    const btn = getByText('Shopify 장바구니 만들기');
    fireEvent.press(btn);
    fireEvent.press(btn); // 동기 이중 탭
    await waitFor(() => expect(createShopifyCart).toHaveBeenCalledTimes(1));
  });

  test('네트워크 오류 → 수동 재시도 시 동일 cartCreateKey', async () => {
    createShopifyCart
      .mockRejectedValueOnce({ status: 0, errorCode: 'NETWORK_ERROR', message: '네트워크 연결을 확인해 주세요.' })
      .mockResolvedValueOnce(successData('https://checkout.invalid/x'));
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('다시 시도'));
    fireEvent.press(getByText('다시 시도'));
    await waitFor(() => expect(createShopifyCart).toHaveBeenCalledTimes(2));
    expect(createShopifyCart.mock.calls[0][2]).toBe('fixed-cart-key');
    expect(createShopifyCart.mock.calls[1][2]).toBe('fixed-cart-key');
  });

  test('PRODUCT_PROPOSAL_STALE → 추천 재조회 트리거(refreshToken merge), 자동 재시도 없음', async () => {
    createShopifyCart.mockRejectedValue({ status: 409, errorCode: 'PRODUCT_PROPOSAL_STALE', message: '추천이 변경되었어요.' });
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('추천 다시 보기'));
    expect(createShopifyCart).toHaveBeenCalledTimes(1);
    expect(queryByText('다시 시도')).toBeNull();

    fireEvent.press(getByText('추천 다시 보기'));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    const arg = navigation.navigate.mock.calls[0][0];
    expect(arg).toEqual(
      expect.objectContaining({
        name: 'ProductRecommendation',
        merge: true,
        params: expect.objectContaining({ refreshToken: expect.any(String) }),
      }),
    );
  });

  test('Cart 재진입(재mount) 시 새 cartCreateKey 사용(이전 stale key 미재사용)', async () => {
    mockV4.mockReturnValueOnce('cart-key-1').mockReturnValueOnce('cart-key-2');
    createShopifyCart.mockResolvedValue(successData('https://checkout.invalid/abc'));

    const first = renderScreen();
    fireEvent.press(first.getByText('Shopify 장바구니 만들기'));
    await waitFor(() => expect(createShopifyCart).toHaveBeenCalledTimes(1));
    first.unmount();

    const second = renderScreen();
    fireEvent.press(second.getByText('Shopify 장바구니 만들기'));
    await waitFor(() => expect(createShopifyCart).toHaveBeenCalledTimes(2));

    expect(createShopifyCart.mock.calls[0][2]).toBe('cart-key-1');
    expect(createShopifyCart.mock.calls[1][2]).toBe('cart-key-2');
    expect(createShopifyCart.mock.calls[0][2]).not.toBe(createShopifyCart.mock.calls[1][2]);
  });

  test('SHOPIFY_CART_IN_PROGRESS → 안내, 자동 재시도 없음', async () => {
    createShopifyCart.mockRejectedValue({ status: 409, errorCode: 'SHOPIFY_CART_IN_PROGRESS', message: '처리 중이에요.' });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('처리 중이에요.'));
    expect(createShopifyCart).toHaveBeenCalledTimes(1);
  });

  test('SHOPIFY_CART_OUTCOME_UNKNOWN → Checkout 버튼 없음', async () => {
    createShopifyCart.mockRejectedValue({ status: 502, errorCode: 'SHOPIFY_CART_OUTCOME_UNKNOWN', message: '결과를 확인하지 못했어요.' });
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('결과를 확인하지 못했어요.'));
    expect(queryByText('결제 진행')).toBeNull();
    expect(queryByText('다시 시도')).toBeNull();
  });

  test('성공 시 예상 금액/통화/disclaimer 표시, checkout URL 문자열 미노출', async () => {
    createShopifyCart.mockResolvedValue(successData('https://checkout.invalid/abc'));
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('결제 진행'));
    expect(getByText(/18\.97/)).toBeTruthy();
    expect(getByText(/USD/)).toBeTruthy();
    expect(getByText('결제 단계에서 금액이 달라질 수 있습니다.')).toBeTruthy();
    expect(queryByText('https://checkout.invalid/abc')).toBeNull();
  });

  test('유효한 https checkout에서만 Linking 호출', async () => {
    createShopifyCart.mockResolvedValue(successData('https://checkout.invalid/abc'));
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('결제 진행'));
    fireEvent.press(getByText('결제 진행'));
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.invalid/abc'),
    );
    expect(Linking.canOpenURL).toHaveBeenCalledWith('https://checkout.invalid/abc');
  });

  test('http checkout URL은 거부(결제 진행 버튼 없음)', async () => {
    createShopifyCart.mockResolvedValue(successData('http://checkout.invalid/abc'));
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('장바구니가 준비됐어요'));
    expect(queryByText('결제 진행')).toBeNull();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test('userinfo 포함 URL은 거부(결제 진행 버튼 없음)', async () => {
    createShopifyCart.mockResolvedValue(successData('https://user:pass@checkout.invalid/abc'));
    const { getByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Shopify 장바구니 만들기'));
    await waitFor(() => getByText('장바구니가 준비됐어요'));
    expect(queryByText('결제 진행')).toBeNull();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
