// src/components/PhotoAnalysisSummaryCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function PhotoAnalysisSummaryCard({ history, onPress }) {
  if (!history) return null;

  // 날짜 문자열 (first_uploaded_at 기준)
  const rawDate = history.first_uploaded_at || history.last_uploaded_at;
  let dateLabel = '';
  if (rawDate) {
    const d = new Date(rawDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateLabel = `${year}-${month}-${day}`;
  }

  // 상태 텍스트 (completed_count 로 판단)
  const isCompleted = Number(history.completed_count || 0) >= 3;
  const statusText = isCompleted
    ? 'AI analysis is complete.'
    : 'Analysis is in progress.';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{dateLabel}</Text>
        <Text style={styles.cardTag}>Oral photo analysis</Text>
      </View>
      <Text style={styles.cardSummary} numberOfLines={2}>
        {history.llm_summary || statusText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardSummary: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 4,
  },
});
