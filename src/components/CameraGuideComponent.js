import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image, // ✅ 실제 원본 크기 계산용
  Animated,
} from 'react-native';

import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { detectLips } from '../services/lipDetectionService';

// ✅ 안전하게 ImageManipulator import (네이티브 모듈이 없을 수 있음)
let ImageManipulator = null;
try {
  ImageManipulator = require('react-native-image-manipulator').default;
} catch (error) {
  console.warn('⚠️ react-native-image-manipulator를 불러올 수 없습니다:', error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const POSITION_LABELS = {
  upper: 'Upper teeth',
  lower: 'Lower teeth',
  front: 'Front teeth',
};

// ✅ 실제 이미지 크기 가져오기 (ImageManipulator가 사용하는 원본 기준)
const getRealImageSize = uri =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      error => reject(error),
    );
  });

export default function CameraGuideComponent({ position, onCapture, onClose }) {
  const camera = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraType, setCameraType] = useState('front');
  const device = useCameraDevice(cameraType);
  const insets = useSafeAreaInsets();

  const [lipPoints, setLipPoints] = useState([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [guideVerticalPosition, setGuideVerticalPosition] = useState('center'); // 'top', 'center', 'bottom'
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const detectionIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastPhotoRef = useRef(null);
  const autoCaptureTriggeredRef = useRef(false);
  const alignmentTimerRef = useRef(null);

  const checkPermission = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Camera permission required',
          'Camera access is required to take oral photos.',
          [{ text: 'OK', onPress: onClose }],
        );
      }
    }
  }, [hasPermission, requestPermission, onClose]);

  useEffect(() => {
    checkPermission();
    return () => {
      if (detectionIntervalRef.current)
        clearInterval(detectionIntervalRef.current);
      if (alignmentTimerRef.current) clearTimeout(alignmentTimerRef.current);
    };
  }, [checkPermission]);

  // 가이드라인 정렬 체크
  const checkAlignment = useCallback(
    (points, pos) => {
      if (!points || points.length === 0) return false;

      // 뒤집힌 상태면 Y 좌표를 뒤집기
      const adjustedPoints = isFlipped
        ? points.map(p => ({ x: p.x, y: SCREEN_HEIGHT - p.y }))
        : points;

      const guideStyle = getGuideStyle(pos, guideVerticalPosition);
      // 뒤집힌 상태면 가이드라인 Y 위치도 뒤집기
      const guideY = isFlipped
        ? SCREEN_HEIGHT - guideStyle.top - guideStyle.height
        : guideStyle.top;

      const guideBounds = {
        x: guideStyle.left,
        y: guideY,
        width: guideStyle.width,
        height: guideStyle.height,
      };

      const lipMinX = Math.min(...adjustedPoints.map(p => p.x));
      const lipMaxX = Math.max(...adjustedPoints.map(p => p.x));
      const lipMinY = Math.min(...adjustedPoints.map(p => p.y));
      const lipMaxY = Math.max(...adjustedPoints.map(p => p.y));
      const lipWidth = lipMaxX - lipMinX;
      const lipHeight = lipMaxY - lipMinY;
      const lipArea = lipWidth * lipHeight;

      const lipCenterX = (lipMinX + lipMaxX) / 2;
      const lipCenterY = (lipMinY + lipMaxY) / 2;

      const guideCenterX = guideBounds.x + guideBounds.width / 2;
      const guideCenterY = guideBounds.y + guideBounds.height / 2;

      const overlapMinX = Math.max(lipMinX, guideBounds.x);
      const overlapMaxX = Math.min(lipMaxX, guideBounds.x + guideBounds.width);
      const overlapMinY = Math.max(lipMinY, guideBounds.y);
      const overlapMaxY = Math.min(lipMaxY, guideBounds.y + guideBounds.height);

      const overlapWidth = Math.max(0, overlapMaxX - overlapMinX);
      const overlapHeight = Math.max(0, overlapMaxY - overlapMinY);
      const overlapArea = overlapWidth * overlapHeight;

      const guideArea = guideBounds.width * guideBounds.height;
      const unionArea = lipArea + guideArea - overlapArea;
      const overlapRatio = unionArea > 0 ? overlapArea / unionArea : 0;
      const lipOverlapRatio = lipArea > 0 ? overlapArea / lipArea : 0;
      const guideOverlapRatio = guideArea > 0 ? overlapArea / guideArea : 0;

      const centerDistanceX =
        Math.abs(lipCenterX - guideCenterX) / guideBounds.width;
      const centerDistanceY =
        Math.abs(lipCenterY - guideCenterY) / guideBounds.height;
      const normalizedCenterDistance = Math.sqrt(
        centerDistanceX * centerDistanceX + centerDistanceY * centerDistanceY,
      );

      const isOptimalAlignment =
        overlapRatio >= 0.4 &&
        lipOverlapRatio >= 0.5 &&
        guideOverlapRatio >= 0.5 &&
        normalizedCenterDistance <= 0.3;

      if (isOptimalAlignment) {
        console.log('🎯 최적 겹침 조건:', {
          overlapRatio: (overlapRatio * 100).toFixed(1) + '%',
          lipOverlapRatio: (lipOverlapRatio * 100).toFixed(1) + '%',
          guideOverlapRatio: (guideOverlapRatio * 100).toFixed(1) + '%',
          centerDistance: (normalizedCenterDistance * 100).toFixed(1) + '%',
        });
      }

      return isOptimalAlignment;
    },
    [guideVerticalPosition, isFlipped],
  );

  // 플래시 효과
  const triggerFlash = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
  }, []);

  // ✅ 입술 영역 크롭 (crop rectangle 완전 방어)
  const cropLipArea = useCallback(
    async (photoPath, rawWidth, rawHeight) => {
      try {
        // ImageManipulator 모듈 체크
        if (!ImageManipulator) {
          console.warn('⚠️ ImageManipulator 모듈이 없습니다 - 원본 반환');
          return photoPath;
        }

        if (typeof ImageManipulator.manipulate !== 'function') {
          console.warn('⚠️ ImageManipulator.manipulate 함수가 없습니다 - 원본 반환');
          return photoPath;
        }

        let imageWidth = rawWidth;
        let imageHeight = rawHeight;

        // 실제 원본 크기 우선 사용
        try {
          const realSize = await getRealImageSize(photoPath);
          imageWidth = realSize.width;
          imageHeight = realSize.height;
        } catch (e) {
          console.warn(
            '⚠️ Image.getSize 실패, VisionCamera width/height 사용',
            e?.message,
          );
        }

        if (!imageWidth || !imageHeight) {
          console.warn('⚠️ 이미지 크기 알 수 없음 - 원본 반환');
          return photoPath;
        }

        const result = await detectLips(photoPath);
        let cropX;
        let cropY;
        let cropWidth;
        let cropHeight;
        let useLipDetection = false;

        if (
          result.success &&
          result.data?.faceDetected &&
          Array.isArray(result.data.lipPoints) &&
          result.data.lipPoints.length > 0
        ) {
          // 입술 검출 성공 - 입술 영역 기준으로 크롭
          const detectedLipPoints = result.data.lipPoints;
          const detectedImageWidth = result.data.width || imageWidth;
          const detectedImageHeight = result.data.height || imageHeight;

          const scaleX = imageWidth / detectedImageWidth;
          const scaleY = imageHeight / detectedImageHeight;

          const scaledLipPoints = detectedLipPoints.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY,
          }));

          const xs = scaledLipPoints.map(p => p.x);
          const ys = scaledLipPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          if (
            !isFinite(minX) ||
            !isFinite(maxX) ||
            !isFinite(minY) ||
            !isFinite(maxY)
          ) {
            console.warn('⚠️ 입술 좌표 이상 - 가이드라인 기준으로 크롭');
            // 입술 좌표가 이상하면 가이드라인 기준으로 크롭하도록 fallback
            useLipDetection = false;
          } else {
            const lipWidth = maxX - minX;
            const lipHeight = maxY - minY;
            const lipCenterX = (minX + maxX) / 2;
            const lipCenterY = (minY + maxY) / 2;

            // 가로/세로 여유 공간을 다르게 설정 (세로는 더 작게)
            const paddingRatioX = 0.2; // 가로 여유 공간 20%
            const paddingRatioY = 0.1; // 세로 여유 공간 10% (더 타이트하게)
            const paddingX = lipWidth * paddingRatioX;
            const paddingY = lipHeight * paddingRatioY;
            const minCropSize = 80;

            const desiredCropWidth = Math.max(
              lipWidth + 2 * paddingX,
              minCropSize,
            );
            const desiredCropHeight = Math.max(
              lipHeight + 2 * paddingY,
              minCropSize,
            );

            cropX = lipCenterX - desiredCropWidth / 2;
            cropY = lipCenterY - desiredCropHeight / 2;
            cropWidth = desiredCropWidth;
            cropHeight = desiredCropHeight;
            useLipDetection = true;
          }
        }

        // 입술 검출 실패 또는 좌표 이상 시 가이드라인 위치 기준으로 크롭
        if (
          !useLipDetection ||
          cropX === undefined ||
          cropY === undefined ||
          cropWidth === undefined ||
          cropHeight === undefined
        ) {
          console.log(
            '📐 입술 검출 실패 또는 변수 미정의 - 가이드라인 위치 기준으로 크롭',
          );

          // 가이드라인 스타일 가져오기 (화면 좌표 기준)
          const guideStyle = getGuideStyle(position, guideVerticalPosition);

          // 화면 좌표를 이미지 좌표로 변환
          const screenToImageScaleX = imageWidth / SCREEN_WIDTH;
          const screenToImageScaleY = imageHeight / SCREEN_HEIGHT;

          // 가이드라인 영역을 이미지 좌표로 변환
          let guideImageX = guideStyle.left * screenToImageScaleX;
          let guideImageY = guideStyle.top * screenToImageScaleY;
          const guideImageWidth = guideStyle.width * screenToImageScaleX;
          const guideImageHeight = guideStyle.height * screenToImageScaleY;

          // 뒤집힌 상태면 Y 좌표를 뒤집기
          if (isFlipped) {
            guideImageY = imageHeight - guideImageY - guideImageHeight;
          }

          // 여유 공간 추가 (가이드라인보다 조금 더 크게)
          const paddingRatio = 0.3; // 30% 여유 공간
          const paddingX = guideImageWidth * paddingRatio;
          const paddingY = guideImageHeight * paddingRatio;

          cropX = Math.max(0, guideImageX - paddingX);
          cropY = Math.max(0, guideImageY - paddingY);
          cropWidth = Math.min(
            imageWidth - cropX,
            guideImageWidth + 2 * paddingX,
          );
          cropHeight = Math.min(
            imageHeight - cropY,
            guideImageHeight + 2 * paddingY,
          );

          // 최소 크기 보장
          const minCropSize = 200;
          if (cropWidth < minCropSize) {
            cropX = Math.max(0, (imageWidth - minCropSize) / 2);
            cropWidth = Math.min(minCropSize, imageWidth);
          }
          if (cropHeight < minCropSize) {
            cropY = Math.max(0, (imageHeight - minCropSize) / 2);
            cropHeight = Math.min(minCropSize, imageHeight);
          }
        }

        // 경계 안으로 클램프 (변수가 정의되었는지 확인)
        if (
          cropX !== undefined &&
          cropY !== undefined &&
          cropWidth !== undefined &&
          cropHeight !== undefined
        ) {
          cropX = Math.max(0, Math.min(cropX, imageWidth - cropWidth));
          cropY = Math.max(0, Math.min(cropY, imageHeight - cropHeight));
          cropWidth = Math.min(cropWidth, imageWidth - cropX);
          cropHeight = Math.min(cropHeight, imageHeight - cropY);
        } else {
          console.warn('⚠️ 크롭 변수가 정의되지 않음 - 원본 반환');
          return photoPath;
        }

        // 너무 작으면 최소값 보장
        if (cropWidth < 1 || cropHeight < 1) {
          console.warn('⚠️ 크롭 영역 너무 작음 - 원본 반환');
          return photoPath;
        }

        // 정수로 반올림 후 다시 한 번 경계 체크
        const originX = Math.floor(cropX);
        const originY = Math.floor(cropY);
        const width = Math.floor(cropWidth);
        const height = Math.floor(cropHeight);

        const isValidCrop =
          originX >= 0 &&
          originY >= 0 &&
          width > 0 &&
          height > 0 &&
          originX + width <= imageWidth &&
          originY + height <= imageHeight;

        if (!isValidCrop) {
          console.warn('⚠️ 최종 크롭 영역이 이미지 밖입니다 - 원본 반환', {
            originX,
            originY,
            width,
            height,
            imageWidth,
            imageHeight,
          });
          return photoPath;
        }

        console.log('✂️ 최종 크롭 영역:', {
          originX,
          originY,
          width,
          height,
          imageWidth,
          imageHeight,
        });

        const manipulatedImage = await ImageManipulator.manipulate(
          photoPath,
          [
            {
              crop: {
                originX,
                originY,
                width,
                height,
              },
            },
          ],
          { compress: 0.9, format: 'jpeg' },
        );

        if (!manipulatedImage?.uri) {
          console.warn('⚠️ 크롭 결과 URI 없음 - 원본 반환');
          return photoPath;
        }

        console.log('✅ 입술 영역 크롭 완료:', manipulatedImage.uri);
        return manipulatedImage.uri;
      } catch (error) {
        console.error('❌ 입술 영역 크롭 오류:', error);
        return photoPath;
      }
    },
    [position, guideVerticalPosition, isFlipped],
  );

  // 자동 촬영 실행
  const triggerAutoCapture = useCallback(async () => {
    if (
      autoCaptureTriggeredRef.current ||
      isCapturing ||
      !camera.current ||
      !isReady
    ) {
      return;
    }

    try {
      autoCaptureTriggeredRef.current = true;
      setIsCapturing(true);
      console.log('🤖 자동 촬영 시작 - 구도 적합');

      triggerFlash();

      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'on',
        enableShutterSound: true,
      });

      const photoPath = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      const croppedPath = await cropLipArea(
        photoPath,
        photo.width,
        photo.height,
      );

      const cropRatio = croppedPath !== photoPath ? 0.7 : 1.0;
      const asset = {
        uri: croppedPath,
        type: 'image/jpeg',
        fileName: `dental_${position}_${Date.now()}.jpg`,
        width: Math.round(photo.width * cropRatio),
        height: Math.round(photo.height * cropRatio),
      };

      console.log('✅ 자동 촬영 완료 (입술 영역 크롭)');
      if (alignmentTimerRef.current) {
        clearTimeout(alignmentTimerRef.current);
        alignmentTimerRef.current = null;
      }

      onCapture(asset);
    } catch (error) {
      console.error('❌ 자동 촬영 오류:', error);
      autoCaptureTriggeredRef.current = false;
      if (alignmentTimerRef.current) {
        clearTimeout(alignmentTimerRef.current);
        alignmentTimerRef.current = null;
      }
    } finally {
      setIsCapturing(false);
    }
  }, [isReady, isCapturing, position, onCapture, triggerFlash, cropLipArea]);

  // 0.5초마다 사진 촬영 및 입술 검출
  const captureAndUploadPhoto = useCallback(async () => {
    if (
      !camera.current ||
      isProcessingRef.current ||
      !hasPermission ||
      !isReady
    )
      return;

    if (isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;

      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off', // 입술 검출용이므로 플래시 끄기
        enableShutterSound: false,
      });

      const photoPath = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      lastPhotoRef.current = photoPath;
      console.log('📸 사진 촬영 완료 (무음)');

      try {
        setIsDetecting(true);
        const result = await detectLips(photoPath);

        if (result.success && result.data.faceDetected) {
          setLipPoints(result.data.lipPoints);
          setImageSize({
            width: result.data.width,
            height: result.data.height,
          });

          const scaleX = SCREEN_WIDTH / result.data.width;
          const scaleY = SCREEN_HEIGHT / result.data.height;
          const screenPoints = result.data.lipPoints.map(point => ({
            x: point.x * scaleX,
            y: point.y * scaleY,
          }));

          if (
            screenPoints.length > 0 &&
            checkAlignment(screenPoints, position)
          ) {
            if (!alignmentTimerRef.current) {
              console.log('🎯 구도 적합 - 3초 유지 대기 중...');
              alignmentTimerRef.current = setTimeout(() => {
                console.log('✅ 3초 유지 완료 - 자동 촬영 실행');
                alignmentTimerRef.current = null;
                triggerAutoCapture();
              }, 3000);
            }
          } else {
            if (alignmentTimerRef.current) {
              console.log('⚠️ 구도 불일치 - 타이머 리셋');
              clearTimeout(alignmentTimerRef.current);
              alignmentTimerRef.current = null;
            }
          }
        } else {
          setLipPoints([]);
        }
      } catch (error) {
        console.error('입술 검출 오류:', error);
      } finally {
        setIsDetecting(false);
      }
    } catch (error) {
      const errorCode = error?.code || error?.message || 'unknown';
      if (errorCode !== -11803 && errorCode !== -16409) {
        console.warn('사진 촬영 경고:', errorCode);
      }
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);
    }
  }, [hasPermission, isReady, position, checkAlignment, triggerAutoCapture]);

  // 수동 촬영
  const takePhoto = async () => {
    console.log(
      '📸 촬영 시도 - 카메라 준비:',
      isReady,
      '카메라 ref:',
      !!camera.current,
    );

    if (!camera.current || !isReady || isCapturing || !hasPermission) {
      console.warn('⚠️ 촬영 불가 - 카메라가 준비되지 않음');
      return;
    }

    try {
      setIsCapturing(true);
      triggerFlash();

      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'on',
        enableShutterSound: true,
      });

      const photoPath = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      // 수동 촬영은 크롭하지 않고 원본 이미지 사용
      const asset = {
        uri: photoPath,
        type: 'image/jpeg',
        fileName: `dental_${position}_${Date.now()}.jpg`,
        width: photo.width,
        height: photo.height,
      };

      console.log('✅ 수동 촬영 완료 (원본 이미지)');
      onCapture(asset);
    } catch (error) {
      console.error('❌ 촬영 오류:', error);
      Alert.alert('Error', 'Failed to take the photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCameraReady = useCallback(() => {
    setIsReady(true);
    console.log('✅ 카메라 준비 완료');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('🎬 카메라 활성화');
      setIsCameraActive(true);
    }, 100);

    return () => {
      clearTimeout(timer);
      console.log('🛑 카메라 비활성화');
      setIsCameraActive(false);
    };
  }, []);

  useEffect(() => {
    if (hasPermission && device && isReady && isCameraActive) {
      const initialDelay = setTimeout(() => {
        captureAndUploadPhoto();
      }, 500);

      detectionIntervalRef.current = setInterval(() => {
        captureAndUploadPhoto();
      }, 500);

      return () => {
        clearTimeout(initialDelay);
        if (detectionIntervalRef.current)
          clearInterval(detectionIntervalRef.current);
      };
    }

    return () => {
      if (detectionIntervalRef.current)
        clearInterval(detectionIntervalRef.current);
    };
  }, [hasPermission, device, isReady, isCameraActive, captureAndUploadPhoto]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={checkPermission}
          >
            <Text style={styles.permissionButtonText}>Request permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device && (
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={isCameraActive}
          photo={true}
          onInitialized={handleCameraReady}
          onError={error => {
            console.error('Camera error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
          }}
        />
      )}

      {showFlash && <View style={styles.flashOverlay} />}

      <View style={styles.overlay}>
        <View style={styles.guideContainer}>
          <MouthGuide
            position={position}
            verticalPosition={guideVerticalPosition}
            flipAnimation={flipAnimation}
          />
        </View>

        {lipPoints.length > 0 && imageSize.width > 0 && (
          <LipOverlay
            lipPoints={lipPoints}
            imageSize={imageSize}
            screenWidth={SCREEN_WIDTH}
            screenHeight={SCREEN_HEIGHT}
            isFlipped={isFlipped}
          />
        )}
      </View>

      <View
        style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.bottomHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{POSITION_LABELS[position]} photo</Text>
            <Text style={styles.subtitle}>
              Line up your mouth with the guide
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureControls}>
          {/* 카메라 전환 버튼 */}
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => {
              setCameraType(prev => (prev === 'front' ? 'back' : 'front'));
              setIsReady(false);
              setLipPoints([]);
              setImageSize({ width: 0, height: 0 });
              if (alignmentTimerRef.current) {
                clearTimeout(alignmentTimerRef.current);
                alignmentTimerRef.current = null;
              }
              autoCaptureTriggeredRef.current = false;
            }}
          >
            <Text style={styles.flipButtonText}>🔄</Text>
          </TouchableOpacity>

          <View style={styles.captureButtonContainer}>
            {isReady ? (
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  isCapturing && styles.captureButtonDisabled,
                ]}
                onPress={takePhoto}
                disabled={isCapturing}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            ) : (
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.loadingText}>Preparing...</Text>
              </View>
            )}
          </View>

          {/* 가이드라인 위치 전환 버튼 */}
          <TouchableOpacity
            style={styles.guidePositionButton}
            onPress={() => {
              // 데칼코마니 180도 회전 애니메이션 (토글)
              const targetValue = isFlipped ? 0 : 1;
              setIsFlipped(!isFlipped);
              Animated.timing(flipAnimation, {
                toValue: targetValue,
                duration: 400,
                useNativeDriver: true,
              }).start();
            }}
          >
            <Text style={styles.guidePositionButtonText}>
              {guideVerticalPosition === 'top'
                ? '⬆️'
                : guideVerticalPosition === 'center'
                ? '↕️'
                : '⬇️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ====== 오버레이 컴포넌트들 ======

function LipOverlay({
  lipPoints,
  imageSize,
  screenWidth,
  screenHeight,
  isFlipped = false,
}) {
  const scaleX = screenWidth / imageSize.width;
  const scaleY = screenHeight / imageSize.height;

  const screenPoints = lipPoints.map(point => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    // 가이드라인이 뒤집혔으면 Y 좌표도 뒤집기 (화면 중앙 기준)
    if (isFlipped) {
      return {
        x: x,
        y: screenHeight - y,
      };
    }

    return { x, y };
  });

  const pathData =
    screenPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ') + ' Z';

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={screenWidth}
      height={screenHeight}
    >
      <Path
        d={pathData}
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {screenPoints.map((point, index) => (
        <Circle key={index} cx={point.x} cy={point.y} r="3" fill="#10b981" />
      ))}
    </Svg>
  );
}

