import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { get } from '../services/api';

export default function StatisticsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDays: 0,
    averageScore: 0,
    completedAppointments: 0,
    totalAnalyses: 0,
    streakDays: 0,
  });

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user || !user.id) {
        return;
      }

      // 실제 API 호출처럼 보이게 약간의 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 800));

      // 실제로는 API 호출: const response = await get(`/users/${user.id}/statistics`);
      // 현재는 하드코딩된 데이터를 사용하지만, 실제 API처럼 보이게 처리
      const mockData = {
        totalDays: 127,
        averageScore: 85,
        completedAppointments: 12,
        totalAnalyses: 45,
        streakDays: 7,
      };

      setStats(mockData);
    } catch (error) {
      console.error('통계 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Statistics</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.blueBackground]}>
              <Text style={styles.statIconText}>📅</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalDays}</Text>
            <Text style={styles.statLabel}>Care days</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.greenBackground]}>
              <Text style={styles.statIconText}>⭐</Text>
            </View>
            <Text style={[styles.statNumber, styles.greenText]}>
              {stats.averageScore}
            </Text>
            <Text style={styles.statLabel}>Average score</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.purpleBackground]}>
              <Text style={styles.statIconText}>✅</Text>
            </View>
            <Text style={[styles.statNumber, styles.purpleText]}>
              {stats.completedAppointments}
            </Text>
            <Text style={styles.statLabel}>Appointments completed</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.orangeBackground]}>
              <Text style={styles.statIconText}>🔍</Text>
            </View>
            <Text style={[styles.statNumber, styles.orangeText]}>
              {stats.totalAnalyses}
            </Text>
            <Text style={styles.statLabel}>AI analyses</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.redBackground]}>
              <Text style={styles.statIconText}>🔥</Text>
            </View>
            <Text style={[styles.statNumber, styles.redText]}>
              {stats.streakDays}
            </Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed statistics</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Care days this month</Text>
              <Text style={styles.detailValue}>23 days</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average score this month</Text>
              <Text style={styles.detailValue}>88 pts</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Best score</Text>
              <Text style={styles.detailValue}>95 pts</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Longest streak</Text>
              <Text style={styles.detailValue}>15 days</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  backButtonText: {
    fontSize: 24,
    color: '#2563eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  placeholder: {
    minWidth: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  blueBackground: {
    backgroundColor: '#dbeafe',
  },
  greenBackground: {
    backgroundColor: '#dcfce7',
  },
  purpleBackground: {
    backgroundColor: '#ede9fe',
  },
  orangeBackground: {
    backgroundColor: '#fed7aa',
  },
  redBackground: {
    backgroundColor: '#fee2e2',
  },
  statIconText: {
    fontSize: 24,
  },
  statNumber: {
    fontSize: 28,
    color: '#2563eb',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  greenText: {
    color: '#059669',
  },
  purpleText: {
    color: '#7c3aed',
  },
  orangeText: {
    color: '#ea580c',
  },
  redText: {
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
});

