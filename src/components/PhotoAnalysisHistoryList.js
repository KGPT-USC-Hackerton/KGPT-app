// src/components/PhotoAnalysisHistoryList.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

import { getUser } from '../utils/storage';
import { getUserHistories } from '../services/imageService';
import { get } from '../services/api'; // /api/ai/image-analysis/history/:historyId

const POSITION_LABELS = {
  upper: 'Upper teeth',
  lower: 'Lower teeth',
  front: 'Front teeth',
};

export default function PhotoAnalysisHistoryList({ visible = true }) {
  const [loading, setLoading] = useState(true);
  const [histories, setHistories] = useState([]);
  const [error, setError] = useState(null);

  // 카드 펼침 상태
  const [expandedId, setExpandedId] = useState(null);

  // 각 historyId별 상세 데이터 / 요약
  // { [historyId]: { loading, error, positions, raw } }
  const [details, setDetails] = useState({});

  const loadHistories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getUser();
      if (!user?.id) {
        throw new Error('No login information found.');
      }

      const res = await getUserHistories(user.id);
      if (!res.success) {
        throw new Error(res.message || 'Failed to load the history list.');
      }

      setHistories(res.data || []);
    } catch (e) {
      console.error('사진 히스토리 목록 로딩 오류:', e);
      setError(e.message || 'An error occurred while loading the history list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistories();
  }, [loadHistories]);

  /**
   * 특정 historyId의 상세 분석 (이미지 + llm_summary 등) 불러오기
   * Node 백엔드: GET /api/ai/image-analysis/history/:historyId?user_id=...
   */
  const loadHistoryDetail = useCallback(async historyId => {
    setDetails(prev => ({
      ...prev,
      [historyId]: { ...(prev[historyId] || {}), loading: true, error: null },
    }));

    try {
      const user = await getUser();
      if (!user?.id) {
        throw new Error('No login information found.');
      }

      // 쿼리스트링으로 user_id 같이 전송
      const res = await get(
        `/ai/image-analysis/history/${historyId}?user_id=${user.id}`,
      );

      if (!res.success || !res.data) {
        throw new Error(
          res.message || 'Failed to load the image analysis results.',
        );
      }

      const records = res.data.records || [];

      // upper / lower / front 별로 화면에서 쓰기 좋은 구조로 변환
      const positions = {};

      records.forEach(rec => {
        const pos = rec.image_type; // 'upper' | 'lower' | 'front'
        if (!POSITION_LABELS[pos]) return;

        // llm_summary 가 문자열일 수도, 객체일 수도 있으니 둘 다 처리
        let llmSummaryText = '';
        const llmRaw = rec.llm_summary;

        if (typeof llmRaw === 'string') {
          llmSummaryText = llmRaw;
        } else if (llmRaw && typeof llmRaw === 'object') {
          llmSummaryText =
            llmRaw.summary ||
            llmRaw.upper_summary ||
            llmRaw.lower_summary ||
            llmRaw.front_summary ||
            llmRaw.overall_summary ||
            '';
        }

        positions[pos] = {
          label: POSITION_LABELS[pos],
          analyzedImageUrl:
            rec.analyzed_image_url || rec.cloudinary_url || null,
          occlusionStatus: rec.occlusion_status,
          occlusionComment: rec.occlusion_comment,
          cavityDetected: rec.cavity_detected,
          cavityCount: Array.isArray(rec.cavity_locations)
            ? rec.cavity_locations.length
            : null,
          cavityComment: rec.cavity_comment,
          recommendations: llmSummaryText,
          llmSummary: llmSummaryText,
        };
      });

      setDetails(prev => ({
        ...prev,
        [historyId]: {
          loading: false,
          error: null,
          positions,
          raw: res.data,
        },
      }));
    } catch (e) {
      console.error('사진 히스토리 상세 로딩 오류:', e);
      setDetails(prev => ({
        ...prev,
        [historyId]: {
          ...(prev[historyId] || {}),
          loading: false,
          error: e.message || 'An error occurred while loading the detailed analysis results.',
        },
      }));
    }
  }, []);

  /**
   * 카드 클릭 시: 펼치기 / 접기 + 상세 로딩
   */
  const handlePressHistory = useCallback(
    history => {
      const id = history.history_id;

      if (expandedId === id) {
        // 이미 펼쳐져 있으면 접기
        setExpandedId(null);
        return;
      }

      setExpandedId(id);

      // 아직 상세를 한 번도 안 불렀으면 로딩
      if (!details[id]) {
        loadHistoryDetail(id);
      }
    },
    [expandedId, details, loadHistoryDetail],
  );

  /**
   * 개별 카드 렌더링
   */
  const renderHistoryItem = history => {
    const id = history.history_id;
    const isExpanded = expandedId === id;
    const detail = details[id];

    const firstDate = history.first_uploaded_at
      ? history.first_uploaded_at.slice(0, 10)
      : '-';

    const statusText =
      history.completed_count >= 3
        ? 'View analysis results'
        : 'Analysis is still in progress.';

    return (
      <TouchableOpacity
        key={id}
        onPress={() => handlePressHistory(history)}
        activeOpacity={0.9}
        style={styles.cardContainer}
      >
        {/* 상단 한 줄 요약 영역 */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={styles.statusDot} />
            <Text style={styles.dateText}>{firstDate}</Text>
          </View>
          <Text style={styles.statusBadge}>
            {history.completed_count >= 3 ? 'Complete' : 'In progress'}
          </Text>
        </View>

        <Text style={styles.statusText} numberOfLines={1}>
          {statusText}
        </Text>

        {/* 펼쳐졌을 때 상세 내용 */}
        {isExpanded && (
          <View style={styles.detailSection}>
            {detail?.loading && (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.detailLoadingText}>
                  Loading detailed analysis...
                </Text>
              </View>
            )}

            {detail?.error && (
              <Text style={styles.detailErrorText}>{detail.error}</Text>
            )}

            {!detail?.loading && !detail?.error && detail?.positions && (
              <View style={styles.positionsBlock}>
                {['upper', 'front', 'lower'].map(pos => {
                  const p = detail.positions[pos];
                  if (!p) return null;

                  return (
                    <View key={pos} style={styles.positionResultCard}>
                      <Text style={styles.positionResultTitle}>
                        {p.label} analysis result
                      </Text>

                      {p.analyzedImageUrl && (
                        <Image
                          source={{ uri: p.analyzedImageUrl }}
                          style={styles.positionResultImage}
                        />
                      )}

                      {p.llmSummary ? (
                        <Text style={styles.positionResultSummary}>
                          {p.llmSummary}
                        </Text>
                      ) : null}

                      <View style={styles.positionResultMeta}>
                        {p.occlusionStatus && (
                          <Text style={styles.positionResultMetaText}>
                            Occlusion: {p.occlusionStatus}
                            {p.occlusionComment
                              ? ` - ${p.occlusionComment}`
                              : ''}
                          </Text>
                        )}

                        {p.cavityDetected !== undefined &&
                          p.cavityDetected !== null && (
                            <Text style={styles.positionResultMetaText}>
                              {p.cavityDetected
                                ? p.cavityComment ||
                                  `Found ${
                                    p.cavityCount != null ? p.cavityCount : ''
                                  } cavity(ies).`
                                : p.cavityComment ||
                                  'No cavities were found.'}
                            </Text>
                          )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  // ---------------- 상태별 분기 ----------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.loadingText}>
          Loading oral photo analysis history...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>
          Failed to load oral photo analysis history.
        </Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadHistories} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!histories || histories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          No oral photo analysis history yet.
        </Text>
        <Text style={styles.emptyText}>
          Take photos of your upper, lower, and front teeth and get an AI analysis,{'\n'}
          and your records will appear here.
        </Text>
      </View>
    );
  }

  // 최신 기록이 위로 오게 정렬
  const sortedHistories = [...histories].sort((a, b) => {
    const dateA = new Date(a.last_uploaded_at || a.first_uploaded_at);
    const dateB = new Date(b.last_uploaded_at || b.first_uploaded_at);
    return dateB - dateA; // 최신 > 오래된
  });

  return (
    <ScrollView
      style={{ marginTop: 16 }}
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      {sortedHistories.map(history => (
        <View key={history.history_id} style={{ marginBottom: 12 }}>
          {renderHistoryItem(history)}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    marginTop: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
    marginRight: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    backgroundColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  detailSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  detailLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  detailErrorText: {
    fontSize: 13,
    color: '#ef4444',
  },

  // 부위별 결과 카드
  positionsBlock: {
    marginTop: 8,
    gap: 12,
  },
  positionResultCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  positionResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  positionResultImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  positionResultSummary: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 6,
  },
  positionResultMeta: {
    marginTop: 4,
  },
  positionResultMetaText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginTop: 2,
  },

  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  errorContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#b91c1c',
  },
  retryButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  emptyContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});
