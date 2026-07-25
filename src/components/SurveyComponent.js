// SurveyComponent.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

/**
 * props
 *  - backendBaseUrl: 백엔드 베이스 URL
 *  - userId: 로그인한 사용자 ID
 *  - onSubmit(result): 설문 제출/점수 계산까지 끝났을 때 호출
 *  - isProcessing: 부모(CareScreen)에서 AI 분석/추천 중일 때 true
 */
export default function SurveyComponent({
  backendBaseUrl,
  userId,
  onSubmit,
  isProcessing = false,
}) {
  const SURVEY_API_BASE = `${backendBaseUrl}/api/survey`;

  // 설문 세션 ID
  const [sessionId, setSessionId] = useState(null);

  // 현재 문항 (객체) & 현재 문항 번호
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(null);

  // 현재 문항의 선택지 배열
  const [options, setOptions] = useState([]);

  // 전체 문항 수(서버에서 내려주는 total)
  const [totalQuestions, setTotalQuestions] = useState(0);

  // 로딩/전송 상태 및 에러
  const [isLoading, setIsLoading] = useState(false); // 문항 로딩용
  const [isSubmitting, setIsSubmitting] = useState(false); // 응답 처리/제출용
  const [error, setError] = useState(null);

  // 설문 완료 여부
  const [isCompleted, setIsCompleted] = useState(false);

  // 전체 설문 캐시: { [question_number]: { question, options } }
  const [questionCache, setQuestionCache] = useState({});

  // 지금까지 응답한 내용 배열
  // [{ question_number, option_number, score, category }, ...]
  const [answers, setAnswers] = useState([]);

  /**
   * ===== 1) 설문 시작: GET /start =====
   */
  useEffect(() => {
    const startSurvey = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setIsCompleted(false);
        setAnswers([]);
        setQuestionCache({});

        console.log('▶ SURVEY_API_BASE =', SURVEY_API_BASE);
        console.log('▶ start URL =', `${SURVEY_API_BASE}/start`);

        const res = await fetch(`${SURVEY_API_BASE}/start`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Unable to start the survey.');
        }

        const { session_id, current_question, options, progress } = json.data;

        console.log('startSurvey 응답:', json.data);

        setSessionId(session_id);
        setCurrentQuestion(current_question);
        setCurrentQuestionNumber(current_question.question_number);
        setOptions(options || []);
        setTotalQuestions(progress?.total || 0);

        // 캐시에 첫 문항 저장
        setQuestionCache({
          [current_question.question_number]: {
            question: current_question,
            options: options || [],
          },
        });
      } catch (e) {
        console.error('Survey start error:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    startSurvey();
  }, [SURVEY_API_BASE]);

  /**
   * 진행도 퍼센트/텍스트
   * 👉 현재 문항 번호 기준 (Q32면 32 / 47)
   */
  const progressRatio = useMemo(() => {
    if (!totalQuestions || !currentQuestionNumber) return 0;
    return (currentQuestionNumber / totalQuestions) * 100;
  }, [currentQuestionNumber, totalQuestions]);

  const progressText = useMemo(() => {
    if (!totalQuestions || !currentQuestionNumber) return '0 / 0';
    return `${currentQuestionNumber} / ${totalQuestions}`;
  }, [currentQuestionNumber, totalQuestions]);

  // 현재 문항 카테고리 (옵션의 category 기준)
  const currentCategory = options[0]?.category || 'Oral care survey';

  /**
   * ===== 2) 다음 문항 로딩: GET /questions/:questionNumber =====
   */
  const fetchQuestionIfNeeded = async questionNumber => {
    // 이미 캐시에 있으면 그대로 반환
    if (questionCache[questionNumber]) {
      return questionCache[questionNumber];
    }

    try {
      setIsLoading(true);
      setError(null);

      const url = `${SURVEY_API_BASE}/questions/${questionNumber}`;
      console.log('GET', url);
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Unable to load the next question.');
      }

      const { question, options } = json.data;

      // 캐시에 저장
      setQuestionCache(prev => ({
        ...prev,
        [questionNumber]: {
          question,
          options: options || [],
        },
      }));

      return { question, options: options || [] };
    } catch (e) {
      console.error('fetchQuestionIfNeeded error:', e);
      setError(e.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ===== 3) 최종 제출: POST /submit =====
   * - 모든 응답을 한 번에 서버로 전송
   */
  const submitSurveyOnce = async (safeUserId, allAnswers) => {
    if (!sessionId) {
      throw new Error('No survey session information.');
    }

    const payload = {
      user_id: safeUserId,
      session_id: sessionId,
      answers: allAnswers.map(a => ({
        question_number: a.question_number,
        option_number: a.option_number,
      })),
    };

    console.log('POST /submit payload:', payload);

    const res = await fetch(`${SURVEY_API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    console.log('POST /submit 응답:', json);

    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit the survey or calculate the score.');
    }

    setIsCompleted(true);

    // 부모 컴포넌트로 결과 전달
    onSubmit?.({
      sessionId,
      answers: allAnswers,
      scores: json.data, // total_score, categories 등
    });
  };

  /**
   * ===== 4) 응답 선택 =====
   */
  const handleSelectOption = async optionNumber => {
    console.log('handleSelectOption 호출:', {
      sessionId,
      hasCurrentQuestion: !!currentQuestion,
      userId,
      optionNumber,
    });

    if (!currentQuestion || !options.length) {
      setError('Could not find the current question.');
      return;
    }

    let safeUserId = userId;
    if (!safeUserId) {
      console.warn('⚠ userId가 비어있습니다. 임시로 0을 사용합니다.');
      safeUserId = 0;
    }

    // 현재 문항에서 선택한 옵션 찾기
    const selectedOption = options.find(
      opt => opt.option_number === optionNumber,
    );

    if (!selectedOption) {
      setError('Could not find the selected answer.');
      return;
    }

    const nextQuestionNumber = selectedOption.next_question_number;

    // 새로 추가될 응답
    const newAnswer = {
      question_number: currentQuestion.question_number,
      option_number: optionNumber,
      score: selectedOption.score,
      category: selectedOption.category,
    };

    const updatedAnswers = [...answers, newAnswer];

    try {
      setIsSubmitting(true);
      setError(null);

      setAnswers(updatedAnswers);

      // 다음 문항이 없는 경우 → 설문 종료 → 한 번에 submit
      if (!nextQuestionNumber) {
        console.log('마지막 문항, 설문 종료. 한 번에 제출 시작.');
        await submitSurveyOnce(safeUserId, updatedAnswers);
        return;
      }

      // 다음 문항 가져오기
      const next = await fetchQuestionIfNeeded(nextQuestionNumber);
      if (!next) {
        throw new Error('Failed to load the next question.');
      }

      setCurrentQuestion(next.question);
      setCurrentQuestionNumber(next.question.question_number);
      setOptions(next.options || []);
    } catch (e) {
      console.error('handleSelectOption error:', e);
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * ===== 5) 이전 버튼 구현 =====
   * - answers 배열의 마지막 답변을 제거하고,
   *   그 질문을 다시 currentQuestion 으로 복원
   */
  const handlePrev = () => {
    if (!answers.length) {
      return;
    }

    const lastAnswer = answers[answers.length - 1];
    const prevQuestionNumber = lastAnswer.question_number;

    const cached = questionCache[prevQuestionNumber];
    if (!cached) {
      console.warn('⚠ 이전 문항 캐시를 찾지 못했습니다:', prevQuestionNumber);
      return;
    }

    // 마지막 답변 제거
    setAnswers(prev => prev.slice(0, -1));

    // 완료 상태 해제
    setIsCompleted(false);
    setError(null);

    // 이전 문항으로 화면 복원
    setCurrentQuestion(cached.question);
    setCurrentQuestionNumber(cached.question.question_number);
    setOptions(cached.options || []);
  };

  /**
   * 로딩/에러/데이터 없음 처리
   */
  if (isLoading && !currentQuestion) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>Loading the survey...</Text>
        </View>
      </View>
    );
  }

  if (error && !currentQuestion) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={{ color: 'red', marginBottom: 8 }}>
            Failed to load the survey.
          </Text>
          <Text>{error}</Text>
        </View>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text>There are no survey questions to show.</Text>
        </View>
      </View>
    );
  }

  /**
   * 옵션 버튼 리스트
   */
  const optionButtons = options.map(opt => ({
    label: opt.option_text,
    optionNumber: opt.option_number,
  }));

  // 이전 버튼 비활성 조건
  const isPrevDisabled = isSubmitting || !answers.length || isProcessing;

  // 선택지 비활성 조건
  const optionDisabled = isSubmitting || isCompleted || isProcessing;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* 상단 진행도 영역 */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressRatio}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>

        {/* 질문 카드 영역 */}
        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            {/* 카테고리 태그 */}
            <Text style={styles.sectionTag}>{currentCategory}</Text>

            {/* 아이콘 */}
            <View style={styles.questionIcon}>
              <Text style={styles.questionIconText}>🦷</Text>
            </View>

            {/* 실제 질문 텍스트 */}
            <Text style={styles.questionTitle}>
              Q{currentQuestion.question_number}.{' '}
              {currentQuestion.question_text}
            </Text>

            {/* 문항 최대 점수 안내 */}
            <Text style={styles.questionSub}>
              (Max {currentQuestion.max_score} points for this question)
            </Text>
          </View>

          {/* 선택지 버튼 리스트 */}
          <View style={styles.optionsContainer}>
            {optionButtons.map(opt => (
              <TouchableOpacity
                key={`${currentQuestion.question_number}_${opt.optionNumber}`}
                onPress={() => {
                  console.log(
                    '옵션 클릭됨:',
                    currentQuestion,
                    opt.optionNumber,
                  );
                  handleSelectOption(opt.optionNumber);
                }}
                style={styles.optionButton}
                disabled={optionDisabled}
              >
                <Text style={styles.optionButtonText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            {/* 응답 처리 중 (다음 문항/제출) */}
            {isSubmitting && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Processing your answer...
                </Text>
              </View>
            )}

            {/* 설문 완료 후, 부모에서 AI 분석/추천 중일 때 */}
            {!isSubmitting && isProcessing && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Analyzing your survey results...
                </Text>
              </View>
            )}

            {/* 에러 메시지 */}
            {error && (
              <Text style={{ marginTop: 8, color: 'red', fontSize: 12 }}>
                {error}
              </Text>
            )}

            {/* 설문 자체 완료 메시지 */}
            {isCompleted && !isProcessing && (
              <Text style={{ marginTop: 8, color: '#10b981', fontSize: 13 }}>
                Survey complete. Your results have been analyzed.
              </Text>
            )}
          </View>
        </View>

        {/* 하단 네비게이션 */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={handlePrev}
            disabled={isPrevDisabled}
            style={[styles.navBtn, isPrevDisabled && styles.navBtnDisabled]}
          >
            <Text style={styles.navBtnText}>Previous</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * 스타일
 */
const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  progressSection: { marginBottom: 20 },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  questionCard: { flex: 1, marginBottom: 20 },
  questionHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTag: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 8,
  },
  questionIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#dcfce7',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  questionIconText: { fontSize: 32 },
  questionTitle: {
    color: '#374151',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  questionSub: {
    color: '#9ca3af',
    fontSize: 13,
  },
  optionsContainer: { gap: 12 },
  optionButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonText: {
    color: '#374151',
    fontSize: 16,
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  navBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    color: '#111827',
    fontWeight: '600',
  },
});
