import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 1 (Purpose of Processing Personal Information)</Text>
          <Text style={styles.paragraph}>
            BloomDent (hereinafter the "Company") processes personal information for the following purposes:{'\n'}
            1. Service delivery: providing oral health care services and appointment services{'\n'}
            2. Member management: identifying members, verifying identity, and preventing fraudulent use{'\n'}
            3. Service improvement: developing new services and providing personalized services{'\n'}
            4. Marketing and advertising: providing event and promotion information
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 2 (Processing and Retention Period of Personal Information)</Text>
          <Text style={styles.paragraph}>
            1. The Company processes and retains personal information within the retention and use period required by law or the retention and use period agreed to by the data subject at the time of collection.{'\n'}
            2. The processing and retention periods for each category of personal information are as follows:{'\n'}
            - Sign-up information: until the member withdraws{'\n'}
            - Service usage records: 3 years{'\n'}
            - Payment information: 5 years, in accordance with applicable law
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 3 (Categories of Personal Information Processed)</Text>
          <Text style={styles.paragraph}>
            The Company processes the following categories of personal information:{'\n'}
            1. Required items: name, email, phone number, password{'\n'}
            2. Optional items: profile photo, date of birth{'\n'}
            3. Automatically collected items: IP address, cookies, service usage records, device information
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 4 (Provision of Personal Information to Third Parties)</Text>
          <Text style={styles.paragraph}>
            1. The Company processes the data subject's personal information only within the scope specified in Article 1 (Purpose of Processing Personal Information), and provides personal information to third parties only where permitted under Articles 17 and 18 of the Personal Information Protection Act, such as with the data subject's consent or under specific legal provisions.{'\n'}
            2. As a rule, the Company does not provide users' personal information to outside parties. However, the following are exceptions:{'\n'}
            - When the user has given prior consent{'\n'}
            - When required by law, or when an investigative agency requests it for investigative purposes in accordance with the procedures and methods prescribed by law
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 5 (Outsourcing of Personal Information Processing)</Text>
          <Text style={styles.paragraph}>
            1. To facilitate the smooth handling of personal information, the Company outsources personal information processing tasks as follows:{'\n'}
            - Cloud service provision: AWS (Amazon Web Services){'\n'}
            - Payment services: payment processor{'\n'}
            2. When entering into an outsourcing agreement, the Company, in accordance with Article 26 of the Personal Information Protection Act, specifies in the contract and other documents matters such as the prohibition of processing personal information for purposes other than performing the outsourced tasks, technical and administrative safeguards, restrictions on re-outsourcing, oversight of the contractor, and liability for damages, and supervises whether the contractor processes personal information safely.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 6 (Rights and Obligations of the Data Subject and How to Exercise Them)</Text>
          <Text style={styles.paragraph}>
            1. The data subject may exercise the following personal information protection rights against the Company at any time:{'\n'}
            - The right to request suspension of processing of personal information{'\n'}
            - The right to request access to personal information{'\n'}
            - The right to request correction or deletion of personal information{'\n'}
            - The right to request suspension of processing of personal information{'\n'}
            2. The rights under paragraph 1 may be exercised against the Company in writing, by email, or by fax, and the Company will act on such requests without delay.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 7 (Destruction of Personal Information)</Text>
          <Text style={styles.paragraph}>
            1. When personal information becomes unnecessary, such as upon expiration of the retention period or achievement of the processing purpose, the Company destroys the relevant personal information without delay.{'\n'}
            2. The procedures and methods for destroying personal information are as follows:{'\n'}
            - Destruction procedure: the Company identifies the personal information for which grounds for destruction have arisen and destroys it with the approval of the Company's Personal Information Protection Officer.{'\n'}
            - Destruction method: information in electronic file form is destroyed using technical methods that make the records unrecoverable.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Article 8 (Personal Information Protection Officer)</Text>
          <Text style={styles.paragraph}>
            The Company has overall responsibility for personal information processing and has designated a Personal Information Protection Officer as set out below to handle complaints and provide remedies for the data subject in relation to personal information processing:{'\n\n'}
            Personal Information Protection Officer{'\n'}
            - Name: Gildong Hong{'\n'}
            - Title: Head of Privacy Team{'\n'}
            - Contact: privacy@bloomdent.com, 02-1234-5678
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This policy is effective as of January 1, 2024.
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

