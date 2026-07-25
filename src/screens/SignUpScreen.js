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
  ScrollView,
} from 'react-native';
import { register } from '../services/authService';

const SignUpScreen = ({ onSignUpComplete, onBackToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Please enter a username.';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters.';
    }

    if (!formData.password) {
      newErrors.password = 'Please enter a password.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Please confirm your password.';
    } else if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Passwords do not match.';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter your name.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // 비밀번호 확인 필드 제거
      const { passwordConfirm, ...signUpData } = formData;
      
      // 회원가입 API 호출 (설문 답변 없이)
      const response = await register(signUpData);
      
      if (response.success) {
        Alert.alert('Success', 'Sign up complete.', [
          {
            text: 'OK',
            onPress: () => {
              // 회원가입 완료 후 로그인 상태로 전환
              if (onSignUpComplete) {
                onSignUpComplete();
              }
            },
          },
        ]);
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      let errorMessage = 'An error occurred during sign up.';

      if (error.status === 409) {
        errorMessage = error.message || 'This username is already taken.';
      } else if (error.status === 400) {
        errorMessage = error.message || 'Please check your information.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // 에러 초기화
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Sign up</Text>

          <TextInput
            style={[styles.input, errors.username && styles.inputError]}
            placeholder="Username *"
            value={formData.username}
            onChangeText={(value) => updateField('username', value)}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          {errors.username && (
            <Text style={styles.errorText}>{errors.username}</Text>
          )}

          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Password *"
            value={formData.password}
            onChangeText={(value) => updateField('password', value)}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
            textContentType="none"
            autoComplete="off"
            editable={!loading}
          />
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <TextInput
            style={[styles.input, errors.passwordConfirm && styles.inputError]}
            placeholder="Confirm password *"
            value={formData.passwordConfirm}
            onChangeText={(value) => updateField('passwordConfirm', value)}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
            textContentType="none"
            autoComplete="off"
            editable={!loading}
          />
          {errors.passwordConfirm && (
            <Text style={styles.errorText}>{errors.passwordConfirm}</Text>
          )}

          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Name *"
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
            editable={!loading}
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}

          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="Phone (optional)"
            value={formData.phone}
            onChangeText={(value) => updateField('phone', value)}
            keyboardType="phone-pad"
            editable={!loading}
          />
          {errors.phone && (
            <Text style={styles.errorText}>{errors.phone}</Text>
          )}

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email (optional)"
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />
          {errors.email && (
            <Text style={styles.errorText}>{errors.email}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={onBackToLogin}
            disabled={loading}
          >
            <Text style={styles.linkText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 10,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    width: '100%',
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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

export default SignUpScreen;

