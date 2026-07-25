import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import { fetchImageAnalysisHistories } from '../services/imageAnalysisHistoryService';

const POSITION_LABELS = {
  upper: 'Upper teeth',
  lower: 'Lower teeth',
  front: 'Front teeth',
};

function parseCavityText(cavityLocations) {
  if (!cavityLocations) {
    return 'No cavity information available.';
  }

  let locationsArray = cavityLocations;
  if (typeof cavityLocations === 'string') {
    try {
      locationsArray = JSON.parse(cavityLocations);
    } catch (e) {
      console.warn('cavity_locations JSON 파싱 실패:', e);
      return 'An error occurred while parsing cavity information.';
    }
  }

  if (!Array.isArray(locationsArray) || locationsArray.length === 0) {
    return 'No cavities were found.';
  }

  const parts = locationsArray.map(loc => {
    const tooth = loc.tooth_number ?? loc.tooth ?? '?';
    const conf =
      typeof loc.confidence === 'number'
        ? Math.round(loc.confidence * 100)
        : null;
    return conf != null ? `Tooth ${tooth} (${conf}%)` : `Tooth ${tooth}`;
  });

  return `Possible cavities on ${parts.join(', ')}.`;
}

export default function ImageAnalysisHistoryComponent({ refreshKey }) {
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);

  const loadHistories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchImageAnalysisHistories();
      setHistories(data);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistories();
  }, [refreshKey]);

  const renderItem = ({ item }) => {
    const date = new Date(item.created_at);
    const dateLabel = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedHistory(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{dateLabel}</Text>
          <Text style={styles.cardTag}>Oral photo analysis</Text>
        </View>
        <Text style={styles.cardSummary} numberOfLines={2}>
          {item.llm_summary || 'No AI analysis summary available.'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Oral photo analysis history</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading records...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && histories.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            No oral photo analysis history yet.
          </Text>
        </View>
      )}

      {!loading && histories.length > 0 && (
        <FlatList
          data={histories}
          keyExtractor={item => item.history_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* 상세 모달 */}
      <Modal
        visible={!!selectedHistory}
        animationType="slide"
        onRequestClose={() => setSelectedHistory(null)}
      >
        {selectedHistory && (
          <ScrollView style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Oral photo analysis details</Text>
            <Text style={styles.modalSummary}>
              {selectedHistory.llm_summary || 'No summary available.'}
            </Text>

            {['upper', 'lower', 'front'].map(type => {
              const img = selectedHistory.images[type];
              if (!img) return null;

              return (
                <View key={type} style={styles.block}>
                  <Text style={styles.blockTitle}>
                    {POSITION_LABELS[type] || type}
                  </Text>
                  {img.analyzed_image_url && (
                    <Image
                      source={{ uri: img.analyzed_image_url }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.cavityText}>
                    {parseCavityText(img.cavity_locations)}
                  </Text>
                  {img.occlusion_comment && (
                    <Text style={styles.occlusionText}>
                      {img.occlusion_comment}
                    </Text>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedHistory(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  errorText: {
    color: '#dc2626',
  },
  emptyText: {
    color: '#6b7280',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardTag: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  cardSummary: {
    fontSize: 14,
    color: '#111827',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalSummary: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 20,
  },
  block: {
    marginBottom: 24,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3, // 화면 비율에 맞게
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  cavityText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  occlusionText: {
    fontSize: 13,
    color: '#dc2626',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
