// screens/CareScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

import SurveyComponent from '../components/SurveyComponent';
import PhotoAnalysisComponent from '../components/PhotoAnalysisComponent';
import OralCareRecordComponent from '../components/OralCareRecordComponent';
import PhotoAnalysisHistoryList from '../components/PhotoAnalysisHistoryList';

const tabs = [
  { id: 'survey', label: '설문조사' },
  { id: 'photo', label: '구강 사진 분석' },
];

// 앱 나머지와 동일하게 Config(.env)의 API_BASE_URL 기준으로 백엔드 origin 도출.
// SurveyComponent 등은 `${BACKEND_BASE_URL}/api/...` 형태로 쓰므로 끝의 '/api'는 제거한다.
const FALLBACK_BACKEND_BASE_URL = (Config.API_BASE_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

export default function CareScreen({ route, navigation }) {
  // 통합 위저드 단계: intro → survey → photo → result
  const [step, setStep] = useState('intro');
  const [userId, setUserId] = useState(null);
  const [isPhotoSession, setIsPhotoSession] = useState(false);

  // 통합 분석용 세션/결과 상태
  const [surveySessionId, setSurveySessionId] = useState(null);
  const [photoHistoryId, setPhotoHistoryId] = useState(null);
  const [combinedResult, setCombinedResult] = useState(null);
  const [combinedImages, setCombinedImages] = useState([]); // 분석 사진 URL 목록
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedError, setCombinedError] = useState(null);

  // score_history 기반 기록
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState(null);

  // 설문 완료 후 AI 분석/추천 진행 상태
  const [isProcessingSurvey, setIsProcessingSurvey] = useState(false);

  // 설문 완료 후 기록 다시 불러오도록 트리거
  const [reloadKey, setReloadKey] = useState(0);

  const BACKEND_BASE_URL =
    route?.params?.BACKEND_BASE_URL || FALLBACK_BACKEND_BASE_URL;

  // user_id 로드
  useEffect(() => {
    (async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('user_id');
        console.log('📌 CareScreen user_id =', storedUserId);

        if (storedUserId) {
          setUserId(Number(storedUserId));
        }
      } catch (e) {
        console.log('Failed to load user_id:', e);
      }
    })();
  }, []);

  // 사진 단계를 벗어나면 촬영 세션 종료 상태로
  useEffect(() => {
    if (step !== 'photo') {
      setIsPhotoSession(false);
    }
  }, [step]);

  // ✅ score_history 불러오기 (userId, reloadKey가 바뀔 때마다)
  useEffect(() => {
    if (!userId) return;

    const fetchRecords = async () => {
      try {
        setRecordsLoading(true);
        setRecordsError(null);

        const res = await fetch(
          `${BACKEND_BASE_URL}/api/survey-detail/history/${userId}`,
        );
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.message || 'score_history 조회 실패');
        }

        // 1️⃣ 원본 리스트
        const list = json.data || [];

        // 2️⃣ created_at / createdAt 기준으로 "가장 최근"이 위로 오게 정렬
        const sorted = [...list].sort((a, b) => {
          const aDate = new Date(a.created_at || a.createdAt || 0);
          const bDate = new Date(b.created_at || b.createdAt || 0);
          return bDate - aDate; // b가 더 최신이면 앞으로
        });

        // 3️⃣ 화면에서 쓸 형태로 매핑
        const mapped = sorted.map(item => {
          const rawDate = item.created_at || item.createdAt;

          let dateStr = '';
          if (rawDate) {
            const d = new Date(rawDate); // 기기 시간대 기준
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`; // 2025-11-30
          }

          return {
            id: item.id,
            date: dateStr,
            score: item.total_score,
            survey_session_id:
              item.survey_session_id || item.session_id || null,
            note: item.analysis_summary || item.note || null,
          };
        });

        setRecords(mapped);
      } catch (err) {
        console.log('score_history fetch error:', err);
        setRecordsError(err.message);
      } finally {
        setRecordsLoading(false);
      }
    };

    fetchRecords();
  }, [userId, BACKEND_BASE_URL, reloadKey]);

  /**
   * 설문 완료 시 호출되는 콜백
   * - result 안에는 설문 점수 + 세션 ID 가 들어있다고 가정
   *   (SurveyComponent 쪽에서 session_id 또는 sessionId를 넘겨줘야 함)
   * - 1) 기본 점수 Alert
   * - 2) 백엔드에 분석/추천 요청 (Gemini)
   */
  // [1단계] 설문 완료 → session_id 확보 후 [2단계] 촬영으로 진행
  //   (개별 설문분석/추천 호출은 제거. 촬영까지 끝난 뒤 통합 분석 1회 수행)
  const handleSurveySubmit = result => {
    if (!result) return;

    const sessionId =
      result?.session_id ||
      result?.sessionId ||
      result?.scores?.survey_session_id ||
      result?.scores?.session_id ||
      null;

    console.log('🔍 설문 완료, session_id =', sessionId);
    setSurveySessionId(sessionId);
    setStep('photo');
  };

  // [2단계] 사진 3장 분석 완료 → history_id 확보 후 [3단계] 통합 분석으로 진행
  const handlePhotoComplete = historyId => {
    console.log('🔍 사진 분석 완료, history_id =', historyId);
    setPhotoHistoryId(historyId);
    setStep('result');
  };

  // [3단계] 설문 + 사진을 합쳐 통합 분석 1회 호출
  const runCombinedAnalysis = async () => {
    if (!userId || !surveySessionId || !photoHistoryId) {
      setCombinedError('설문 또는 사진 정보가 부족합니다.');
      return;
    }
    setCombinedLoading(true);
    setCombinedError(null);
    setCombinedResult(null);
    setCombinedImages([]);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/ai/combined-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          survey_session_id: surveySessionId,
          history_id: photoHistoryId,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || `통합 분석 API 에러 (status ${res.status})`,
        );
      }

      setCombinedResult(json.analysis);
      setCombinedImages(Array.isArray(json.images) ? json.images : []);
      setReloadKey(prev => prev + 1); // 기록 갱신
    } catch (error) {
      console.error('통합 분석 오류:', error);
      setCombinedError(
        error.message || '통합 분석 중 문제가 발생했습니다.',
      );
    } finally {
      setCombinedLoading(false);
    }
  };

  // result 단계 진입 시 자동으로 통합 분석 실행
  useEffect(() => {
    if (step === 'result' && surveySessionId && photoHistoryId) {
      runCombinedAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, surveySessionId, photoHistoryId]);

  // 처음부터 다시 시작
  const restartFlow = () => {
    setSurveySessionId(null);
    setPhotoHistoryId(null);
    setCombinedResult(null);
    setCombinedError(null);
    setCombinedLoading(false);
    setStep('intro');
  };

  // 6B: 맞춤 상품 추천 화면으로 이동.
  // photoHistoryId(=history_id)가 유효한 비어 있지 않은 문자열일 때만 이동한다.
  // survey_session_id는 optional. user_id / 의료정보는 전달하지 않는다.
  const canOpenRecommendations =
    typeof photoHistoryId === 'string' && photoHistoryId.trim() !== '';

  const handleOpenRecommendations = () => {
    if (!canOpenRecommendations || !navigation) {
      return;
    }
    navigation.navigate('ProductRecommendation', {
      history_id: photoHistoryId,
      survey_session_id: surveySessionId || undefined,
    });
  };

  const stepIndex = { intro: 0, survey: 0, photo: 1, result: 2 }[step] ?? 0;

  return (
    <View style={styles.container}>
      {/* 진행 단계 표시 */}
      <View style={styles.stepper}>
        {WIZARD_STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <View style={styles.stepItem}>
              <View
                style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    i <= stepIndex && styles.stepDotTextActive,
                  ]}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  i === stepIndex && styles.stepLabelActive,
                ]}
              >
                {s.label}
              </Text>
            </View>
            {i < WIZARD_STEPS.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  i < stepIndex && styles.stepLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* intro: 시작 안내 + 이전 기록 */}
        {step === 'intro' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.cardIconCircle}>
                <Text style={styles.cardIconText}>🦷</Text>
              </View>
              <Text style={styles.cardTitle}>
                구강 건강 통합 분석을 시작해보세요
              </Text>
              <Text style={styles.cardSubtitle}>
                ① 설문조사와 ② 구강 사진 촬영을 마치면, 두 결과를 종합한 맞춤형
                분석과 관리 추천을 한 번에 받아볼 수 있어요.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep('survey')}
              >
                <Text style={styles.primaryButtonText}>시작하기</Text>
              </TouchableOpacity>
            </View>

            {/* 이전 기록 */}
            <View style={styles.historySection}>
              {recordsLoading && (
                <View style={styles.historyLoading}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.historyLoadingText}>불러오는 중...</Text>
                </View>
              )}
              {!recordsLoading && recordsError && (
                <Text style={styles.historyErrorText}>
                  기록을 불러오는 중 오류가 발생했습니다.
                </Text>
              )}
              {!recordsLoading && !recordsError && records.length === 0 && (
                <Text style={styles.historyEmptyText}>
                  아직 기록이 없어요. 설문과 촬영을 완료하면 이곳에 기록이 쌓여요.
                </Text>
              )}
              {!recordsLoading && !recordsError && records.length > 0 && (
                <OralCareRecordComponent
                  records={records}
                  backendBaseUrl={BACKEND_BASE_URL}
                />
              )}
            </View>
          </View>
        )}

        {/* 1단계: 설문 */}
        {step === 'survey' && (
          <View style={styles.section}>
            <SurveyComponent
              backendBaseUrl={BACKEND_BASE_URL}
              userId={userId}
              onSubmit={handleSurveySubmit}
              isProcessing={false}
            />
          </View>
        )}

        {/* 2단계: 구강 촬영 */}
        {step === 'photo' && (
          <View style={styles.section}>
            <View style={styles.stepHintBox}>
              <Text style={styles.stepHintText}>
                설문이 완료되었어요. 이제 윗니·아랫니·앞니 3장을 촬영해 주세요.
              </Text>
            </View>
            <PhotoAnalysisComponent
              backendBaseUrl={BACKEND_BASE_URL}
              onSessionStateChange={setIsPhotoSession}
              onAnalysisComplete={handlePhotoComplete}
            />
          </View>
        )}

        {/* 3단계: 통합 분석 결과 */}
        {step === 'result' && (
          <View style={styles.section}>
            {combinedLoading && (
              <View style={styles.card}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.processingText}>
                  설문과 사진을 종합 분석 중입니다...
                </Text>
              </View>
            )}

            {!combinedLoading && combinedError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>분석에 실패했어요</Text>
                <Text style={styles.cardSubtitle}>{combinedError}</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={runCombinedAnalysis}
                >
                  <Text style={styles.primaryButtonText}>다시 시도</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={restartFlow}
                >
                  <Text style={styles.secondaryButtonText}>처음부터 다시</Text>
                </TouchableOpacity>
              </View>
            )}

            {!combinedLoading && !combinedError && combinedResult && (
              <CombinedResultView
                result={combinedResult}
                images={combinedImages}
                onRestart={restartFlow}
                onOpenRecommendations={handleOpenRecommendations}
                canOpenRecommendations={canOpenRecommendations}
              />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// 상단 진행 단계 정의
const WIZARD_STEPS = [
  { key: 'survey', label: '설문' },
  { key: 'photo', label: '구강 촬영' },
  { key: 'result', label: '통합 분석' },
];

// 통합 분석 결과 렌더링
function CombinedResultView({
  result,
  onRestart,
  onOpenRecommendations,
  canOpenRecommendations,
}) {
function CombinedResultView({ result, images = [], onRestart }) {
  const {
    summary = '',
    details = '',
    risk_factors = [],
    improvements = [],
    recommendations = [],
    photo = {},
  } = result || {};

  const Section = ({ title, children }) => (
    <View style={styles.resultCard}>
      <Text style={styles.resultCardTitle}>{title}</Text>
      {children}
    </View>
  );

  const BulletList = ({ items }) =>
    (items || []).length === 0 ? (
      <Text style={styles.resultText}>해당 사항 없음</Text>
    ) : (
      items.map((it, idx) => (
        <View key={idx} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))
    );

  const photoParts = [
    ['윗니', photo.upper],
    ['아랫니', photo.lower],
    ['앞니', photo.front],
  ].filter(([, v]) => v);

  // 분석 결과 사진(충치 표시가 렌더링된 이미지). 없으면 원본으로 대체한다.
  const POSITION_LABELS = { upper: '윗니', lower: '아랫니', front: '앞니' };
  const photoCards = (images || [])
    .map(img => ({
      key: img.image_type,
      label: POSITION_LABELS[img.image_type] || img.image_type,
      url: img.analyzed_image_url || img.original_image_url,
      isAnalyzed: !!img.analyzed_image_url,
    }))
    .filter(c => !!c.url);

  return (
    <View>
      <View style={styles.resultHeader}>
        <Text style={styles.resultHeaderIcon}>🩺</Text>
        <Text style={styles.resultHeaderTitle}>통합 분석 결과</Text>
      </View>

      {!!summary && (
        <Section title="종합 총평">
          <Text style={styles.resultText}>{summary}</Text>
        </Section>
      )}

      {!!details && (
        <Section title="세부 분석">
          <Text style={styles.resultText}>{details}</Text>
        </Section>
      )}

      <Section title="⚠️ 위험 요인">
        <BulletList items={risk_factors} />
      </Section>

      <Section title="✅ 개선하면 좋은 습관">
        <BulletList items={improvements} />
      </Section>

      <Section title="🪥 맞춤 추천">
        <BulletList items={recommendations} />
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { marginTop: 12, opacity: canOpenRecommendations ? 1 : 0.5 },
          ]}
          onPress={onOpenRecommendations}
          disabled={!canOpenRecommendations}
        >
          <Text style={styles.primaryButtonText}>맞춤 구강관리 상품 보기</Text>
        </TouchableOpacity>
      </Section>

      {photoCards.length > 0 && (
        <Section title="🦷 치아 분석 사진">
          <Text style={styles.photoHint}>
            AI가 분석한 부위가 표시된 사진입니다.
          </Text>
          {photoCards.map(card => (
            <View key={card.key} style={styles.photoItem}>
              <Text style={styles.resultSubLabel}>
                {card.label}
                {!card.isAnalyzed && ' (원본)'}
              </Text>
              <Image
                source={{ uri: card.url }}
                style={styles.analyzedImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </Section>
      )}

      {(photoParts.length > 0 || photo.overall) && (
        <Section title="📷 사진 분석 요약">
          {photoParts.map(([label, text]) => (
            <View key={label} style={{ marginBottom: 8 }}>
              <Text style={styles.resultSubLabel}>{label}</Text>
              <Text style={styles.resultText}>{text}</Text>
            </View>
          ))}
          {!!photo.overall && (
            <Text style={[styles.resultText, { marginTop: 4 }]}>
              {photo.overall}
            </Text>
          )}
        </Section>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onRestart}>
        <Text style={styles.primaryButtonText}>처음부터 다시 하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  // 스텝퍼
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepItem: {
    alignItems: 'center',
    width: 72,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#2563eb',
  },
  stepDotText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 13,
  },
  stepDotTextActive: {
    color: 'white',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stepLabelActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  stepLine: {
    height: 2,
    width: 24,
    backgroundColor: '#e5e7eb',
    marginBottom: 18,
  },
  stepLineActive: {
    backgroundColor: '#2563eb',
  },
  stepHintBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  stepHintText: {
    color: '#1d4ed8',
    fontSize: 13,
  },
  // 보조 버튼
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  // 통합 결과
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultHeaderIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  resultHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  resultCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  resultSubLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 2,
  },
  // 치아 분석 사진
  photoHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  photoItem: {
    marginBottom: 14,
  },
  analyzedImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    marginTop: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    color: '#2563eb',
    marginRight: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabItem: {
    flex: 1,
  },
  tabButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingTop: 20,
  },

  // 설문 시작 카드
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cardIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0ecff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardIconText: {
    fontSize: 36,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // 설문 기록 섹션
  historySection: {
    marginTop: 28,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  historyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  historyLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  historyErrorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#dc2626',
  },
  historyEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
  },

  processingBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  processingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },

  // 📷 구강 사진 분석 기록 섹션 여백
  photoHistorySection: {
    marginTop: 28,
  },
});
