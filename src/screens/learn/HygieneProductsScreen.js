// src/screens/learn/HygieneProductsScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// 1) 마스터 목록 데이터: 각 용품 요약 + 상세 steps
const PRODUCTS = [
  {
    id: 'floss',
    title: 'Dental floss',
    icon: 'fiber-manual-record',
    // img 없음 (이미지 없이 카드/단계 모두 정상 표시)
    desc: 'Essential for removing plaque between teeth.',
    steps: [
      {
        id: '1',
        title: '1️⃣ Prepare — length and winding',
        // img 없음
        desc: 'Cut about 30–40 cm, wind it around the middle finger of each hand, and leave only 3–5 cm in between.',
        tip: 'Keeping it taut makes it easier to control.',
      },
      {
        id: '2',
        title: '2️⃣ Insert — gently between the teeth',
        // img 없음
        desc: 'Slowly ease it between the teeth at a nearly vertical angle, being careful not to jab the gums.',
        tip: 'Don\'t snap it in — ease it in with a gentle sawing motion.',
      },
      {
        id: '3',
        title: '3️⃣ Motion — C-shape rubbing',
        // img 없음
        desc: 'Wrap the side of the tooth in a C shape and rub up and down 5–10 times. Do both adjacent tooth surfaces.',
        tip: 'Slip just slightly below the gumline, only as far as is comfortable.',
      },
      {
        id: '4',
        title: '4️⃣ Finish — move to the next gap',
        // img 없음
        desc: 'Move to the next gap between teeth, using a clean section of floss.',
        tip: 'If bleeding is frequent, reduce the pressure; if it lasts more than a week, see a dentist.',
      },
    ],
  },
  {
    id: 'interdental',
    title: 'Interdental brush',
    icon: 'cleaning-services',
    img: 'https://images.unsplash.com/photo-1600423115367-5c7b3d5d7d3c?q=80&w=1080&auto=format&fit=crop',
    desc: 'Useful for wider gaps a regular toothbrush can\'t reach.',
    steps: [
      {
        id: '1',
        title: '1️⃣ Prepare — choose the size',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762182549/Screenshot_2025-11-04_at_12.08.50_AM_puhhjv.png',
        desc: 'Choose a thickness that fits into the gap without forcing.',
        tip: 'Too thick can damage the gums; too thin is less effective.',
      },
      {
        id: '2',
        title: '2️⃣ Insert — parallel to the gums',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762182425/Screenshot_2025-11-04_at_12.06.08_AM_uxk2pj.png',
        desc: 'Slowly insert between the teeth, keeping it parallel to the gums.',
        tip: 'Don\'t force it in.',
      },
      {
        id: '3',
        title: '3️⃣ Motion — back and forth',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762182420/Screenshot_2025-11-04_at_12.06.45_AM_r2zujs.png',
        desc: 'Gently move it back and forth 3–5 times to remove plaque.',
        tip: 'Avoid excessive repetition in a single gap.',
      },
      {
        id: '4',
        title: '4️⃣ Clean — sanitize/replace the brush',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762182480/Screenshot_2025-11-04_at_12.07.43_AM_khohsd.png',
        desc: 'After use, rinse with water and store in a dry place.',
        tip: 'Replace the brush once it bends.',
      },
    ],
  },
  {
    id: 'mouthwash',
    title: 'Mouthwash',
    icon: 'local-drink',
    img: 'https://images.unsplash.com/photo-1623855244082-8b4d5b38f3a1?q=80&w=1080&auto=format&fit=crop',
    desc: 'Helps curb bacteria and freshen breath.',
    steps: [
      {
        id: '1',
        title: '1️⃣ Prepare — check dilution/amount',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762184705/Screenshot_2025-11-04_at_12.43.05_AM_vos5u1.png',
        desc: 'Measure out 10–15 ml of mouthwash.',
        tip: 'If you prefer alcohol-free, check the ingredient list.',
      },
      {
        id: '2',
        title: '2️⃣ Rinse — 30 seconds to 1 minute',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762184696/Screenshot_2025-11-04_at_12.44.01_AM_v8rzjf.png',
        desc: 'Swish it around every corner of your mouth for 30 seconds to 1 minute.',
        tip: 'Be careful not to swallow.',
      },
      {
        id: '3',
        title: '3️⃣ Spit — don\'t over-rinse with water',
        desc: 'After spitting, rinse only lightly with water, or skip rinsing.',
        tip: 'Minimize rinsing right away so residual fluoride can keep working.',
      },
    ],
  },
  {
    id: 'electric-irrigator',
    title: 'Electric toothbrush / water flosser',
    icon: 'battery-charging-full',
    img: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=1080&auto=format&fit=crop',
    desc: 'Consistent vibration/jet helps remove plaque. Also useful with braces.',
    steps: [
      {
        id: '1',
        title: '1️⃣ Electric toothbrush — sensitive mode',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762187260/Screenshot_2025-11-04_at_1.27.02_AM_e8qyoz.png',
        desc: 'In sensitive/soft mode, tilt 45° to the gumline and hold on each tooth surface for 2–3 seconds.',
        tip: 'Don\'t press hard — let the head do the work.',
      },
      {
        id: '2',
        title: '2️⃣ Water flosser — set the pressure',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762185146/Gemini_Generated_Image_2bhpu82bhpu82bhp_svvgnq.png',
        desc: 'Start at low water pressure and raise it only as much as needed.',
        tip: 'If bleeding occurs, lower the pressure and adjust the angle.',
      },
      {
        id: '3',
        title: '3️⃣ Move along the line',
        img: 'https://res.cloudinary.com/dqutwk5xo/image/upload/v1762187305/Screenshot_2025-11-04_at_12.49.45_AM_lk6pid.png',
        desc: 'Move slowly along the gumline and around braces brackets and bridges.',
        tip: 'For gaps, change the angle and go over them twice.',
      },
    ],
  },
  {
    id: 'tongue',
    title: 'Tongue cleaner',
    icon: 'content-cut',
    img: 'https://images.unsplash.com/photo-1609840170477-7b9f7b7f6f6a?q=80&w=1080&auto=format&fit=crop',
    desc: 'Freshens breath by removing coating from the tongue.',
    steps: [
      {
        id: '1',
        title: '1️⃣ Prepare — get in position',
        img: 'https://images.unsplash.com/photo-1609840170477-7b9f7b7f6f6a?q=80&w=1080&auto=format&fit=crop',
        desc: 'Stick out your tongue and rest the cleaner lightly near the back.',
        tip: 'If you have a gag reflex, start a little further forward.',
      },
      {
        id: '2',
        title: '2️⃣ Scrape — back to front',
        img: 'https://images.unsplash.com/photo-1609840170477-7b9f7b7f6f6a?q=80&w=1080&auto=format&fit=crop',
        desc: 'Gently scrape 2–3 times to remove the coating.',
        tip: 'Don\'t press hard.',
      },
      {
        id: '3',
        title: '3️⃣ Clean — tool/rinse',
        img: 'https://images.unsplash.com/photo-1609840170477-7b9f7b7f6f6a?q=80&w=1080&auto=format&fit=crop',
        desc: 'Wash it with lukewarm water and rinse your mouth lightly with water.',
        tip: 'If your tongue is sore, allow more time between uses.',
      },
    ],
  },
];

