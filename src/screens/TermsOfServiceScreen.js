import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function TermsOfServiceScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 1 (Purpose)</Text>
          <Text style={styles.paragraph}>
            These Terms are intended to define the rights, obligations, and responsibilities between the Company and users in relation to the use of the oral health care service (hereinafter the "Service") provided by BloomDent (hereinafter the "Company").
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 2 (Definitions)</Text>
          <Text style={styles.paragraph}>
            1. "Service" means all oral health care related services provided by the Company.{'\n'}
            2. "User" means a person who agrees to these Terms and uses the Service.{'\n'}
            3. "Content" means all information, data, text, images, and the like provided through the Service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 3 (Effect and Amendment of the Terms)</Text>
          <Text style={styles.paragraph}>
            1. These Terms take effect when posted on the Service screen or otherwise announced to users.{'\n'}
            2. The Company may amend these Terms where necessary, within the limits of applicable law.{'\n'}
            3. Amended Terms take effect 7 days after the date they are announced.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 4 (Provision and Modification of the Service)</Text>
          <Text style={styles.paragraph}>
            1. The Company provides the following services:{'\n'}
            - AI-based oral health analysis service{'\n'}
            - Oral health care records and statistics service{'\n'}
            - Dental appointment service{'\n'}
            - Oral health information service{'\n'}
            2. The Company may change the content of the Service and will notify users in advance of any such change.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 5 (User Obligations)</Text>
          <Text style={styles.paragraph}>
            1. Users must not engage in the following while using the Service:{'\n'}
            - Stealing or misusing another person's information{'\n'}
            - Interfering with the stable operation of the Service{'\n'}
            - Acts that violate the law or these Terms{'\n'}
            2. Users are responsible for keeping their own account information secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 6 (Protection of Personal Information)</Text>
          <Text style={styles.paragraph}>
            The Company strives to protect users' personal information, and the protection and use of personal information are governed by applicable law and the Company's Privacy Policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 7 (Disclaimer)</Text>
          <Text style={styles.paragraph}>
            1. The Company is exempt from responsibility for providing the Service if it cannot do so due to a natural disaster or other comparable force majeure.{'\n'}
            2. The Company is not responsible for disruptions to Service use caused by the user's own fault.{'\n'}
            3. AI analysis results provided by the Company are for reference only; for an actual diagnosis, please consult a specialist.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 8 (Governing Law and Jurisdiction)</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by and construed in accordance with the laws of the Republic of Korea, and in the event of a dispute relating to the Service, the Seoul Central District Court shall be the court of jurisdiction.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            These Terms are effective as of January 1, 2024.
          </Text>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
  },
  footer: {
    marginTop: 32,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

