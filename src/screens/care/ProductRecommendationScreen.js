// src/screens/care/ProductRecommendationScreen.js
//
// 6B ① 맞춤 상품 추천 화면.
// - 진입(=사용자가 Care 결과에서 CTA를 누른 뒤)에만 Agent Session을 생성한다.
// - Session ready 후 상품 추천을 조회한다.
// - 202 waiting은 제한적(최대 3회, 총 30초, 각 대기 최대 10초)으로만 자동 재시도한다.
// - 표시: display_name / quantity / rationale / 안전 매핑된 reason 문구 / 선택 상태.
//   evidence / 설문 답변 / 의료정보 / reason_code 원문 / variant GID / 가격 / checkout URL 미표시.
// - 상품은 전체 해제 상태로 시작하며, 하나 이상 선택해야 "장바구니 검토"가 활성화된다.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import uuid from 'react-native-uuid';

import { createSession, getProductRecommendations } from '../../services/agentService';
import { getReasonLabel } from '../../constants/reasonCodeLabels';

// 202 waiting 정책
const MAX_SESSION_ATTEMPTS = 3; // 자동 createSession 호출 횟수 상한
const MAX_TOTAL_WAIT_MS = 30000; // 총 대기 상한
const MAX_SINGLE_WAIT_MS = 10000; // 1회 대기 상한
const DEFAULT_WAIT_MS = 2000; // retry_after_seconds가 없거나 비정상일 때