function MouthGuide({ position, verticalPosition = 'center', flipAnimation }) {
  const guideStyles = getGuideStyle(position, verticalPosition);

  return (
    <View style={styles.guideWrapper}>
      <Animated.View
        style={[
          styles.guideOutline,
          guideStyles,
          {
            transform: [
              { perspective: 1000 },
              {
                rotateX: flipAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          },
        ]}
      >
        {position === 'upper' && (
          <>
            <View style={[styles.upperTeethGuide, guideStyles.upperTeeth]} />
            <Animated.Text
              style={[
                styles.guideText,
                {
                  transform: [
                    {
                      scaleX: flipAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, -1],
                      }),
                    },
                  ],
                },
              ]}
            >
              Align your upper teeth with the guide
            </Animated.Text>
          </>
        )}

        {position === 'lower' && (
          <>
            <View style={[styles.lowerTeethGuide, guideStyles.lowerTeeth]} />
            <Animated.Text
              style={[
                styles.guideText,
                {
                  transform: [
                    {
                      scaleX: flipAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, -1],
                      }),
                    },
                  ],
                },
              ]}
            >
              Align your lower teeth with the guide
            </Animated.Text>
          </>
        )}

        {position === 'front' && (
          <>
            <View style={[styles.frontTeethGuide, guideStyles.frontTeeth]} />
            <Animated.Text
              style={[
                styles.guideText,
                {
                  transform: [
                    {
                      scaleX: flipAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, -1],
                      }),
                    },
                  ],
                },
              ]}
            >
              Align your front teeth with the guide
            </Animated.Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function getGuideStyle(position, verticalPosition = 'center') {
  const baseSize = SCREEN_WIDTH * 0.7;
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT / 2;

  // 세로 위치에 따른 top 값 계산
  let topOffset;
  switch (verticalPosition) {
    case 'top':
      topOffset = SCREEN_HEIGHT * 0.2; // 화면 상단 20% 위치
      break;
    case 'bottom':
      topOffset = SCREEN_HEIGHT * 0.6; // 화면 하단 40% 위치
      break;
    case 'center':
    default:
      topOffset = centerY - baseSize * 0.25; // 중앙
      break;
  }

  switch (position) {
    case 'upper':
      return {
        width: baseSize,
        height: baseSize * 0.5,
        top: topOffset,
        left: centerX - baseSize / 2,
        borderTopLeftRadius: baseSize * 0.3,
        borderTopRightRadius: baseSize * 0.3,
        borderBottomLeftRadius: baseSize * 0.1,
        borderBottomRightRadius: baseSize * 0.1,
        upperTeeth: {
          width: baseSize * 0.9,
          height: baseSize * 0.25,
          top: 0,
          left: baseSize * 0.05,
          borderTopLeftRadius: baseSize * 0.3,
          borderTopRightRadius: baseSize * 0.3,
        },
      };

    case 'lower':
      return {
        width: baseSize,
        height: baseSize * 0.5,
        top: topOffset,
        left: centerX - baseSize / 2,
        borderTopLeftRadius: baseSize * 0.1,
        borderTopRightRadius: baseSize * 0.1,
        borderBottomLeftRadius: baseSize * 0.3,
        borderBottomRightRadius: baseSize * 0.3,
        lowerTeeth: {
          width: baseSize * 0.9,
          height: baseSize * 0.25,
          bottom: 0,
          left: baseSize * 0.05,
          borderBottomLeftRadius: baseSize * 0.3,
          borderBottomRightRadius: baseSize * 0.3,
        },
      };

    case 'front':
      return {
        width: baseSize * 0.8,
        height: baseSize * 0.5,
        top: topOffset,
        left: centerX - baseSize * 0.4,
        borderRadius: baseSize * 0.2,
        frontTeeth: {
          width: baseSize * 0.7,
          height: baseSize * 0.35,
          top: baseSize * 0.075,
          left: baseSize * 0.05,
          borderRadius: baseSize * 0.15,
        },
      };

    default:
      return {};
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideOutline: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  upperTeethGuide: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'solid',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderBottomWidth: 0,
  },
  lowerTeethGuide: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'solid',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderTopWidth: 0,
  },
  frontTeethGuide: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'solid',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  guideText: {
    position: 'absolute',
    bottom: -40,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 20,
  },
  bottomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  captureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  captureButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#3b82f6',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 12,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 9999,
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  flipButtonText: {
    fontSize: 28,
  },
  guidePositionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  guidePositionButtonText: {
    fontSize: 28,
  },
});