// 2) 공통 카드 뷰
function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// 3) 디테일 헤더 (뒤로가기)
function DetailHeader({ title, icon, onBack }) {
  return (
    <View style={styles.detailHeader}>
      <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
        <Icon name="arrow-back" size={20} color="#0F172A" />
      </Pressable>
      <View style={styles.detailTitleContainer}>
        {icon && <Icon name={icon} size={20} color="#0F172A" style={styles.detailTitleIcon} />}
        <Text style={styles.detailTitle}>{title}</Text>
      </View>
      <View style={{ width: 24 }} />
    </View>
  );
}

// 4) 메인 컴포넌트: 목록 ↔ 디테일 전환
export default function HygieneProductsScreen() {
  const [selected, setSelected] = useState(null);
  const selectedProduct = useMemo(
    () => PRODUCTS.find(p => p.id === selected) || null,
    [selected]
  );

  // 목록 화면
  if (!selectedProduct) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {PRODUCTS.map(item => (
          <Pressable
            key={item.id}
            onPress={() => setSelected(item.id)}
            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Card>
              {/* 첫 페이지(목록)에서는 이미지 표시하지 않음 */}
              <View style={styles.titleRow}>
                <Icon name={item.icon} size={20} color="#1E3A8A" style={styles.titleIcon} />
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <Text style={styles.desc}>{item.desc}</Text>

              {item.tip && (
                <View style={styles.tipBox}>
                  <Icon name="info" size={16} color="#1E40AF" />
                  <Text style={styles.tip}>{item.tip}</Text>
                </View>
              )}

              <View style={styles.ctaRow}>
                <Text style={styles.ctaText}>View how to use</Text>
                <Icon name="chevron-right" size={20} color="#1E3A8A" />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  // 상세(단계) 화면
  return (
    <View style={{ flex: 1, backgroundColor: '#EFF6FF' }}>
      <DetailHeader title={selectedProduct.title} icon={selectedProduct.icon} onBack={() => setSelected(null)} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {selectedProduct.steps.map(s => {
          const stepNumber = parseInt(s.id);
          const titleWithoutEmoji = s.title.replace(/^[0-9]️⃣\s*/, '');
          return (
            <Card key={s.id} style={{ marginBottom: 14 }}>
              {!!s.img && <Image source={{ uri: s.img }} style={styles.img} />}
              <View style={styles.titleRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>{stepNumber}</Text>
                </View>
                <Text style={styles.title}>{titleWithoutEmoji}</Text>
              </View>
              <Text style={styles.desc}>{s.desc}</Text>
            {s.tip && (
              <View style={styles.tipBox}>
                <Icon name="info" size={16} color="#1E40AF" />
                <Text style={styles.tip}>{s.tip}</Text>
              </View>
            )}
          </Card>
          );
        })}
      </ScrollView>
    </View>
  );
} // ← ✅ 빠졌던 함수 닫는 중괄호 추가

// 5) 스타일
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
  titleIcon: { marginRight: 8 },
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

  ctaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: { fontSize: 13, color: '#1E3A8A', fontWeight: '700' },

  detailHeader: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  detailTitleIcon: { marginRight: 8 },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});
