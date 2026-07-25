// src/screens/learn/components/TopTabsChips.js
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export const TABS = [
  { key: 'BrushingGuide',   label: 'Brushing Guide' },
  { key: 'HygieneProducts', label: 'Hygiene Products' },
  { key: 'KnowledgeClips',  label: 'Dental Tips' },
];

export default function TopTabsChips({ active, onChange = () => {} }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map(t => {
        const isActive = active === t.key;
        return (
          <Pressable
            key={t.key}
            style={[styles.tabItem]}
            onPress={() => onChange(t.key)}
          >
            <View style={[styles.tabButton, isActive && styles.tabButtonActive]}>
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {t.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabItem: {
    flex: 1,
  },
  tabButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
});
