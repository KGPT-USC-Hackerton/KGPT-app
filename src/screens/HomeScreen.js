import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getCurrentUser } from '../services/authService';
import { get } from '../services/api';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [currentScore, setCurrentScore] = useState(null);
  const [tipText, setTipText] = useState('');
  const [tipLoading, setTipLoading] = useState(true);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    loadChartData();
    loadTodayTip();
  }, []);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      // 사용자 이름 저장
      if (user.name) {
        setUserName(user.name);
      }

      try {
        const response = await get(`/scores/user/${user.id}/chart`);
        if (response.success && response.data) {
          const data = response.data.chart_data || [];
          setChartData(data);
          
          // 가장 최근 점수를 현재 점수로 설정
          if (data.length > 0) {
            setCurrentScore(Math.round(data[data.length - 1].total_score));
          } else {
            setCurrentScore(null);
          }
        } else {
          setCurrentScore(null);
        }
      } catch (error) {
        // API 오류 시 빈 데이터로 처리 (빈 그래프 표시)
        console.log('차트 데이터 로드 오류:', error);
        setChartData([]);
        setCurrentScore(null);
      }
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
      setChartData([]);
      setCurrentScore(null);
    } finally {
      setLoading(false);
    }
  };

  // 차트 데이터 준비
  const prepareChartData = () => {
    if (!chartData || chartData.length === 0) {
      // 데이터가 없을 때 빈 그래프를 위한 기본 데이터
      return {
        labels: ['', '', '', '', '', '', ''],
        datasets: [
          {
            data: [0, 0, 0, 0, 0, 0, 0],
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      };
    }

    // 날짜 포맷팅 (MM/DD 형식)
    const labels = chartData.map(item => {
      const date = new Date(item.timestamp || item.date);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    });

    // 점수 데이터
    const scores = chartData.map(item => item.total_score);

    return {
      labels: labels.length > 7 ? labels.slice(-7) : labels,
      datasets: [
        {
          data: scores.length > 7 ? scores.slice(-7) : scores,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#2563eb',
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#e5e7eb',
      strokeWidth: 1,
    },
  };

  // 오늘의 팁 로드
  const loadTodayTip = async () => {
    try {
      setTipLoading(true);
      const response = await get('/ai/today-tip');
      if (response.success && response.tip) {
        setTipText(response.tip);
      } else {
        // 기본 팁 표시
        setTipText('It is best not to eat within 30 minutes after brushing. Give the fluoride time to be fully absorbed into your teeth.');
      }
    } catch (error) {
      console.log('오늘의 팁 로드 오류:', error);
      // 에러 시 기본 팁 표시
      setTipText('It is best not to eat within 30 minutes after brushing. Give the fluoride time to be fully absorbed into your teeth.');
    } finally {
      setTipLoading(false);
    }
  };

  // 오늘 날짜 포맷팅
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return `${month}/${day}/${year}`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* 인사말과 오늘 날짜 */}
      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>
          {userName ? `Hello, ${userName}! 👋` : 'Hello! 👋'}
        </Text>
        <Text style={styles.greetingSubtext}>Start your healthy oral care today</Text>
        <Text style={styles.dateText}>{getTodayDate()}</Text>
      </View>

      {/* 건강 현황 카드 */}
      <View style={styles.healthCard}>
        <View style={styles.healthCardContent}>
          <View style={styles.healthInfo}>
            <Text style={styles.healthTitle}>Oral health score</Text>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>{currentScore !== null ? currentScore : '-'}</Text>
              {currentScore !== null && <Text style={styles.scoreMax}>/ 100</Text>}
            </View>
          </View>
          <View style={styles.iconContainer}>
            <Icon name="trending-up" size={24} color="#ffffff" />
          </View>
        </View>
        {currentScore !== null && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${currentScore}%` }]} />
          </View>
        )}
      </View>

      {/* 점수 추이 그래프 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oral score graph</Text>
        <View style={styles.chartCard}>
          {loading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : (
            <LineChart
              data={prepareChartData()}
              width={screenWidth - 64}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={true}
              withDots={true}
              withShadow={false}
              yAxisInterval={20}
              segments={4}
            />
          )}
          {(!loading && (!chartData || chartData.length === 0)) && (
            <View style={styles.emptyChartMessage}>
              <Text style={styles.emptyChartText}>No scores recorded yet</Text>
            </View>
          )}
        </View>
      </View>

      {/* 건강 팁 */}
      <View style={styles.tipCard}>
        <View style={styles.tipContent}>
          <View style={styles.tipIconContainer}>
            <Icon name="emoji-events" size={16} color="#ffffff" />
          </View>
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Today's tip</Text>
            {tipLoading ? (
              <View style={styles.tipLoading}>
                <ActivityIndicator size="small" color="#9ca3af" />
              </View>
            ) : (
              <Text style={styles.tipText}>{tipText}</Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  greeting: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  greetingTitle: {
    fontSize: 20,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  greetingSubtext: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  healthCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  healthCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthInfo: {
    flex: 1,
  },
  healthTitle: {
    color: '#374151',
    marginBottom: 4,
    fontSize: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    color: '#2563eb',
    marginRight: 8,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 14,
    color: '#6b7280',
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#3b82f6',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#bfdbfe',
    borderRadius: 4,
    marginTop: 12,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    width: '80%',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#374151',
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  todoList: {
    gap: 12,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  todoCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  todoCompleted: {
    backgroundColor: '#10b981',
  },
  todoPending: {
    backgroundColor: '#e5e7eb',
  },
  todoCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  todoPendingText: {
    color: '#6b7280',
    fontSize: 12,
  },
  todoText: {
    color: '#374151',
    fontSize: 16,
  },
  tipCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fefce8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#eab308',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    color: '#374151',
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  tipText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLoading: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartMessage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  tipLoading: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});