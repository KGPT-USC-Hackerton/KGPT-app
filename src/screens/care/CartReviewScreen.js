// src/screens/care/CartReviewScreen.js
//
// 6B ② 장바구니 검토/승인 화면.
// - 승인 버튼을 누르기 전에는 POST /shopify-cart 를 절대 호출하지 않는다.
// - 첫 승인 탭 즉시 버튼 disabled + 동기 ref 가드로 빠른 이중 탭을 1회로 막는다.
// - cartCreateKey 는 첫 승인 시 useRef에 1회 생성하고, 같은 논리적 요청의 수동 재시도에
//   동일하게 유지한다(새 렌더마다 재생성 금지). 자동 retry 없음.
// - 성공 후에만 예상 금액/통화/disclaimer 를 표시한다(치료비와 합산 금지).
// - checkout_url 은 문자열로 표시하지 않고, https 검증 후 Linking 으로만 연다.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import uuid from 'react-native-uuid';

import { createShopifyCart } from '../../services/agentService';
import { isSafeCheckoutUrl } from '../../utils/checkoutUrl';

// 같은 key로 수동 재시도가 안전한 오류(멱등 재현 or 순수 네트워크성)
const RETRY_SAME_KEY_CODES = new Set([
  'NETWORK_ERROR',
  'AGENT_TIMEOUT',
  'SHOPIFY_CART_IN_PROGRESS',
  'INVALID_RESPONSE',
]);

export default function CartReviewScreen({ route, navigation }) {
  const sessionId = route?.params?.sessionId;
  const proposalHash = route?.params?.proposalHash;
  const selectedItems = route?.params?.selectedItems || [];

  const [phase, setPhase] = useState('review'); // review | submitting | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null); // { code, message }
  const [openError, setOpenError] = useState(null);

  const cartCreateKeyRef = useRef(null); // 논리적 Cart 요청 동안 동일 유지
  const submittingRef = useRef(false); // 동기 이중 탭 가드
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const submitCart = async () => {
    // 동기 가드: 빠른 이중 탭에도 POST는 1회만.
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (!cartCreateKeyRef.current) {
      cartCreateKeyRef.current = String(uuid.v4()); // 첫 승인 시 1회 생성
    }

    setPhase('submitting');
    setError(null);
    setOpenError(null);

    // Cart body에는 product_key/quantity만 전달(display_name 미포함).
    const items = selectedItems.map((it) => ({
      product_key: it.product_key,
      quantity: it.quantity,
    }));

    try {
      const data = await createShopifyCart(
        sessionId,
        { proposal_hash: proposalHash, items },
        cartCreateKeyRef.current,
      );
      if (!mountedRef.current) return;
      setResult(data || null);
      setPhase('success');
    } catch (e) {
      if (!mountedRef.current) return;
      setError({ code: e.errorCode, message: e.message });
      setPhase('error');
    } finally {
      submittingRef.current = false;
    }
  };

  const openCheckout = async () => {
    const url = result && result.checkout_url;
    if (!isSafeCheckoutUrl(url)) {
      setOpenError('결제 페이지 주소를 확인할 수 없어요.');
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        setOpenError('결제 페이지를 열 수 없어요.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      // URL 문자열은 로그하지 않는다.
      setOpenError('결제 페이지를 여는 중 문제가 발생했어요.');
    }
  };

  // --- 렌더 ---

  // 성공 상태
  if (phase === 'success') {
    const total = (result && result.estimated_cart_total) || null;
    const amount = total && typeof total.amount === 'string' ? total.amount : null;
    const currency = total && typeof total.currency_code === 'string' ? total.currency_code : '';
    const isEstimated = !!(total && total.is_estimated);
    const disclaimer = result && typeof result.pricing_disclaimer === 'string' ? result.pricing_disclaimer : null;
    const hasWarnings = Array.isArray(result && result.warnings) && result.warnings.length > 0;
    const checkoutOpenable = isSafeCheckoutUrl(result && result.checkout_url);

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>장바구니가 준비됐어요</Text>

          {amount !== null ? (
            <View style={styles.card}>
              <Text style={styles.totalLabel}>예상 결제 금액</Text>
              <Text style={styles.totalAmount}>
                {amount} {currency}
              </Text>
              {isEstimated && (
                <Text style={styles.totalNote}>예상 금액이며 결제 단계에서 달라질 수 있어요.</Text>
              )}
              {!!disclaimer && <Text style={styles.disclaimer}>{disclaimer}</Text>}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.totalNote}>금액 정보를 불러오지 못했어요.</Text>
            </View>
          )}

          {hasWarnings && (
            <Text style={styles.warnNote}>
              일부 상품은 결제 페이지에서 다시 확인이 필요할 수 있어요.
            </Text>
          )}

          {!!openError && <Text style={styles.errorText}>{openError}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          {checkoutOpenable ? (
            <TouchableOpacity style={styles.primaryButton} onPress={openCheckout}>
              <Text style={styles.primaryButtonText}>결제 진행</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.errorText}>결제 페이지를 여는 중 문제가 발생했어요.</Text>
          )}
        </View>
      </View>
    );
  }

  // 오류 상태
  if (phase === 'error') {
    const code = error && error.code;
    const message = (error && error.message) || '문제가 발생했어요.';
    const isStale = code === 'PRODUCT_PROPOSAL_STALE';
    const canRetry = RETRY_SAME_KEY_CODES.has(code);

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>장바구니를 만들지 못했어요</Text>
          <Text style={styles.errorText}>{message}</Text>
        </ScrollView>
        <View style={styles.footer}>
          {isStale && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                // 추천 화면으로 돌아가 재조회를 강제한다(refreshToken 변경).
                // 세션은 유지되고 추천 GET만 다시 호출된다. 이후 CartReview 재진입은
                // 새 인스턴스라 새 cartCreateKey가 생성된다(이전 stale key 미재사용).
                navigation.navigate({
                  name: 'ProductRecommendation',
                  params: { refreshToken: String(uuid.v4()) },
                  merge: true,
                })
              }
            >
              <Text style={styles.primaryButtonText}>추천 다시 보기</Text>
            </TouchableOpacity>
          )}
          {canRetry && (
            <TouchableOpacity style={styles.primaryButton} onPress={submitCart}>
              <Text style={styles.primaryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 검토 / 제출 중
  const submitting = phase === 'submitting';
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>장바구니 확인</Text>
        <Text style={styles.subtitle}>
          아래 상품으로 Shopify 장바구니를 만들어요. 가격은 장바구니 생성 후에 확인할 수 있어요.
        </Text>

        {selectedItems.map((it) => (
          <View key={it.product_key} style={styles.reviewRow}>
            <Text style={styles.reviewName}>{it.display_name}</Text>
            <Text style={styles.reviewQty}>수량 {it.quantity}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={submitCart}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Shopify 장바구니 만들기</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, marginBottom: 16 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 10,
  },
  reviewName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  reviewQty: { fontSize: 14, color: '#6b7280', marginLeft: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalAmount: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 4 },
  totalNote: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  disclaimer: { fontSize: 12, color: '#9ca3af', marginTop: 8, lineHeight: 18 },
  warnNote: { fontSize: 13, color: '#374151', marginTop: 4 },
  errorText: { fontSize: 14, color: '#dc2626', marginTop: 8 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  buttonDisabled: { backgroundColor: '#9ca3af' },
});
