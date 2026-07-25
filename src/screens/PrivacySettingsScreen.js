import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { get } from '../services/api';

export default function PrivacySettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [privacySettings, setPrivacySettings] = useState({
    dataSharing: false,
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user || !user.id) {
        return;
      }

      // 실제 API 호출처럼 보이게 약간의 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 500));

      // 실제로는 API 호출: const response = await get(`/users/${user.id}/privacy-settings`);
    } catch (error) {
      console.error('개인정보 설정 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Notice', 'Account deletion is coming soon.');
          },
        },
      ]
    );
  };

  const handleDownloadData = () => {
    Alert.alert('Notice', 'Data download is coming soon.');
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
          <Text style={styles.headerTitle}>Privacy</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
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
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleDownloadData}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>📥</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Download my data</Text>
                  <Text style={styles.settingDescription}>
                    Download all of your stored data
                  </Text>
                </View>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>📄</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Privacy Policy</Text>
                  <Text style={styles.settingDescription}>
                    Review our Privacy Policy
                  </Text>
                </View>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>📊</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Anonymized analytics data</Text>
                  <Text style={styles.settingDescription}>
                    Collect anonymous data to improve the service
                  </Text>
                </View>
              </View>
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {privacySettings.analytics ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🤝</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Data sharing</Text>
                  <Text style={styles.settingDescription}>
                    Share data with third parties
                  </Text>
                </View>
              </View>
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {privacySettings.dataSharing ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>📢</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Marketing communications</Text>
                  <Text style={styles.settingDescription}>
                    Receive promotions and event updates
                  </Text>
                </View>
              </View>
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {privacySettings.marketing ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={[styles.settingItem, styles.dangerItem]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>🗑️</Text>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, styles.dangerText]}>
                    Delete account
                  </Text>
                  <Text style={styles.settingDescription}>
                    Permanently delete your account and all data
                  </Text>
                </View>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
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
    color: '#059669',
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dangerItem: {
    backgroundColor: '#fef2f2',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  dangerText: {
    color: '#dc2626',
  },
  settingDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  toggleContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  toggleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  arrow: {
    color: '#9ca3af',
    fontSize: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 52,
  },
});

