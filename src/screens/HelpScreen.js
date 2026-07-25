import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function HelpScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});

  const faqItems = [
    {
      id: 1,
      question: 'How do I use AI analysis?',
      answer: 'Take a photo on the home screen or pick one from your gallery, and AI analysis starts automatically. You can view the results right away.',
    },
    {
      id: 2,
      question: 'How do I book an appointment?',
      answer: 'On the appointment screen, choose the dental clinic you want and select a date and time to complete your booking. Filling out the pre-visit self-assessment survey beforehand helps with a more accurate diagnosis.',
    },
    {
      id: 3,
      question: 'What are the benefits of the Premium plan?',
      answer: 'With the Premium plan, you get unlimited AI analysis, expert consultation services, and detailed statistics reports.',
    },
    {
      id: 4,
      question: 'Is my data stored securely?',
      answer: 'Yes. All personal and health data is encrypted and stored securely. You can find more details in our Privacy Policy.',
    },
    {
      id: 5,
      question: 'If I delete the app, is my data deleted too?',
      answer: 'Deleting the app removes your local data, but data stored on the server is kept. If you want to delete your account, please do so from Settings.',
    },
  ];

  const toggleItem = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqCard}>
            {faqItems.map((item) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.faqItem}
                  onPress={() => toggleItem(item.id)}
                >
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Text style={styles.expandIcon}>
                    {expandedItems[item.id] ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {expandedItems[item.id] && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{item.answer}</Text>
                  </View>
                )}
                {item.id < faqItems.length && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Text style={styles.contactIcon}>📧</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>support@bloomdent.com</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.contactItem}>
              <Text style={styles.contactIcon}>📞</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>1588-0000</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.contactItem}>
              <Text style={styles.contactIcon}>🕐</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Hours</Text>
                <Text style={styles.contactValue}>Weekdays 09:00 - 18:00</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Guide</Text>
          <View style={styles.guideCard}>
            <View style={styles.guideItem}>
              <View style={[styles.guideIcon, styles.blueBackground]}>
                <Text style={styles.guideIconText}>📸</Text>
              </View>
              <View style={styles.guideContent}>
                <Text style={styles.guideTitle}>Taking photos</Text>
                <Text style={styles.guideDescription}>
                  Capturing the inside of your mouth clearly gives you more accurate analysis results.
                </Text>
              </View>
            </View>
            <View style={styles.guideItem}>
              <View style={[styles.guideIcon, styles.greenBackground]}>
                <Text style={styles.guideIconText}>📊</Text>
              </View>
              <View style={styles.guideContent}>
                <Text style={styles.guideTitle}>Checking statistics</Text>
                <Text style={styles.guideDescription}>
                  On My Page, you can check statistics such as care days and average score.
                </Text>
              </View>
            </View>
            <View style={styles.guideItem}>
              <View style={[styles.guideIcon, styles.purpleBackground]}>
                <Text style={styles.guideIconText}>📅</Text>
              </View>
              <View style={styles.guideContent}>
                <Text style={styles.guideTitle}>Managing appointments</Text>
                <Text style={styles.guideDescription}>
                  On the appointment screen, you can review your appointments and book new ones.
                </Text>
              </View>
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
    color: '#f59e0b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  placeholder: {
    minWidth: 40,
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
  faqCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  expandIcon: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 12,
  },
  faqAnswerContainer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#f9fafb',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  guideCard: {
    gap: 12,
  },
  guideItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  guideIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  guideIconText: {
    fontSize: 24,
  },
  guideContent: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  guideDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 16,
  },
});

