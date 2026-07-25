import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from './screens/HomeScreen';
import CareScreen from './screens/CareScreen';
import AppointmentScreen from './screens/AppointmentScreen';
import MyPageScreen from './screens/MyPageScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import Start_SurveyScreen from './screens/Start_SurveyScreen';
import LearnScreen from './screens/LearnScreen';
import StatisticsScreen from './screens/StatisticsScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import PrivacySettingsScreen from './screens/PrivacySettingsScreen';
import AppSettingsScreen from './screens/AppSettingsScreen';
import HelpScreen from './screens/HelpScreen';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import ProductRecommendationScreen from './screens/care/ProductRecommendationScreen';
import CartReviewScreen from './screens/care/CartReviewScreen';
import { getCurrentUser } from './services/authService';
import { getSurveyCompleted } from './utils/storage';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Care Stack Navigator 컴포넌트
// 기존 Care 탭(CareMain)을 유지하면서 6B 추천/장바구니 화면을 push할 수 있도록
// native-stack으로 승격한다. (MyPageStack과 동일 패턴)
export function CareStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CareMain" component={CareScreen} />
      <Stack.Screen name="ProductRecommendation" component={ProductRecommendationScreen} />
      <Stack.Screen name="CartReview" component={CartReviewScreen} />
    </Stack.Navigator>
  );
}

// MyPage Stack Navigator 컴포넌트
function MyPageStack({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyPageMain">
        {(props) => <MyPageScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AppSettings"
        component={AppSettingsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // 앱 시작 시 저장된 사용자 정보 확인 (자동 로그인)
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setIsLoggedIn(true);
        // 설문 완료 여부 확인
        const completed = await getSurveyCompleted();
        setSurveyCompleted(completed);
      }
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (user) => {
    setIsLoggedIn(true);
    setShowSignUp(false);
    // 로그인한 사용자는 이미 설문을 완료한 것으로 간주 (DB에 저장된 사용자)
    setSurveyCompleted(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSurveyCompleted(false);
    setShowSurvey(false);
    setIsNewUser(false);
  };

  const handleSignUpComplete = () => {
    // 회원가입 완료 후 로그인 상태로 전환
    setShowSignUp(false);
    setIsLoggedIn(true);
    setSurveyCompleted(true);
  };

  const handleSurveyComplete = (answers) => {
    // 설문 완료 후 메인 화면으로 이동
    setSurveyCompleted(true);
    setShowSurvey(false);
    setIsNewUser(false);
    setIsLoggedIn(true);
  };

  // 로딩 중
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 로그인 화면 또는 회원가입 화면
  if (!isLoggedIn && !showSurvey) {
    if (showSignUp) {
      return (
        <SignUpScreen
          onSignUpComplete={handleSignUpComplete}
          onBackToLogin={() => setShowSignUp(false)}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        onNavigateToSignUp={() => setShowSignUp(true)}
      />
    );
  }

  // 신규 회원가입 후 설문 화면
  if (showSurvey && isNewUser) {
    return <Start_SurveyScreen onComplete={handleSurveyComplete} isNewUser={true} />;
  }

  // 기존 사용자 설문 (현재는 사용하지 않지만 나중을 위해 유지)
  if (isLoggedIn && !surveyCompleted && !isNewUser) {
    return <Start_SurveyScreen onComplete={handleSurveyComplete} isNewUser={false} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.topSafeArea} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: '홈',
              tabBarIcon: ({ color, size }) => (
                <Icon name="home" color={color} size={size} />
              ),
            }}
          />
          
          <Tab.Screen
            name="Learn"
            component={LearnScreen} // ✅ LearnNavigator → LearnScreen
            options={{
              title: '학습',
              tabBarIcon: ({ color, size }) => (
                <Icon name="menu-book" color={color} size={size} />
              ),
            }}
          />

          <Tab.Screen
            name="Care"
            component={CareStack}
            options={{
              title: '관리',
              tabBarIcon: ({ color, size }) => (
                <Icon name="camera" color={color} size={size} />
              ),
            }}
          />

          <Tab.Screen
            name="Appointment"
            component={AppointmentScreen}
            options={{
              title: '예약',
              tabBarIcon: ({ color, size }) => (
                <Icon name="calendar-month" color={color} size={size} />
              ),
            }}
          />

          <Tab.Screen
            name="My Page"
            options={{
              title: '마이페이지',
              tabBarIcon: ({ color, size }) => (
                <Icon name="person" color={color} size={size} />
              ),
            }}>
            {() => <MyPageStack onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSafeArea: { flex: 0, backgroundColor: '#f8f9fa' },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
