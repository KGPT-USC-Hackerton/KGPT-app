import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { login } from '../services/authService';

const LoginScreen = ({ onLogin, onNavigateToSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
  if (!username.trim() || !password.trim()) {
    Alert.alert('Error', 'Please enter your username and password.');
    return;
  }

  setLoading(true);
  try {
    const response = await login(username.trim(), password);

    console.log('✅ login response:', response);

    if (response?.success) {
      // 백엔드 응답 구조: { success, data: { user, ... } } 라고 가정
      const user = response.data?.user;

      if (!user) {
        throw new Error("User information is missing from the login response.");
      }

      // ✅ 1) user_id를 AsyncStorage에 저장
      await AsyncStorage.setItem('user_id', String(user.id));

      // ✅ 2) 기존 콜백도 그대로 호출
      if (onLogin) {
        onLogin(user);
      }
    }
  } catch (error) {
    console.log('❌ login error:', error);

    let errorMessage = 'An error occurred while logging in.';

    if (error.status === 401) {
      errorMessage = error.message || 'Username or password does not match.';
    } else if (error.status === 400) {
      errorMessage = error.message || 'Please enter your username and password.';
    } else if (error.status === 0) {
      errorMessage = error.message || 'Please check your network connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    Alert.alert('Error', errorMessage);
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Log in</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={true}
          textContentType="none"
          autoComplete="off"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.linkButton}
          onPress={onNavigateToSignUp}
          disabled={loading}
        >
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 20,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default LoginScreen;