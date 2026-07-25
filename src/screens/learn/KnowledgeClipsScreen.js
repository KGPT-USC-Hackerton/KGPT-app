import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Video from 'react-native-video';

const DATA = [
  { id: '1', title: 'How oral bacteria relate to disease', url: 'https://res.cloudinary.com/dqutwk5xo/video/upload/v1762187462/%EC%98%81%EC%83%811_ocbplz.mp4' },
  { id: '2', title: 'Salivary gland massage to prevent dry mouth in older adults',               url: 'https://res.cloudinary.com/dqutwk5xo/video/upload/v1762187832/%EC%98%81%EC%83%812_lzituo.mp4' },
  { id: '3', title: 'The right way to brush your teeth',             url: 'https://res.cloudinary.com/dqutwk5xo/video/upload/v1762187854/%EC%98%81%EC%83%814_kz9fwg.mp4' },
  { id: '4', title: 'Choosing and storing your toothbrush',               url: 'https://res.cloudinary.com/dqutwk5xo/video/upload/v1762187843/%EC%98%81%EC%83%813_wxbu5t.mp4' },
];

function ClipCard({ title, url, playing, isVertical }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.videoWrap}>
        <Video
          source={{ uri: url }}
          style={isVertical ? styles.videoVertical : styles.video}
          resizeMode="cover"
          paused={!playing}       // 보일 때만 재생
          muted                   // 자동재생을 위해 무음
          repeat
          controls={false}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
        />
      </View>
    </View>
  );
}

export default function KnowledgeClipsScreen() {
  const [visibleIds, setVisibleIds] = useState([]);

  // ✅ useRef로 핸들러 고정 (nullability 에러 방지)
  const onViewRef = useRef(({ viewableItems }) => {
    setVisibleIds(viewableItems.map(v => v.item.id));
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 80 });

  const renderItem = ({ item }) => {
    const playing = visibleIds.includes(item.id);
    const isVertical = item.id === '2'; // ✅ 2번째 영상만 세로형 (9:16)
    return <ClipCard title={item.title} url={item.url} playing={playing} isVertical={isVertical} />;
  };

  return (
    <FlatList
      data={DATA}
      keyExtractor={i => i.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      onViewableItemsChanged={onViewRef.current}
      viewabilityConfig={viewConfigRef.current}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, backgroundColor: '#F8FAFC' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  videoWrap: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#000' },
  // ✅ 기본 (가로형 16:9)
  video: { width: '100%', aspectRatio: 16 / 9 },
  // ✅ 2번만 세로형 (9:16)
  videoVertical: { width: '100%', aspectRatio: 9 / 16 },
});
