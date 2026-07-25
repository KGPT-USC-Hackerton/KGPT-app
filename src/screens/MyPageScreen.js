import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logout } from '../services/authService';
import { getCurrentUser } from '../services/authService';

export default function MyPageScreen({ navigation, onLogout }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  // 화면 포커스 시 사용자 정보 다시 로드 (프로필 수정 후 돌아올 때)
  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', () => {
      loadUserInfo();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUserInfo = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
    }
  };

  const handleEditProfile = () => {
    if (navigation) {
      navigation.navigate('EditProfile');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('로그아웃 오류:', error);
              Alert.alert('Error', 'An error occurred while logging out.');
            }
          },
        },
      ]
    );
  };
  return (
    <ScrollView style={styles.container}>
      {/* 프로필 섹션 */}
      <View style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatar}>
            <Icon name="person" size={32} color="#ffffff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || user?.username || ''}</Text>
            <Text style={styles.profileMembership}>Regular member</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Icon name="edit" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 설정 메뉴 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsCard}>
          {/* 알림 설정 */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation?.navigate('NotificationSettings')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.blueBackground]}>
                <Icon name="notifications" size={16} color="#1e40af" />
              </View>
              <Text style={styles.settingText}>Notification settings</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 개인정보 보호 */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation?.navigate('PrivacySettings')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.greenBackground]}>
                <Icon name="security" size={16} color="#16a34a" />
              </View>
              <Text style={styles.settingText}>Privacy</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 앱 설정 */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation?.navigate('AppSettings')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.purpleBackground]}>
                <Icon name="settings" size={16} color="#7c3aed" />
              </View>
              <Text style={styles.settingText}>App settings</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 도움말 */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation?.navigate('Help')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.yellowBackground]}>
                <Icon name="help-outline" size={16} color="#d97706" />
              </View>
              <Text style={styles.settingText}>Help</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 구독 정보 */}
      <View style={styles.section}>
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionContent}>
            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionTitle}>Premium plan</Text>
              <Text style={styles.subscriptionDescription}>Unlimited AI analysis + expert consultation</Text>
              <Text style={styles.subscriptionExpiry}>Until 12/23/2025</Text>
            </View>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => navigation?.navigate('Subscription')}
            >
              <Text style={styles.manageButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 앱 정보 */}
      <View style={styles.section}>
        <View style={styles.appInfoCard}>
          <View style={styles.appInfoItem}>
            <Text style={styles.appInfoLabel}>App version</Text>
            <Text style={styles.appInfoValue}>1.2.3</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.appInfoItem}
            onPress={() => navigation?.navigate('TermsOfService')}
          >
            <Text style={styles.appInfoLabel}>Terms of Service</Text>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.appInfoItem}
            onPress={() => navigation?.navigate('PrivacyPolicy')}
          >
            <Text style={styles.appInfoLabel}>Privacy Policy</Text>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 로그아웃 */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={18} color="#dc2626" style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  profileCard: {
    margin: 16,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: '#3b82f6',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  profileMembership: {
    fontSize: 14,
    color: '#2563eb',
  },
  editButton: {
    padding: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
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
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  yellowBackground: {
    backgroundColor: '#fef3c7',
  },
  settingText: {
    color: '#374151',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  subscriptionCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  subscriptionExpiry: {
    fontSize: 14,
    color: '#7c3aed',
  },
  manageButton: {
    borderWidth: 1,
    borderColor: '#c4b5fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  manageButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  appInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  appInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  appInfoLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  appInfoValue: {
    color: '#374151',
    fontSize: 14,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
});