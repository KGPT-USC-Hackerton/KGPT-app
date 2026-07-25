// components/FollowupQuestionsComponent.js
// 설문 + 사진 분석 후, 최종 리포트 전에 AI가 부족한 정보를 보완하기 위해
// 생성한 객관식 추가 질문을 보여주고 답변을 수집한다.
//  - props.onComplete(answers): [{ question, answer }] 로 결과 전달(부분 답변 허용)
//  - props.onSkip(): 문진 전체 건너뛰기
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';

const OTHER = '__other__';

export default function FollowupQuestionsComponent({
  backendBaseUrl,
  userId,
  surveySessionId,
  historyId,
  onComplete,
  onSkip,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);
  // { [questionId]: { choice: number | '__other__', custom: string } }
  const [answers, setAnswers] = useState({});

  const fetchQuestions = useCallback(async () => {
    if (!userId || !surveySessionId || !historyId) {
      // 정보가 없으면 문진을 건너뛴다.
      onSkip?.();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendBaseUrl}/api/ai/followup-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          survey_session_id: surveySessionId,
          history_id: historyId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.message || `Follow-up API error (status ${res.status})`,
        );
      }
      const list = Array.isArray(json.questions) ? json.questions : [];
      if (list.length === 0) {
        // 물어볼 게 없으면 바로 결과로 진행.
        onComplete?.([]);
        return;
      }
      setQuestions(list);
    } catch (e) {
      console.error('추가 질문 로드 오류:', e);
      setError(e.message || 'Failed to load follow-up questions.');
    } finally {
      setLoading(false);
    }
  }, [backendBaseUrl, userId, surveySessionId, historyId, onComplete, onSkip]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const selectOption = (qid, choice) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: { ...(prev[qid] || {}), choice },
    }));
  };

  const setCustom = (qid, text) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: { ...(prev[qid] || {}), choice: OTHER, custom: text },
    }));
  };

  // 답변된 질문만 { question, answer } 로 수집한다(부분 답변 허용).
  const buildAnswers = () =>
    questions
      .map(q => {
        const a = answers[q.id];
        if (!a || a.choice === undefined || a.choice === null) return null;
        let answerText;
        if (a.choice === OTHER) {
          answerText = (a.custom || '').trim();
        } else {
          answerText = q.options[a.choice];
        }
        if (!answerText) return null;
        return { question: q.question, answer: answerText };
      })
      .filter(Boolean);

  const answeredCount = buildAnswers().length;

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>
          Preparing a few follow-up questions...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Couldn't load follow-up questions</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={fetchQuestions}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => onSkip?.()}>
          <Text style={styles.linkText}>Skip and see results</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>A few more questions</Text>
        <Text style={styles.headerSubtitle}>
          Based on your survey and photos, answering these helps make your
          result more accurate. You can skip any of them.
        </Text>
      </View>

      {questions.map((q, qi) => {
        const a = answers[q.id] || {};
        return (
          <View key={q.id} style={styles.card}>
            <Text style={styles.question}>
              {qi + 1}. {q.question}
            </Text>
            {q.options.map((opt, oi) => {
              const selected = a.choice === oi;
              return (
                <TouchableOpacity
                  key={oi}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => selectOption(q.id, oi)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* 기타(직접 입력) */}
            <TouchableOpacity
              style={[
                styles.option,
                a.choice === OTHER && styles.optionSelected,
              ]}
              onPress={() => selectOption(q.id, OTHER)}
            >
              <Text
                style={[
                  styles.optionText,
                  a.choice === OTHER && styles.optionTextSelected,
                ]}
              >
                Other
              </Text>
            </TouchableOpacity>
            {a.choice === OTHER && (
              <TextInput
                style={styles.input}
                placeholder="Type your answer"
                placeholderTextColor="#9ca3af"
                value={a.custom || ''}
                onChangeText={text => setCustom(q.id, text)}
                multiline
              />
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => onComplete?.(buildAnswers())}
      >
        <Text style={styles.primaryButtonText}>
          {answeredCount > 0
            ? `See results (${answeredCount} answered)`
            : 'See results'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => onSkip?.()}>
        <Text style={styles.linkText}>Skip all and see results</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  headerBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e3a8a' },
  headerSubtitle: { marginTop: 6, fontSize: 13, color: '#3b5bdb', lineHeight: 19 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 21,
  },
  option: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  optionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextSelected: { color: '#1d4ed8', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 44,
    marginTop: 4,
  },
  loadingText: { marginTop: 10, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 14 },
});
