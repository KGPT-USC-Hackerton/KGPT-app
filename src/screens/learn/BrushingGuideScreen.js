import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const STEPS = [
  {
    id: '1',
    stepNumber: 1,
    title: 'Prepare — soft toothbrush & fluoride toothpaste',
    img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762177575/Screenshot_2025-11-03_at_10.44.47_PM_u4wfrn.png',
    desc: 'Hold the toothbrush lightly like a pencil and use soft bristles. Use only a pea-sized amount of fluoride toothpaste!',
    tip: 'Don\'t scrub hard — the key is to keep the bristles gently in contact.',
  },
  {
    id: '2',
    stepNumber: 2,
    title: 'Angle — 45° at the gumline',
    img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762177606/45%EB%8F%84_lbhunb.jpg',
    desc: 'Tilt the bristles so they nestle slightly into the gumline, and use small vibrating motions.',
    tip: 'The gumline is where plaque builds up the most.',
  },
  {
    id: '3',
    stepNumber: 3,
    title: 'Motion — short vibrations + sweep upward',
    img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762180466/%EB%8F%99%EC%9E%91_jtkwoz.jpg',
    desc: 'Do at least 10 strokes per tooth, using small vibrations while sweeping toward the gums.',
  },
  {
    id: '4',
    stepNumber: 4,
    title: 'Inner surfaces — brush front teeth vertically',
    img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762177598/%EC%95%9E%EB%8B%88_api3hv.webp',
    desc: 'For the inner surfaces of the front teeth, stand the tip of the brush upright and brush vertically.',
  },
  {
    id: '5',
    stepNumber: 5,
    title: 'Finish — tongue, gums, and chewing surfaces',
    img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762177588/Screenshot_2025-11-03_at_10.45.53_PM_zswpuc.png',
    desc: 'Gently brush the surface of your tongue and the chewing surfaces, then rinse only lightly with water.',
    tip: 'Avoid rinsing vigorously so the fluoride can keep working.',
  },
];

export default function BrushingGuideScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {STEPS.map(s => (
        <View key={s.id} style={styles.card}>
          <Image source={{ uri: s.img }} style={styles.img} />
          <View style={styles.titleRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>{s.stepNumber}</Text>
            </View>
            <Text style={styles.title}>{s.title}</Text>
          </View>
          <Text style={styles.desc}>{s.desc}</Text>
          {s.tip && (
            <View style={styles.tipBox}>
              <Icon name="info" size={16} color="#1E40AF" />
              <Text style={styles.tip}>{s.tip}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#EFF6FF' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  img: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumber: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  desc: { color: '#374151', fontSize: 14, lineHeight: 22 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  tip: { fontSize: 13, color: '#1E40AF', fontWeight: '600' },
});
