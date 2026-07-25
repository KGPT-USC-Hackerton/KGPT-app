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
import FollowupQuestionsComponent from '../components/FollowupQuestionsComponent';

const tabs = [
  { id: 'survey', label: 'Survey' },
  { id: 'photo', label: 'Oral photo analysis' },
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
  const [combinedScores, setCombinedScores] = useState(null); // 총점/카테고리 점수
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedError, setCombinedError] = useState(null);

  // AI 사전 문진(추가 질문) 답변 [{ question, answer }]
  const [followupAnswers, setFollowupAnswers] = useState([]);

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
          throw new Error(json.message || 'Failed to load score history');
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

  // [2단계] 사진 3장 분석 완료 → history_id 확보 후 [3단계] AI 추가 문진으로 진행
  const handlePhotoComplete = historyId => {
    console.log('🔍 사진 분석 완료, history_id =', historyId);
    setPhotoHistoryId(historyId);
    setStep('followup');
  };

  // [3단계] AI 추가 문진 완료/건너뛰기 → 답변을 담아 [4단계] 통합 분석으로 진행
  const handleFollowupComplete = collectedAnswers => {
    setFollowupAnswers(Array.isArray(collectedAnswers) ? collectedAnswers : []);
    setStep('result');
  };
  const handleFollowupSkip = () => {
    setFollowupAnswers([]);
    setStep('result');
  };

  // [3단계] 설문 + 사진을 합쳐 통합 분석 1회 호출
  const runCombinedAnalysis = async () => {
    if (!userId || !surveySessionId || !photoHistoryId) {
      setCombinedError('Survey or photo information is missing.');
      return;
    }
    setCombinedLoading(true);
    setCombinedError(null);
    setCombinedResult(null);
    setCombinedImages([]);
    setCombinedScores(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/ai/combined-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          survey_session_id: surveySessionId,
          history_id: photoHistoryId,
          followup_answers: followupAnswers,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || `Combined analysis API error (status ${res.status})`,
        );
      }

      setCombinedResult(json.analysis);
      setCombinedImages(Array.isArray(json.images) ? json.images : []);
      setCombinedScores(json.scores || null);
      setReloadKey(prev => prev + 1); // 기록 갱신
    } catch (error) {
      console.error('통합 분석 오류:', error);
      setCombinedError(
        error.message || 'A problem occurred during the combined analysis.',
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
    setCombinedScores(null);
    setFollowupAnswers([]);
    setStep('intro');
  };

  const stepIndex =
    { intro: 0, survey: 0, photo: 1, followup: 2, result: 3 }[step] ?? 0;

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
                Start your combined oral health analysis
              </Text>
              <Text style={styles.cardSubtitle}>
                Once you complete ① the survey and ② the oral photos, you'll get
                a personalized analysis and care recommendations based on both
                results, all at once.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep('survey')}
              >
                <Text style={styles.primaryButtonText}>Get started</Text>
              </TouchableOpacity>
            </View>

            {/* 이전 기록 */}
            <View style={styles.historySection}>
              {recordsLoading && (
                <View style={styles.historyLoading}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.historyLoadingText}>Loading...</Text>
                </View>
              )}
              {!recordsLoading && recordsError && (
                <Text style={styles.historyErrorText}>
                  An error occurred while loading your records.
                </Text>
              )}
              {!recordsLoading && !recordsError && records.length === 0 && (
                <Text style={styles.historyEmptyText}>
                  No records yet. Once you complete a survey and photos, your records will appear here.
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
                The survey is complete. Now take 3 photos: upper teeth, lower teeth, and front teeth.
              </Text>
            </View>
            <PhotoAnalysisComponent
              backendBaseUrl={BACKEND_BASE_URL}
              onSessionStateChange={setIsPhotoSession}
              onAnalysisComplete={handlePhotoComplete}
            />
          </View>
        )}

        {/* 3단계: AI 추가 문진 */}
        {step === 'followup' && (
          <View style={styles.section}>
            <FollowupQuestionsComponent
              backendBaseUrl={BACKEND_BASE_URL}
              userId={userId}
              surveySessionId={surveySessionId}
              historyId={photoHistoryId}
              onComplete={handleFollowupComplete}
              onSkip={handleFollowupSkip}
            />
          </View>
        )}

        {/* 4단계: 통합 분석 결과 */}
        {step === 'result' && (
          <View style={styles.section}>
            {combinedLoading && (
              <View style={styles.card}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.processingText}>
                  Analyzing your survey and photos together...
                </Text>
              </View>
            )}

            {!combinedLoading && combinedError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Analysis failed</Text>
                <Text style={styles.cardSubtitle}>{combinedError}</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={runCombinedAnalysis}
                >
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={restartFlow}
                >
                  <Text style={styles.secondaryButtonText}>Start over</Text>
                </TouchableOpacity>
              </View>
            )}

            {!combinedLoading && !combinedError && combinedResult && (
              <CombinedResultView
                result={combinedResult}
                images={combinedImages}
                scores={combinedScores}
                onRestart={restartFlow}
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
  { key: 'survey', label: 'Survey' },
  { key: 'photo', label: 'Oral photos' },
  { key: 'followup', label: 'Questions' },
  { key: 'result', label: 'Analysis' },
];

// 점수 → 등급/색상
function gradeFor(s) {
  if (s >= 80) return { label: 'Good', color: '#16a34a', bg: '#dcfce7' };
  if (s >= 60) return { label: 'Fair', color: '#f59e0b', bg: '#fef3c7' };
  return { label: 'Needs care', color: '#dc2626', bg: '#fee2e2' };
}

const CATEGORY_DEFS = [
  ['oral_care_score', 'Oral care'],
  ['cavity_dryness_score', 'Cavity & dryness'],
  ['smoking_drinking_score', 'Smoking & drinking'],
  ['cariogenic_food_score', 'Cariogenic food'],
  ['sensitivity_fluoride_score', 'Sensitivity & fluoride'],
  ['oral_habits_score', 'Oral habits'],
];

// 위험/개선/추천을 색상 카드로 렌더 (빈 그룹은 숨김)
function FindingGroup({ icon, title, items, color, bg }) {
  if (!items || items.length === 0) return null;
  // 화면 간결화를 위해 최대 3개만 노출.
  const shown = items.slice(0, 3);
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupIcon}>{icon}</Text>
        <Text style={styles.groupTitle}>{title}</Text>
        <View style={[styles.countBadge, { backgroundColor: bg }]}>
          <Text style={[styles.countText, { color }]}>{shown.length}</Text>
        </View>
      </View>
      {shown.map((it, i) => (
        <View key={i} style={[styles.findingRow, { borderLeftColor: color }]}>
          <Text style={styles.findingText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

// 통합 분석 결과 렌더링 — 점수 링 · 카테고리 바 · 핵심 카드 · 상세 접기
function CombinedResultView({ result, images = [], scores = null, onRestart }) {
  const {
    summary = '',
    details = '',
    risk_factors = [],
    improvements = [],
    recommendations = [],
    photo = {},
  } = result || {};

  const [showDetails, setShowDetails] = useState(false);

  const total =
    scores && scores.total_score != null
      ? Math.round(Number(scores.total_score))
      : null;
  const totalGrade = total != null ? gradeFor(total) : null;

  const categoryBars = scores
    ? CATEGORY_DEFS.filter(([k]) => scores[k] != null).map(([k, label]) => ({
        label,
        value: Math.round(Number(scores[k])),
      }))
    : [];

  const POSITION_LABELS = {
    upper: 'Upper teeth',
    lower: 'Lower teeth',
    front: 'Front teeth',
  };
  const photoCards = (images || [])
    .map(img => ({
      key: img.image_type,
      label: POSITION_LABELS[img.image_type] || img.image_type,
      url: img.analyzed_image_url || img.original_image_url,
      isAnalyzed: !!img.analyzed_image_url,
    }))
    .filter(c => !!c.url);

  const photoNotes = [
    ['Upper teeth', photo.upper],
    ['Lower teeth', photo.lower],
    ['Front teeth', photo.front],
  ].filter(([, v]) => v);

  const hasDetails = !!details || photoNotes.length > 0 || !!photo.overall;

  return (
    <View>
      {/* 히어로: 총점 + 요약 */}
      <View style={styles.heroCard}>
        {total != null ? (
          <>
            <View style={[styles.scoreRing, { borderColor: totalGrade.color }]}>
              <Text style={[styles.scoreNumber, { color: totalGrade.color }]}>
                {total}
              </Text>
              <Text style={styles.scoreOutOf}>/ 100</Text>
            </View>
            <View style={[styles.gradePill, { backgroundColor: totalGrade.bg }]}>
              <Text style={[styles.gradePillText, { color: totalGrade.color }]}>
                {totalGrade.label}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.heroTitle}>Your result</Text>
        )}
        {!!summary && <Text style={styles.heroSummary}>{summary}</Text>}
      </View>

      {/* 카테고리 점수 바 */}
      {categoryBars.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Category scores</Text>
          {categoryBars.map(cat => {
            const g = gradeFor(cat.value);
            const pct = Math.max(0, Math.min(100, cat.value));
            return (
              <View key={cat.label} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {cat.label}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%`, backgroundColor: g.color },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: g.color }]}>
                  {cat.value}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 핵심: 위험 / 개선 / 추천 */}
      <FindingGroup
        icon="⚠️"
        title="Risk factors"
        items={risk_factors}
        color="#dc2626"
        bg="#fee2e2"
      />
      <FindingGroup
        icon="🔧"
        title="Habits to improve"
        items={improvements}
        color="#2563eb"
        bg="#dbeafe"
      />
      <FindingGroup
        icon="🪥"
        title="Recommendations"
        items={recommendations}
        color="#16a34a"
        bg="#dcfce7"
      />

      {/* 분석 사진 */}
      {photoCards.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Teeth photos</Text>
          {photoCards.map(card => (
            <View key={card.key} style={styles.photoItem}>
              <Text style={styles.resultSubLabel}>
                {card.label}
                {!card.isAnalyzed && ' (original)'}
              </Text>
              <Image
                source={{ uri: card.url }}
                style={styles.analyzedImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>
      )}

      {/* 상세 분석 (기본 접힘) */}
      {hasDetails && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowDetails(v => !v)}
          >
            <Text style={styles.blockTitle}>Detailed analysis</Text>
            <Text style={styles.collapseChevron}>
              {showDetails ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {showDetails && (
            <View style={{ marginTop: 10 }}>
              {!!details && <Text style={styles.resultText}>{details}</Text>}
              {photoNotes.map(([label, text]) => (
                <View key={label} style={{ marginTop: 12 }}>
                  <Text style={styles.resultSubLabel}>{label}</Text>
                  <Text style={styles.resultText}>{text}</Text>
                </View>
              ))}
              {!!photo.overall && (
                <Text style={[styles.resultText, { marginTop: 12 }]}>
                  {photo.overall}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onRestart}>
        <Text style={styles.primaryButtonText}>Start over</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // ===== 결과 화면(직관적 리디자인) =====
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  scoreRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 40, fontWeight: '800', lineHeight: 44 },
  scoreOutOf: { fontSize: 12, color: '#9ca3af', marginTop: -2 },
  gradePill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  gradePillText: { fontSize: 13, fontWeight: '700' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  heroSummary: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
    textAlign: 'center',
  },
  blockTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  // 카테고리 바
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  barLabel: { width: 120, fontSize: 12, color: '#4b5563' },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 30, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  // 핵심 카드
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  groupIcon: { fontSize: 16, marginRight: 8 },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { fontSize: 13, fontWeight: '800' },
  findingRow: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  findingText: { fontSize: 14, lineHeight: 20, color: '#374151' },
  // 접기
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseChevron: { fontSize: 12, color: '#9ca3af' },
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
