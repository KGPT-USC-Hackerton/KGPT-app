// components/OralCareRecordComponent.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  Linking,
} from 'react-native';

// 안드로이드에서 LayoutAnimation 활성화
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * props
 * - records: [{ id, date, score, survey_session_id }, ...]
 * - backendBaseUrl: 'http://210.119.33.3:3000' 같은 서버 주소
 */
export default function OralCareRecordComponent({
  records = [],
  backendBaseUrl,
}) {
  // 어떤 카드가 펼쳐져 있는지 (id 한 개)
  const [expandedId, setExpandedId] = useState(null);

  // 세션별 상세 데이터 캐시
  // detailsMap[sessionId] = { analysis, recommendations, ... }
  const [detailsMap, setDetailsMap] = useState({});
  const [loadingId, setLoadingId] = useState(null); // 상세 로딩 중인 sessionId
  const [errorMap, setErrorMap] = useState({}); // 상세 로딩 에러 메시지

  const handlePress = async (cardId, sessionId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpandedId(prev => (prev === cardId ? null : cardId));

    // 접으면서는 굳이 다시 로딩할 필요 없음
    if (!sessionId) return;

    // 이미 받아온 상세가 있으면 또 호출하지 않음
    if (detailsMap[sessionId]) {
      console.log('✅ 상세 캐시 사용:', sessionId);
      return;
    }

    if (!backendBaseUrl) {
      console.warn('backendBaseUrl 이 설정되어 있지 않습니다.');
      return;
    }

    try {
      console.log('🔍 상세 조회 시작:', sessionId);
      setLoadingId(sessionId);
      setErrorMap(prev => ({ ...prev, [sessionId]: null }));

      const res = await fetch(
        `${backendBaseUrl}/api/survey-detail/detail/${sessionId}`,
      );
      const json = await res.json();

      console.log('🔍 상세 조회 응답:', json);

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || `Failed to load details (status ${res.status})`,
        );
      }

      setDetailsMap(prev => ({
        ...prev,
        [sessionId]: json.data,
      }));
    } catch (err) {
      console.log('detail fetch error:', err);
      setErrorMap(prev => ({
        ...prev,
        [sessionId]: err.message || 'An error occurred while loading details.',
      }));
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusColor = score => {
    if (score >= 80) return '#22c55e'; // 초록
    if (score >= 50) return '#f97316'; // 주황
    return '#ef4444'; // 빨강
  };

  const getStatusText = score => {
    if (score >= 85) return 'Overall, your oral health is in great shape.';
    if (score >= 70)
      return 'Some attention needed. Try improving your care habits a little.';
    return 'Warning sign. We recommend visiting a dental clinic for a professional checkup.';
  };

  const openProductLink = async link => {
    if (!link) return;
    try {
      const supported = await Linking.canOpenURL(link);
      if (supported) {
        await Linking.openURL(link);
      } else {
        console.warn('링크를 열 수 없습니다:', link);
      }
    } catch (e) {
      console.warn('링크 열기 실패:', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Recent oral care history</Text>

      {records.map(item => {
        // sessionId는 detail_survey 조회에 사용
        const sessionId = item.survey_session_id ?? item.session_id ?? null;
        // 카드의 고유 id
        const cardId = item.id ?? sessionId ?? item.date;

        const isExpanded = expandedId === cardId;
        const statusColor = getStatusColor(item.score);
        const statusText = item.note ?? getStatusText(item.score);

        // 상세 데이터 / 로딩 / 에러
        const detail = sessionId ? detailsMap[sessionId] : null;
        const isDetailLoading = sessionId && loadingId === sessionId;
        const detailError = sessionId ? errorMap[sessionId] : null;

        const analysis = detail?.analysis;
        const recommendations = detail?.recommendations || [];

        return (
          <TouchableOpacity
            key={cardId}
            activeOpacity={0.85}
            style={styles.card}
            onPress={() => handlePress(cardId, sessionId)}
          >
            {/* 상단 요약 영역 */}
            <View style={styles.row}>
              <View style={styles.left}>
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                <View>
                  <Text style={styles.date}>{item.date}</Text>
                  {!isExpanded && (
                    <Text style={styles.brief} numberOfLines={1}>
                      {statusText}
                    </Text>
                  )}
                </View>
              </View>

              <View style={[styles.badge, { backgroundColor: statusColor }]}>
                <Text style={styles.badgeText}>
                  Score: {Math.round(item.score)}
                </Text>
              </View>
            </View>

            {/* 눌렀을 때 펼쳐지는 영역 */}
            {isExpanded && (
              <View style={styles.expandedArea}>
                {/* 기본 상태 문장 */}
                <Text style={styles.expandedText}>{statusText}</Text>

                {/* 상세 로딩 상태 */}
                {isDetailLoading && (
                  <View style={styles.detailLoadingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.detailLoadingText}>
                      Loading AI analysis...
                    </Text>
                  </View>
                )}

                {/* 상세 에러 */}
                {!isDetailLoading && detailError && (
                  <Text style={styles.detailErrorText}>{detailError}</Text>
                )}

                {/* 상세 AI 분석 내용 */}
                {!isDetailLoading && !detailError && detail && (
                  <View style={styles.detailBlock}>
                    {/* 요약 */}
                    {analysis?.summary && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailTitle}>AI analysis summary</Text>
                        <Text style={styles.detailBody}>
                          {analysis.summary}
                        </Text>
                      </View>
                    )}

                    {/* 세부 설명 */}
                    {analysis?.details && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailTitle}>Details</Text>
                        <Text style={styles.detailBody}>
                          {analysis.details}
                        </Text>
                      </View>
                    )}

                    {/* 위험 요인 리스트 */}
                    {Array.isArray(analysis?.risk_factors) &&
                      analysis.risk_factors.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailTitle}>Risk factors</Text>
                          {analysis.risk_factors.map((rf, idx) => (
                            <Text key={idx} style={styles.bulletText}>
                              • {rf}
                            </Text>
                          ))}
                        </View>
                      )}

                    {/* 개선 행동 리스트 */}
                    {Array.isArray(analysis?.improvements) &&
                      analysis.improvements.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailTitle}>Suggested improvements</Text>
                          {analysis.improvements.map((imp, idx) => (
                            <Text key={idx} style={styles.bulletText}>
                              • {imp}
                            </Text>
                          ))}
                        </View>
                      )}

                    {/* 추천 용품 리스트 */}
                    {Array.isArray(recommendations) &&
                      recommendations.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailTitle}>Recommended oral care products</Text>
                          {recommendations.map((rec, idx) => (
                            <View key={idx} style={styles.productRow}>
                              <TouchableOpacity
                                onPress={() => openProductLink(rec.link)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.productName}>
                                  {rec.name || 'Product'}
                                </Text>
                              </TouchableOpacity>
                              {rec.reason && (
                                <Text style={styles.productReason}>
                                  {rec.reason}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                  </View>
                )}

                {/* (선택) 기존 카테고리별 점수 사용 */}
                {item.details && Array.isArray(item.details) && (
                  <View style={styles.detailList}>
                    {item.details.map(d => (
                      <View key={d.label} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{d.label}</Text>
                        <Text style={styles.detailValue}>{d.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  brief: {
    fontSize: 13,
    color: '#6b7280',
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedArea: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  expandedText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },

  // 상세 로딩 / 에러
  detailLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  detailLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  detailErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc2626',
  },

  // AI 상세 블럭
  detailBlock: {
    marginTop: 10,
  },
  detailSection: {
    marginTop: 8,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  detailBody: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },

  // 기존 카테고리별 점수 영역 (선택)
  detailList: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },

  // 추천 제품 영역
  productRow: {
    marginTop: 6,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  productReason: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
});
