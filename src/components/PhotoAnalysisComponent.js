// src/components/PhotoAnalysisComponent.js
import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import uuid from 'react-native-uuid';
import RNFS from 'react-native-fs';

import {
  uploadImage,
  pollAnalysisStatus,
  deleteImage,
  pollHistoryAnalysisStatus,
} from '../services/imageService';
import { getUser } from '../utils/storage';
import CameraGuideComponent from './CameraGuideComponent';
import { classifyTeethRegion } from '../services/teethClassifierService';

const TOTAL_IMAGES = 3;
const POSITION_LABELS = {
  upper: 'Upper teeth',
  lower: 'Lower teeth',
  front: 'Front teeth',
  null: 'Not selected',
};

export default function PhotoAnalysisComponent({
  onReset,
  onSessionStateChange, // 🔹 부모에게 "촬영 세션 중인지" 알려주는 콜백
  onAnalysisComplete, // 🔹 3장 분석 완료 시 history_id 를 부모에 전달 (통합 플로우용)
}) {
  // 3장의 이미지 정보 배열
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickerError, setPickerError] = useState(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [currentCameraPosition, setCurrentCameraPosition] = useState(null);
  const [isPhotoSessionStarted, setIsPhotoSessionStarted] = useState(false);
  const [lastCapturedImageId, setLastCapturedImageId] = useState(null); // 마지막으로 촬영한 이미지의 uploadedImageId
  const [historyId, setHistoryId] = useState(null); // 동일 세션 묶음용 history_id

  const allImagesReady =
    images.length === TOTAL_IMAGES &&
    images.every(img => img && img.position && img.uploadedImageId);

  const imagesRef = useRef([]); // 최신 images 상태 추적용

  // images 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const resetState = useCallback(() => {
    setImages([]);
    setIsUploading(false);
    setIsAnalyzing(false);
    setUploadProgress(0);
    setPickerError(null);
    setIsPhotoSessionStarted(false);
    setLastCapturedImageId(null);
    setHistoryId(null); // 세션 초기화
    onSessionStateChange?.(false); // 🔹 부모에게 "촬영 세션 아님" 알리기
    onReset?.();
  }, [onReset, onSessionStateChange]);

  /**
   * 분석 결과를 UI 형식으로 변환
   */
  const formatAnalysisResult = useCallback(analysisData => {
    const analysis = analysisData.analysis;
    if (!analysis) return null;

    const issues = [];
    const recommendations = [];

    // 교합 상태
    if (analysis.occlusion?.status) {
      issues.push({
        type: analysis.occlusion.status === '정상' ? 'good' : 'warning',
        text: `Occlusion: ${analysis.occlusion.status}${
          analysis.occlusion.comment ? ` - ${analysis.occlusion.comment}` : ''
        }`,
      });
    }

    // 충치 감지
    if (analysis.cavity?.detected) {
      issues.push({
        type: 'warning',
        text: `Cavity detected${
          analysis.cavity.locations?.length > 0
            ? ` (location: ${analysis.cavity.locations.join(', ')})`
            : ''
        }${analysis.cavity.comment ? ` - ${analysis.cavity.comment}` : ''}`,
      });
    } else if (analysis.cavity?.detected === false) {
      issues.push({
        type: 'good',
        text: 'No cavities detected',
      });
    }

    // AI 신뢰도
    if (analysis.ai_confidence) {
      issues.push({
        type: 'info',
        text: `AI confidence: ${analysis.ai_confidence}%`,
      });
    }

    // 추천 사항
    if (analysis.recommendations) {
      const recs = analysis.recommendations.split('\n').filter(r => r.trim());
      recommendations.push(...recs);
    }

    return {
      score: analysis.overall_score
        ? Math.round(analysis.overall_score * 10)
        : null,
      issues,
      recommendations,
      rawAnalysis: analysis,
    };
  }, []);

  /**
   * 이미지 추가 및 즉시 업로드
   */
  const addImage = useCallback(
    async (asset, position) => {
      const imageId = Date.now();

      // 이미지 추가 (업로드 중 상태)
      setImages(prev => {
        const newImages = [...prev];
        newImages.push({
          id: imageId,
          asset,
          position,
          uploadedImageId: null,
          analysisResult: null,
          status: 'uploading',
          error: null,
        });
        return newImages;
      });
      setPickerError(null);

      // 즉시 업로드 시작
      try {
        const user = await getUser();
        const userId = user?.id || null;

        setImages(prev =>
          prev.map(i => (i.id === imageId ? { ...i, status: 'uploading' } : i)),
        );

        const uploadResponse = await uploadImage(
          asset,
          {
            user_id: userId,
            image_type: 'oral_care',
            position: position,
            history_id: historyId || null,
          },
          progress => {
            console.log(`이미지 ${imageId} 업로드 진행률: ${progress}%`);
          },
        );

        if (!uploadResponse.success || !uploadResponse.data?.image_id) {
          throw new Error(
            uploadResponse.message || 'Failed to upload image.',
          );
        }

        const uploadedImageId = uploadResponse.data.image_id;
        const newHistoryId = uploadResponse.data.history_id || historyId;

        setHistoryId(newHistoryId);

        setImages(prev =>
          prev.map(i =>
            i.id === imageId
              ? {
                  ...i,
                  uploadedImageId,
                  status: 'uploaded',
                  historyId: newHistoryId,
                }
              : i,
          ),
        );
      } catch (error) {
        console.error('이미지 업로드 오류:', error);

        let errorMessage = 'An error occurred while uploading the image.';
        if (error.status === 0) {
          errorMessage = 'Please check your network connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        setImages(prev =>
          prev.map(i =>
            i.id === imageId
              ? { ...i, status: 'failed', error: errorMessage }
              : i,
          ),
        );

        setPickerError(errorMessage);
      }
    },
    [historyId],
  );

  /**
   * 이미지 삭제 (로컬 상태, Cloudinary, DB 모두에서 삭제)
   */
  const removeImage = useCallback(
    async imageId => {
      const imageToRemove = images.find(img => img.id === imageId);

      if (!imageToRemove) {
        return;
      }

      if (imageToRemove.uploadedImageId) {
        try {
          await deleteImage(imageToRemove.uploadedImageId);
          console.log(
            '✅ 이미지 삭제 완료 (Cloudinary & DB):',
            imageToRemove.uploadedImageId,
          );
        } catch (error) {
          console.error('❌ 이미지 삭제 오류:', error);
        }
      }

      setImages(prev => prev.filter(img => img.id !== imageId));
    },
    [images],
  );

  /**
   * historyId 기반 분석 시작
   */
  const startAnalysis = useCallback(async () => {
    if (!allImagesReady) {
      Alert.alert(
        'Notice',
        'You need to upload photos of your upper teeth, lower teeth, and front teeth before analysis.',
      );
      return;
    }

    const imageHistoryIds = Array.from(
      new Set(images.map(img => img.historyId).filter(Boolean)),
    );
    const targetHistoryId = imageHistoryIds[0] || historyId;

    if (!targetHistoryId) {
      Alert.alert(
        'Notice',
        "Couldn't find the history_id for the current set. Please start over.",
      );
      return;
    }

    try {
      setIsAnalyzing(true);
      setIsUploading(false);
      setUploadProgress(0);
      setPickerError(null);

      const result = await pollHistoryAnalysisStatus(targetHistoryId, {
        interval: 2500,
        maxAttempts: 60,
        onStatusChange: (status, attempt) => {
          console.log(
            `[History ${targetHistoryId}] 분석 상태: ${status} (시도 ${attempt}회)`,
          );
          const progress =
            status === 'completed'
              ? 100
              : Math.min(50 + (attempt / 60) * 50, 99);
          setUploadProgress(progress);
        },
      });

      if (!result.success) {
        throw new Error(result.message || 'Unable to retrieve analysis results.');
      }

      setIsAnalyzing(false);
      setUploadProgress(100);

      // 통합 플로우: 부모가 콜백을 주면 history_id 를 넘기고 다음 단계로 진행.
      if (onAnalysisComplete) {
        onAnalysisComplete(targetHistoryId);
        return;
      }

      Alert.alert('Analysis complete', 'All 3 oral photos have been analyzed.', [
        {
          text: 'OK',
          onPress: () => {
            resetState();
          },
        },
      ]);
    } catch (error) {
      console.error('분석 폴링 오류:', error);
      setIsAnalyzing(false);
      setUploadProgress(0);

      let errorMessage = 'An error occurred during analysis.';

      if (error.status === 0) {
        errorMessage =
          'Please check your network connection. Make sure the backend server is running.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setPickerError(errorMessage);
      Alert.alert('Error', errorMessage);
    }
  }, [allImagesReady, images, historyId, resetState, onAnalysisComplete]);

  /**
   * (fallback) 업로드된 개별 이미지들 분석
   */
  const startAnalysisForUploadedImages = useCallback(
    async uploadedImages => {
      try {
        const pollPromises = uploadedImages.map(img => {
          setImages(prev =>
            prev.map(i =>
              i.id === img.id ? { ...i, status: 'analyzing' } : i,
            ),
          );

          return pollAnalysisStatus(img.uploadedImageId, {
            interval: 2500,
            maxAttempts: 60,
            onStatusChange: (status, attemptCount) => {
              console.log(
                `이미지 ${img.id} 분석 상태: ${status} (시도 ${attemptCount}회)`,
              );
              const completedCount = images.filter(
                i => i.status === 'completed',
              ).length;
              const progress =
                ((completedCount + 1) / uploadedImages.length) * 100;
              setUploadProgress(Math.min(progress, 100));
            },
          })
            .then(statusResponse => {
              if (statusResponse.success && statusResponse.data?.analysis) {
                const formattedResult = formatAnalysisResult(
                  statusResponse.data,
                );
                setImages(prev =>
                  prev.map(i =>
                    i.id === img.id
                      ? {
                          ...i,
                          analysisResult: formattedResult,
                          status: 'completed',
                        }
                      : i,
                  ),
                );

                const completedCount =
                  images.filter(i => i.status === 'completed').length + 1;
                const progress = (completedCount / uploadedImages.length) * 100;
                setUploadProgress(Math.min(progress, 100));

                return { imageId: img.id, result: formattedResult };
              } else {
                throw new Error(
                  statusResponse.message || 'Unable to retrieve analysis results.',
                );
              }
            })
            .catch(error => {
              setImages(prev =>
                prev.map(i =>
                  i.id === img.id
                    ? {
                        ...i,
                        status: 'failed',
                        error: error.message || 'Analysis failed',
                      }
                    : i,
                ),
              );
              throw error;
            });
        });

        await Promise.allSettled(pollPromises);

        setUploadProgress(100);
        setIsAnalyzing(false);

        const finalImages = imagesRef.current;
        const allCompleted = uploadedImages.every(img => {
          const currentImg = images.find(i => i.id === img.id);
          return (
            currentImg?.status === 'completed' ||
            currentImg?.status === 'failed'
          );
        });

        if (allCompleted) {
          const failedCount = uploadedImages.filter(img => {
            const currentImg = finalImages.find(i => i.id === img.id);
            return currentImg?.status === 'failed';
          }).length;

          if (failedCount > 0) {
            Alert.alert(
              'Analysis complete',
              `${
                uploadedImages.length - failedCount
              } photo(s) analyzed successfully. ${failedCount} photo(s) failed to analyze.`,
            );
          } else {
            Alert.alert('Analysis complete', 'All images have been analyzed.');
          }
        }
      } catch (error) {
        console.error('분석 오류:', error);
        setIsAnalyzing(false);
        setUploadProgress(0);

        let errorMessage = 'An error occurred during analysis.';

        if (error.status === 0) {
          errorMessage =
            'Please check your network connection. Make sure the backend server is running.';
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.status === 500) {
          errorMessage =
            'A server error occurred. Please check the backend server logs.';
        }

        setPickerError(errorMessage);
      }
    },
    [formatAnalysisResult],
  );

  /**
   * 앨범/카메라에서 선택된 asset 처리
   */
  const runPositionCheckAndAdd = useCallback(
    async (asset, position) => {
      let workingAsset = asset;

      try {
        if (!workingAsset?.base64 && workingAsset?.uri) {
          const path = workingAsset.uri.replace('file://', '');
          const base64 = await RNFS.readFile(path, 'base64');
          workingAsset = { ...workingAsset, base64 };
          console.log(
            '[PhotoAnalysis] base64 생성 완료, length:',
            base64.length,
          );
        }
      } catch (fsErr) {
        console.warn('base64 생성 실패 (사진은 그대로 사용):', fsErr);
      }

      if (workingAsset?.base64) {
        try {
          const { top1 } = await classifyTeethRegion(workingAsset.base64);
          console.log(
            '[Teeth AI] 예측 포지션:',
            top1.label,
            'score:',
            top1.score,
            '사용자 선택:',
            position,
          );

          if (top1.label !== position) {
            console.log(
              '[Teeth AI] 사용자 선택 위치와 AI 예측 위치가 다릅니다. ' +
                `(user=${position}, ai=${top1.label})`,
            );
          }
        } catch (aiErr) {
          console.warn(
            '[Teeth AI] 위치 분석 실패 (사진은 그대로 사용):',
            aiErr,
          );
        }
      } else {
        console.warn(
          '[PhotoAnalysis] base64 없음 - AI 위치 분석은 건너뛰고 사진만 업로드합니다.',
        );
      }

      try {
        await addImage(workingAsset, position);
      } catch (uploadErr) {
        console.error('이미지 업로드 오류:', uploadErr);
        Alert.alert(
          'Error',
          'A problem occurred while uploading the image. Please try again in a moment.',
        );
      }
    },
    [addImage],
  );

  const handlePickerResult = useCallback(
    async (response, position) => {
      if (!response || response.didCancel) {
        return;
      }

      if (response.errorCode) {
        setPickerError(
          response.errorMessage ||
            'A problem occurred while loading the photo. Please try again.',
        );
        return;
      }

      const asset = response.assets?.[0];

      if (!asset?.uri) {
        setPickerError('Unable to determine the path of the selected photo.');
        return;
      }

      await runPositionCheckAndAdd(asset, position);
    },
    [runPositionCheckAndAdd],
  );

  const handleLaunch = useCallback(
    async (type, position) => {
      if (type === 'camera') {
        setCurrentCameraPosition(position);
        setCameraModalVisible(true);
      } else {
        const options = {
          mediaType: 'photo',
          quality: 0.8,
          includeBase64: true,
        };

        try {
          const response = await launchImageLibrary(options);
          handlePickerResult(response, position);
        } catch (error) {
          console.error('launchImageLibrary error:', error);
          setPickerError(
            'An error occurred while loading the photo. Please try again.',
          );
        }
      }
    },
    [handlePickerResult],
  );

  const handleCameraCapture = useCallback(
    async asset => {
      setCameraModalVisible(false);
      if (asset && currentCameraPosition) {
        const imageId = Date.now();
        setLastCapturedImageId(imageId);
        await runPositionCheckAndAdd(asset, currentCameraPosition);
      }
      setCurrentCameraPosition(null);
    },
    [currentCameraPosition, runPositionCheckAndAdd],
  );

  const handleCameraClose = useCallback(async () => {
    if (lastCapturedImageId) {
      let attempts = 0;
      const maxAttempts = 20; // 0.25초 간격 * 20 = 5초

      const checkAndDelete = async () => {
        const lastImage = imagesRef.current.find(
          img => img.id === lastCapturedImageId,
        );

        if (lastImage && lastImage.uploadedImageId) {
          try {
            await deleteImage(lastImage.uploadedImageId);
            console.log(
              '✅ 이미지 삭제 완료 (Cloudinary & DB):',
              lastImage.uploadedImageId,
            );
            setImages(prev =>
              prev.filter(img => img.id !== lastCapturedImageId),
            );
          } catch (error) {
            console.error('❌ 이미지 삭제 오류:', error);
            setImages(prev =>
              prev.filter(img => img.id !== lastCapturedImageId),
            );
          }
          setLastCapturedImageId(null);
          return true;
        } else if (lastImage && lastImage.status === 'failed') {
          setImages(prev => prev.filter(img => img.id !== lastCapturedImageId));
          setLastCapturedImageId(null);
          return true;
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkAndDelete, 250);
          return false;
        } else {
          console.warn(
            '⚠️ 이미지 업로드 완료 대기 시간 초과 - 로컬에서만 제거',
          );
          setImages(prev => prev.filter(img => img.id !== lastCapturedImageId));
          setLastCapturedImageId(null);
          return true;
        }
      };

      await checkAndDelete();
    }

    setCameraModalVisible(false);
    setCurrentCameraPosition(null);
  }, [lastCapturedImageId]);

  const handleAddPhoto = useCallback(
    position => {
      if (images.length >= TOTAL_IMAGES) {
        Alert.alert(
          'Notice',
          `You can take up to ${TOTAL_IMAGES} photos.`,
        );
        return;
      }

      const existingImage = images.find(img => img.position === position);
      if (existingImage) {
        Alert.alert('Notice', 'A photo for this position already exists.');
        return;
      }

      Alert.alert(
        'Select photo',
        `Take a photo of your ${POSITION_LABELS[position]} or choose one from your album.`,
        [
          {
            text: 'Take a photo',
            onPress: () => handleLaunch('camera', position),
          },
          {
            text: 'Choose from album',
            onPress: () => handleLaunch('library', position),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [images, handleLaunch],
  );

  const allUploaded =
    images.length === TOTAL_IMAGES &&
    images.every(
      img =>
        img.status === 'uploaded' ||
        img.status === 'analyzing' ||
        img.status === 'completed' ||
        img.status === 'failed',
    );
  const hasResults = images.some(img => img.analysisResult);
  const allCompleted =
    images.length === TOTAL_IMAGES &&
    images.every(img => img.status === 'completed' || img.status === 'failed');

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 진행 상황 표시 */}
          {isAnalyzing && (
            <View style={styles.progressSection}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${uploadProgress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                Analyzing... {uploadProgress.toFixed(0)}%
              </Text>
            </View>
          )}

          {/* 구강사진 촬영 시작 카드 */}
          {!allCompleted && !isPhotoSessionStarted && images.length === 0 && (
            <View style={styles.startCard}>
              <View style={styles.startCardContent}>
                <Text style={styles.startCardTitle}>Oral photo capture</Text>
                <Text style={styles.startCardSubtitle}>
                  Take photos of your upper, lower, and front teeth{'\n'}to get an AI analysis
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setHistoryId(uuid.v4());
                    setIsPhotoSessionStarted(true);
                    onSessionStateChange?.(true); // 🔹 부모에게 "촬영 세션 시작" 알리기
                  }}
                  style={styles.startButton}
                >
                  <Text style={styles.startButtonText}>Start capturing</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 이미지 촬영 섹션 */}
          {!allCompleted && (isPhotoSessionStarted || images.length > 0) && (
            <View style={styles.photoSection}>
              <View style={styles.sectionHeader}>
                {images.length === 0 && (
                  <TouchableOpacity
                    onPress={resetState}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Oral photo capture</Text>
                  <Text style={styles.sectionSubtitle}>
                    Take a photo for each position ({images.length}/
                    {TOTAL_IMAGES})
                  </Text>
                </View>
              </View>

              <View style={styles.positionButtons}>
                {['upper', 'lower', 'front'].map(position => {
                  const image = images.find(img => img.position === position);
                  const isTaken = !!image;

                  return (
                    <View key={position} style={styles.positionButtonContainer}>
                      {isTaken ? (
                        <View style={styles.photoCard}>
                          <Image
                            source={{ uri: image.asset.uri }}
                            style={styles.photoCardImage}
                          />
                          <View style={styles.photoCardOverlay}>
                            <Text style={styles.photoCardLabel}>
                              {POSITION_LABELS[position]}
                            </Text>
                            {image.status === 'uploading' && (
                              <>
                                <ActivityIndicator
                                  size="small"
                                  color="white"
                                  style={styles.photoCardStatus}
                                />
                                <Text style={styles.photoCardStatusText}>
                                  Uploading...
                                </Text>
                              </>
                            )}
                            {image.status === 'uploaded' && (
                              <Text style={styles.photoCardCheck}>
                                ✓ Uploaded
                              </Text>
                            )}
                            {image.status === 'analyzing' && (
                              <>
                                <ActivityIndicator
                                  size="small"
                                  color="#3b82f6"
                                  style={styles.photoCardStatus}
                                />
                                <Text style={styles.photoCardStatusText}>
                                  Analyzing...
                                </Text>
                              </>
                            )}
                            {image.status === 'completed' && (
                              <Text style={styles.photoCardCheck}>
                                ✓ Analyzed
                              </Text>
                            )}
                            {image.status === 'failed' && (
                              <Text style={styles.photoCardError}>
                                ✕ {image.error || 'Failed'}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => removeImage(image.id)}
                            style={styles.photoCardRemoveButton}
                            disabled={isUploading || isAnalyzing}
                          >
                            <Text style={styles.photoCardRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleAddPhoto(position)}
                          style={[
                            styles.positionButton,
                            (isUploading || isAnalyzing) &&
                              styles.positionButtonDisabled,
                          ]}
                          disabled={isUploading || isAnalyzing}
                        >
                          <View style={styles.positionButtonIcon}>
                            <Text style={styles.positionButtonIconText}>
                              📷
                            </Text>
                          </View>
                          <Text style={styles.positionButtonText}>
                            {POSITION_LABELS[position]}
                          </Text>
                          <Text style={styles.positionButtonSubtext}>
                            Take a photo
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 분석 시작 버튼 */}
          {allImagesReady && !isUploading && !isAnalyzing && !allCompleted && (
            <TouchableOpacity
              onPress={startAnalysis}
              style={styles.startAnalysisButton}
            >
              <Text style={styles.startAnalysisButtonText}>🔍 Analyze</Text>
            </TouchableOpacity>
          )}

          {/* 분석 중 표시 */}
          {isAnalyzing && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Analyzing...</Text>
              <Text style={styles.loadingSubtext}>
                {uploadProgress.toFixed(0)}% complete
              </Text>
            </View>
          )}

          {/* 분석 결과 표시 */}
          {allCompleted && hasResults && (
            <View style={styles.resultsSection}>
              <Text style={styles.resultsTitle}>Analysis results</Text>

              {/* 전체 요약 */}
              {images.length === TOTAL_IMAGES &&
                images.every(img => img.analysisResult) && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Overall summary</Text>
                    <View style={styles.summaryScores}>
                      {images.map(img => {
                        const result = img.analysisResult;
                        if (!result || result.score === null) return null;
                        return (
                          <View key={img.id} style={styles.summaryScoreItem}>
                            <Text style={styles.summaryScoreLabel}>
                              {POSITION_LABELS[img.position]}
                            </Text>
                            <Text style={styles.summaryScoreValue}>
                              {result.score}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.summaryAverage}>
                      {(() => {
                        const scores = images
                          .map(img => img.analysisResult?.score)
                          .filter(score => score !== null);
                        const average =
                          scores.length > 0
                            ? Math.round(
                                scores.reduce((a, b) => a + b, 0) /
                                  scores.length,
                              )
                            : null;
                        return average !== null ? (
                          <>
                            <Text style={styles.summaryAverageLabel}>
                              Average score
                            </Text>
                            <Text style={styles.summaryAverageValue}>
                              {average}
                            </Text>
                          </>
                        ) : null;
                      })()}
                    </View>
                  </View>
                )}

              {/* 개별 결과 */}
              {images.map((img, index) => {
                if (!img.analysisResult) return null;

                const result = img.analysisResult;
                return (
                  <View key={img.id} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Image
                        source={{ uri: img.asset.uri }}
                        style={styles.resultThumbnail}
                      />
                      <View style={styles.resultHeaderText}>
                        <Text style={styles.resultPosition}>
                          Photo {index + 1} -{' '}
                          {POSITION_LABELS[img.position] || 'Not selected'}
                        </Text>
                        {result.score !== null && (
                          <Text style={styles.resultScore}>
                            Score: {result.score}
                          </Text>
                        )}
                      </View>
                    </View>

                    {result.issues && result.issues.length > 0 && (
                      <View style={styles.issuesSection}>
                        {result.issues.map((issue, issueIndex) => (
                          <View key={issueIndex} style={styles.issueItem}>
                            <Text style={styles.issueIcon}>
                              {issue.type === 'good'
                                ? '✅'
                                : issue.type === 'warning'
                                ? '⚠️'
                                : 'ℹ️'}
                            </Text>
                            <Text style={styles.issueText}>{issue.text}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {result.recommendations &&
                      result.recommendations.length > 0 && (
                        <View style={styles.recommendationsSection}>
                          <Text style={styles.recommendationsTitle}>
                            Recommendations
                          </Text>
                          {result.recommendations.map((rec, recIndex) => (
                            <View
                              key={recIndex}
                              style={styles.recommendationItem}
                            >
                              <Text style={styles.bullet}>•</Text>
                              <Text style={styles.recommendationText}>
                                {rec}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                  </View>
                );
              })}
            </View>
          )}

          {/* 에러 메시지 */}
          {pickerError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{pickerError}</Text>
            </View>
          )}

          {/* 다시 시작 버튼 */}
          {allCompleted && (
            <TouchableOpacity onPress={resetState} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Analyze again</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* 카메라 가이드라인 모달 */}
      <Modal
        visible={cameraModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCameraClose}
      >
        {currentCameraPosition && (
          <CameraGuideComponent
            position={currentCameraPosition}
            onCapture={handleCameraCapture}
            onClose={handleCameraClose}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    flex: 1,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  progressSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginTop: 8,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  startCard: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  startCardContent: {
    padding: 32,
    alignItems: 'center',
  },
  startCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  startCardSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  photoSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  positionButtons: {
    gap: 16,
  },
  positionButtonContainer: {
    marginBottom: 12,
  },
  positionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  positionButtonDisabled: {
    opacity: 0.5,
  },
  positionButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  positionButtonIconText: {
    fontSize: 32,
  },
  positionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  positionButtonSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  photoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  photoCardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f3f4f6',
  },
  photoCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoCardLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  photoCardStatus: {
    marginLeft: 8,
  },
  photoCardStatusText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  photoCardCheck: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
  },
  photoCardError: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  photoCardRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCardRemoveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  startAnalysisButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startAnalysisButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingSection: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#3b82f6',
    marginTop: 12,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  resultThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  resultHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  resultPosition: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  resultScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
  },
  issuesSection: {
    marginTop: 12,
    gap: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
  },
  issueIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  issueText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  recommendationsSection: {
    marginTop: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bullet: {
    color: '#3b82f6',
    marginRight: 8,
  },
  recommendationText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  resetButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryScores: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryScoreItem: {
    alignItems: 'center',
  },
  summaryScoreLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  summaryScoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3b82f6',
  },
  summaryAverage: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
  },
  summaryAverageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 12,
  },
  summaryAverageValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563eb',
  },
});