// 테스트에서 대기를 즉시 통과시킬 수 있도록 분리(런타임에는 실제 setTimeout).
export const __RETRY_CONTROLS = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export default function ProductRecommendationScreen({ route, navigation }) {
  const historyId = route?.params?.history_id;
  const surveySessionId = route?.params?.survey_session_id;

  // phase: session | waiting | waiting_manual | recs | ready | empty | error
  const [phase, setPhase] = useState('session');
  const [error, setError] = useState(null); // { code, message }
  const [sessionId, setSessionId] = useState(null);
  const [items, setItems] = useState([]);
  const [proposalHash, setProposalHash] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const sessionCreateKeyRef = useRef(null); // 논리적 Session 요청 동안 동일 유지
  const mountedRef = useRef(true);
  const lastRefreshRef = useRef(route?.params?.refreshToken); // STALE 재조회 트리거 추적

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isMounted = () => mountedRef.current;

  // 상품 추천 조회
  const loadRecommendations = async (sid) => {
    setSessionId(sid);
    setPhase('recs');
    setError(null);
    let data;
    try {
      data = await getProductRecommendations(sid);
    } catch (e) {
      if (!isMounted()) return;
      setError({ code: e.errorCode, message: e.message });
      setPhase('error');
      return;
    }
    if (!isMounted()) return;
    const list = Array.isArray(data && data.items) ? data.items : [];
    setProposalHash(typeof (data && data.proposal_hash) === 'string' ? data.proposal_hash : null);
    setItems(list);
    setSelected(new Set()); // 전체 해제 상태로 시작
    setPhase(list.length === 0 ? 'empty' : 'ready');
  };

  // STALE 등으로 추천만 다시 조회한다(Agent Session은 재생성하지 않음).
  // 오류/선택 상태를 초기화하고, sessionId가 있으면 추천 GET만 재호출한다.
  const refreshRecommendations = async () => {
    setError(null);
    setSelected(new Set());
    setProposalHash(null);
    if (sessionId) {
      await loadRecommendations(sessionId);
    } else {
      await runSessionFlow();
    }
  };

  // Session 생성(+202 제한적 재시도) → ready면 추천 조회
  const runSessionFlow = async () => {
    setPhase('session');
    setError(null);
    let totalWaited = 0;

    for (let attempt = 1; attempt <= MAX_SESSION_ATTEMPTS; attempt++) {
      let data;
      try {
        data = await createSession(
          { history_id: historyId, survey_session_id: surveySessionId },
          sessionCreateKeyRef.current,
        );
      } catch (e) {
        if (!isMounted()) return;
        setError({ code: e.errorCode, message: e.message });
        setPhase('error');
        return;
      }
      if (!isMounted()) return;

      if (data && data.status === 'ready' && data.session_id) {
        await loadRecommendations(data.session_id);
        return;
      }

      if (data && data.status === 'waiting_for_analysis') {
        if (attempt >= MAX_SESSION_ATTEMPTS) break;
        let waitMs = Number(data.retry_after_seconds) * 1000;
        if (!Number.isFinite(waitMs) || waitMs <= 0) waitMs = DEFAULT_WAIT_MS;
        if (waitMs > MAX_SINGLE_WAIT_MS) waitMs = MAX_SINGLE_WAIT_MS;
        if (totalWaited + waitMs > MAX_TOTAL_WAIT_MS) break;
        totalWaited += waitMs;
        setPhase('waiting');
        await __RETRY_CONTROLS.sleep(waitMs);
        if (!isMounted()) return;
        continue;
      }

      // 예상치 못한 응답 형식
      setError({ code: 'INVALID_RESPONSE', message: '분석 상태를 확인할 수 없어요. 다시 시도해 주세요.' });
      setPhase('error');
      return;
    }

    // 자동 재시도 상한 초과 → 수동 재시도 UI (동일 sessionCreateKey 유지)
    if (!isMounted()) return;
    setPhase('waiting_manual');
  };

  useEffect(() => {
    if (typeof historyId !== 'string' || historyId.trim() === '') {
      setError({ code: 'INVALID_PARAMS', message: '분석 정보를 찾을 수 없어요. 이전 화면에서 다시 시도해 주세요.' });
      setPhase('error');
      return;
    }
    if (!sessionCreateKeyRef.current) {
      sessionCreateKeyRef.current = String(uuid.v4());
    }
    runSessionFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // STALE 재조회: CartReview의 "추천 다시 보기"가 refreshToken을 바꾸면 추천만 다시 조회.
  // 최초 mount(초기 refreshToken)에서는 실행되지 않는다.
  useEffect(() => {
    const token = route?.params?.refreshToken;
    if (token !== lastRefreshRef.current) {
      lastRefreshRef.current = token;
      refreshRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.refreshToken]);

  // 재시도: 세션이 이미 있으면 추천만 다시, 아니면 세션 흐름 재실행(같은 key)
  const onRetry = () => {
    if (sessionId) {
      loadRecommendations(sessionId);
    } else {
      runSessionFlow();
    }
  };

  const toggle = (productKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productKey)) {
        next.delete(productKey);
      } else {
        next.add(productKey);
      }
      return next;
    });
  };

  const goReview = () => {
    const selectedItems = items
      .filter((it) => selected.has(it.product_key))
      .map((it) => ({
        product_key: it.product_key,
        quantity: it.quantity,
        display_name: it.display_name, // UI 표시용(Cart body에는 미포함)
      }));
    if (selectedItems.length === 0) return;
    navigation.navigate('CartReview', {
      sessionId,
      proposalHash,
      selectedItems,
    });
  };

  // --- 렌더 ---
  const renderCenter = (children) => (
    <View style={styles.center}>{children}</View>
  );

  if (phase === 'session' || phase === 'recs') {
    return (
      <View style={styles.container}>
        {renderCenter(
          <>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.centerText}>
              {phase === 'session' ? '분석 세션을 준비하고 있어요...' : '맞춤 상품을 불러오는 중...'}
            </Text>
          </>,
        )}
      </View>
    );
  }

  if (phase === 'waiting') {
    return (
      <View style={styles.container}>
        {renderCenter(
          <>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.centerText}>분석 결과를 준비 중이에요. 잠시만 기다려 주세요...</Text>
          </>,
        )}
      </View>
    );
  }

  if (phase === 'waiting_manual') {
    return (
      <View style={styles.container}>
        {renderCenter(
          <>
            <Text style={styles.centerTitle}>분석 준비 중</Text>
            <Text style={styles.centerText}>
              분석 결과가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
              <Text style={styles.primaryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </>,
        )}
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        {renderCenter(
          <>
            <Text style={styles.centerTitle}>불러오지 못했어요</Text>
            <Text style={styles.centerText}>{(error && error.message) || '문제가 발생했어요.'}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
              <Text style={styles.primaryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </>,
        )}
      </View>
    );
  }

  if (phase === 'empty') {
    return (
      <View style={styles.container}>
        {renderCenter(
          <Text style={styles.centerText}>지금은 추천할 상품이 없어요.</Text>,
        )}
      </View>
    );
  }

  // phase === 'ready'
  const selectedCount = selected.size;
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>맞춤 구강관리 상품</Text>
        <Text style={styles.subtitle}>
          필요한 상품을 선택해 주세요. 가격은 장바구니를 만든 뒤 확인할 수 있어요.
        </Text>

        {items.map((item) => {
          const isSel = selected.has(item.product_key);
          const label = getReasonLabel(item.reason_code); // null이면 배지 미표시
          return (
            <TouchableOpacity
              key={item.product_key}
              style={[styles.card, isSel && styles.cardSelected]}
              onPress={() => toggle(item.product_key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSel }}
            >
              <Icon
                name={isSel ? 'check-box' : 'check-box-outline-blank'}
                size={24}
                color={isSel ? '#2563eb' : '#9ca3af'}
                style={styles.checkIcon}
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.display_name}</Text>
                <Text style={styles.cardQty}>수량 {item.quantity}</Text>
                {!!item.rationale && <Text style={styles.cardRationale}>{item.rationale}</Text>}
                {!!label && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{label}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, selectedCount === 0 && styles.buttonDisabled]}
          onPress={goReview}
          disabled={selectedCount === 0}
        >
          <Text style={styles.primaryButtonText}>
            장바구니 검토{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  centerText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  cardSelected: { borderColor: '#2563eb' },
  checkIcon: { marginRight: 12, marginTop: 2 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardQty: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cardRationale: { fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 19 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
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
    marginTop: 12,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { backgroundColor: '#9ca3af' },
});
