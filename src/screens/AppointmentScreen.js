import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Platform, PermissionsAndroid, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getNearbyDentists, getClinics, getUserAppointments, getAvailableDates, getAvailableSlots, getSurveyQuestions, createAppointment } from '../services/api';

// 치과 목록 페이지당 개수
const CLINIC_PAGE_SIZE = 20;
import { getUser } from '../utils/storage';

// Android: 구글 지도 / iOS: 애플 지도(기본)
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

// 네이버의 zoom 레벨을 react-native-maps 의 region delta 로 변환
const regionFromZoom = (latitude, longitude, zoom) => {
  const longitudeDelta = 360 / Math.pow(2, zoom);
  return {
    latitude,
    longitude,
    latitudeDelta: longitudeDelta * 0.7,
    longitudeDelta,
  };
};

export default function AppointmentScreen() {
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState([]);
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  // 달력에 표시 중인 '월'(해당 월 1일)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSurvey, setLoadingSurvey] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 37.5665, // 서울 기본 좌표
    longitude: 126.9780,
  });
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState(null);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  
  // 스크롤 및 카드 참조
  const scrollViewRef = useRef(null);
  const clinicCardRefs = useRef({});
  const mapRef = useRef(null);
  const smallMapRef = useRef(null);

  // 현재 위치 가져오기
  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location permission request',
              message: 'Location permission is required to find nearby dental clinics.',
              buttonNeutral: 'Later',
              buttonNegative: 'Deny',
              buttonPositive: 'Allow',
            }
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            getCurrentLocation();
          }
        } catch (err) {
          console.warn(err);
        }
      } else {
        // iOS는 Info.plist 설정만으로 자동 요청
        getCurrentLocation();
      }
    };

    const getCurrentLocation = () => {
      // 위치는 지도 중심/현재위치 마커 표시용으로만 사용한다.
      // 치과 목록은 위치와 무관하게 전체 조회(페이지네이션)로 불러온다.
      Geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.log('위치 가져오기 실패:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };

    requestLocationPermission();
    fetchClinics(1);
    fetchAppointments();
  }, []);

  // 예약 목록 가져오기
  const fetchAppointments = async () => {
    try {
      setAppointmentsLoading(true);
      setAppointmentsError(null);
      
      const userData = await getUser();
      if (!userData || !userData.id) {
        setAppointmentsError('You need to log in.');
        setAppointmentsLoading(false);
        return;
      }

      const response = await getUserAppointments(userData.id);
      
      if (response.success) {
        setAppointments(response.data);
      } else {
        setAppointmentsError('Failed to load appointment information.');
      }
    } catch (err) {
      console.error('예약 목록 조회 오류:', err);
      setAppointmentsError(err.message || 'Failed to load appointment information.');
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // 치과 목록이 로드되면 작은 지도를 마커들 범위에 맞춰 이동/줌한다.
  // (현위치가 아직 기본값이어도 실제 치과 위치가 화면에 보이도록)
  useEffect(() => {
    const coords = clinics
      .map(c => ({ latitude: parseFloat(c.latitude), longitude: parseFloat(c.longitude) }))
      .filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
    if (coords.length === 0 || !smallMapRef.current) return;
    const t = setTimeout(() => {
      smallMapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [clinics]);

  // 전체 치과 목록 조회 (페이지네이션)
  // pageToLoad: 불러올 페이지, append: true면 기존 목록에 이어붙임, isRefresh: 당겨서 새로고침
  const fetchClinics = async (pageToLoad = 1, { append = false, isRefresh = false } = {}) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await getClinics(pageToLoad, CLINIC_PAGE_SIZE);

      if (response.success) {
        setClinics(prev => (append ? [...prev, ...response.data] : response.data));
        const pg = response.pagination || {};
        setPage(pageToLoad);
        setHasMore(!!pg.hasMore);
        setTotal(pg.total ?? response.data.length);
      } else {
        setError('Failed to load dental clinic information.');
      }
    } catch (err) {
      console.error('치과 목록 조회 오류:', err);
      setError(err.message || 'Failed to load dental clinic information.');
      if (!append && !isRefresh) {
        Alert.alert('Error', 'Failed to load dental clinic information. Please try again.');
      }
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
      setLoading(false);
    }
  };

  // 더보기 (다음 페이지 이어붙이기)
  const loadMoreClinics = () => {
    if (loadingMore || !hasMore) return;
    fetchClinics(page + 1, { append: true });
  };

  // 새로고침 핸들러 - 첫 페이지부터 다시 로드
  const onRefresh = () => {
    fetchClinics(1, { isRefresh: true });
  };

  // 예약하기 버튼 클릭
  const handleBooking = async (clinic) => {
    if (clinic.is_partner !== 1) {
      Alert.alert('Notice', 'This clinic is not a partner clinic. Please book by phone.');
      return;
    }

    setSelectedClinic(clinic);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSurveyAnswers([]);
    setSurveyStep(0);
    
    // 예약 가능한 날짜 조회
    try {
      setLoadingDates(true);
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const toDate = futureDate.toISOString().split('T')[0];
      
      const response = await getAvailableDates(clinic.id, today, toDate);
      if (response.success) {
        const dates = response.data || [];
        setAvailableDates(dates);
        // 달력을 첫 예약 가능 날짜의 월로 이동
        if (dates.length > 0) {
          const [fy, fm] = dates[0].split('-').map(Number);
          setCalendarMonth(new Date(fy, fm - 1, 1));
        }
        setShowDatePicker(true);
      } else {
        Alert.alert('Error', 'Unable to load available dates.');
      }
    } catch (err) {
      console.error('날짜 조회 오류:', err);
      Alert.alert('Error', err.message || 'Unable to load available dates.');
    } finally {
      setLoadingDates(false);
    }
  };

  // 날짜 선택
  const handleDateSelect = async (date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    
    // 예약 가능한 시간 조회
    try {
      setLoadingSlots(true);
      const response = await getAvailableSlots(selectedClinic.id, date);
      if (response.success) {
        const availableTimes = response.data.filter(slot => slot.is_available);
        setAvailableSlots(availableTimes);
        setShowTimePicker(true);
      } else {
        Alert.alert('Error', 'Unable to load available times.');
      }
    } catch (err) {
      console.error('시간 조회 오류:', err);
      Alert.alert('Error', err.message || 'Unable to load available times.');
    } finally {
      setLoadingSlots(false);
    }
  };

  // 시간 선택
  const handleTimeSelect = async (slot) => {
    setSelectedSlot(slot);
    setShowTimePicker(false);
    
    // 설문 질문 조회
    try {
      setLoadingSurvey(true);
      const response = await getSurveyQuestions();
      if (response.success) {
        // options 필드가 JSON 문자열인 경우 파싱
        const parsedQuestions = (response.data || []).map(question => {
          if (question.options && typeof question.options === 'string') {
            try {
              question.options = JSON.parse(question.options);
            } catch (e) {
              console.error('options 파싱 오류:', e);
              question.options = [];
            }
          }
          return question;
        });
        setSurveyQuestions(parsedQuestions);
        setShowSurvey(true);
      } else {
        Alert.alert('Error', 'Unable to load survey questions.');
      }
    } catch (err) {
      console.error('설문 질문 조회 오류:', err);
      Alert.alert('Error', err.message || 'Unable to load survey questions.');
    } finally {
      setLoadingSurvey(false);
    }
  };

  // 설문 답변
  const handleSurveyAnswer = (questionId, answer) => {
    const newAnswer = {
      question_id: questionId,
      answer: answer,
    };
    
    const updatedAnswers = [...surveyAnswers];
    const existingIndex = updatedAnswers.findIndex(a => a.question_id === questionId);
    
    if (existingIndex >= 0) {
      updatedAnswers[existingIndex] = newAnswer;
    } else {
      updatedAnswers.push(newAnswer);
    }
    
    setSurveyAnswers(updatedAnswers);
    
    if (surveyStep < surveyQuestions.length - 1) {
      setSurveyStep(surveyStep + 1);
    } else {
      // 설문 완료 후 예약 생성
      handleCreateAppointment();
    }
  };

  // 예약 생성
  const handleCreateAppointment = async () => {
    try {
      setCreatingAppointment(true);
      
      const user = await getUser();
      const appointmentData = {
        clinic_id: selectedClinic.id,
        slot_id: selectedSlot.id,
        patient_name: user?.name || 'John Doe', // 사용자 정보에서 가져오기
        patient_phone: user?.phone || '010-0000-0000',
        patient_email: user?.email || '',
        symptoms: surveyAnswers.find(a => a.question_id === surveyQuestions.find(q => q.question_type === 'text')?.id)?.answer || '',
        survey_answers: surveyAnswers,
      };

      if (user?.id) {
        appointmentData.user_id = user.id;
      }

      const response = await createAppointment(appointmentData);
      
      if (response.success) {
        Alert.alert('Success', 'Your appointment has been booked!', [
          {
            text: 'OK',
            onPress: () => {
              // 상태 초기화
      setShowSurvey(false);
      setSurveyStep(0);
      setSurveyAnswers([]);
              setSelectedClinic(null);
              setSelectedDate(null);
              setSelectedSlot(null);
              // 예약 목록 새로고침
              fetchAppointments();
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to create appointment.');
      }
    } catch (err) {
      console.error('예약 생성 오류:', err);
      Alert.alert('Error', err.message || 'Failed to create appointment.');
    } finally {
      setCreatingAppointment(false);
    }
  };

  // 마커 클릭 시 해당 치과 카드로 스크롤
  const handleMarkerTap = (clinicId) => {
    // 풀스크린 모달 닫기
    setShowFullscreenMap(false);
    
    // 약간의 지연 후 스크롤
    setTimeout(() => {
      const cardRef = clinicCardRefs.current[clinicId];
      if (cardRef && scrollViewRef.current) {
        cardRef.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 20, animated: true });
          },
          () => console.log('측정 실패')
        );
      }
    }, 300);
  };

  // 치과 카드 클릭 시 지도 열고 해당 위치로 이동
  const handleClinicCardTap = (clinic) => {
    // 풀스크린 모달 열기
    setShowFullscreenMap(true);

    const lat = parseFloat(clinic.latitude);
    const lng = parseFloat(clinic.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    // 지도가 렌더링된 후 해당 위치로 이동
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateCamera(
          {
            center: { latitude: lat, longitude: lng },
            zoom: 17,
          },
          { duration: 1000 },
        );
      }
    }, 500);
  };

  // 내 위치로 가기
  const moveToMyLocation = (isFullscreen = false) => {
    const targetRef = isFullscreen ? mapRef : smallMapRef;
    if (targetRef.current && currentLocation) {
      targetRef.current.animateCamera(
        {
          center: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          zoom: 16,
        },
        { duration: 1000 },
      );
    }
  };

  // 전화 걸기
  const handleCall = (clinic) => {
    if (!clinic.phone) {
      Alert.alert('Notice', 'This clinic has no registered phone number.');
      return;
    }

    // 전화번호에서 공백과 하이픈 제거
    const phoneNumber = clinic.phone.replace(/[\s-]/g, '');
    
    Alert.alert(
      'Call',
      `Call ${clinic.name}?\n\n${clinic.phone}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
              Alert.alert('Error', 'Unable to make the call.');
              console.error('전화 걸기 오류:', err);
            });
          },
        },
      ]
    );
  };

  // KST 기준으로 날짜 문자열을 포맷팅 (날짜 변경 없이)
  const formatDateKST = (dateString) => {
    if (!dateString || typeof dateString !== 'string') {
      return dateString || '';
    }

    // YYYY-MM-DD 형식의 문자열을 파싱
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return dateString;
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    // 유효성 검사
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return dateString;
    }

    // 로컬 시간대로 Date 객체 생성 (시간대 변환 없이)
    // 이렇게 하면 UTC 변환 없이 로컬 시간대로 처리됨
    const date = new Date(year, month - 1, day);

    // Date 객체 유효성 검사
    if (isNaN(date.getTime())) {
      return dateString;
    }

    // 영어 형식으로 포맷팅 (예: "Fri, Jul 25, 2026")
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const CAL_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const CAL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const pad2 = (n) => String(n).padStart(2, '0');

  // 예약 가능 날짜를 달력(월 그리드)로 렌더. 가능 날짜만 선택 가능.
  const renderCalendar = () => {
    const availSet = new Set(availableDates);
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthKey = (y, m) => y * 12 + m;
    const cur = monthKey(year, month);
    let minK = cur;
    let maxK = cur;
    if (availableDates.length > 0) {
      const ks = availableDates.map((d) => {
        const [y, m] = d.split('-').map(Number);
        return monthKey(y, m - 1);
      });
      minK = Math.min(...ks);
      maxK = Math.max(...ks);
    }
    const canPrev = cur > minK;
    const canNext = cur < maxK;
    const shiftMonth = (delta) => setCalendarMonth(new Date(year, month + delta, 1));

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <View style={styles.calendar}>
        <View style={styles.calHeader}>
          <TouchableOpacity
            disabled={!canPrev}
            onPress={() => shiftMonth(-1)}
            style={styles.calNav}
          >
            <Text style={[styles.calNavText, !canPrev && styles.calNavDisabled]}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.calMonthLabel}>
            {CAL_MONTHS[month]} {year}
          </Text>
          <TouchableOpacity
            disabled={!canNext}
            onPress={() => shiftMonth(1)}
            style={styles.calNav}
          >
            <Text style={[styles.calNavText, !canNext && styles.calNavDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calWeekRow}>
          {CAL_WEEKDAYS.map((w, i) => (
            <Text key={w} style={[styles.calWeekday, i === 0 && styles.calSunday]}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {cells.map((d, idx) => {
            if (d === null) {
              return <View key={`blank-${idx}`} style={styles.calCell} />;
            }
            const ds = `${year}-${pad2(month + 1)}-${pad2(d)}`;
            const isAvail = availSet.has(ds);
            const isSel = selectedDate === ds;
            return (
              <TouchableOpacity
                key={ds}
                style={styles.calCell}
                disabled={!isAvail}
                activeOpacity={0.7}
                onPress={() => handleDateSelect(ds)}
              >
                <View
                  style={[
                    styles.calDay,
                    isAvail && styles.calDayAvail,
                    isSel && styles.calDaySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      !isAvail && styles.calDayTextDisabled,
                      isSel && styles.calDayTextSelected,
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // 날짜 선택 모달
  const renderDatePicker = () => (
    <Modal
      visible={showDatePicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select appointment date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {loadingDates ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading dates...</Text>
              </View>
            ) : availableDates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="event" size={48} color="#9ca3af" />
                <Text style={styles.emptyMessage}>No available dates.</Text>
              </View>
            ) : (
              renderCalendar()
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // 시간 선택 모달
  const renderTimePicker = () => (
    <Modal
      visible={showTimePicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTimePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select appointment time</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(false)}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {loadingSlots ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading times...</Text>
              </View>
            ) : availableSlots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="schedule" size={48} color="#9ca3af" />
                <Text style={styles.emptyMessage}>No available times.</Text>
              </View>
            ) : (
              <View style={styles.timeList}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeItem,
                      selectedSlot?.id === slot.id && styles.timeItemSelected
                    ]}
                    onPress={() => handleTimeSelect(slot)}
                  >
                    <Text style={[
                      styles.timeText,
                      selectedSlot?.id === slot.id && styles.timeTextSelected
                    ]}>
                      {slot.time_slot.substring(0, 5)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // 설문 화면
  if (showSurvey) {
    const currentQuestion = surveyQuestions[surveyStep];
    if (!currentQuestion) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.surveyHeader}>
          <Text style={styles.surveyTitle}>Pre-visit self-assessment</Text>
          <Text style={styles.surveySubtext}>
            Please answer a few questions for a better visit
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${((surveyStep + 1) / surveyQuestions.length) * 100}%` }
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.surveyCard}>
          <Text style={styles.surveyQuestion}>
            {currentQuestion.question}
          </Text>
          <View style={styles.surveyOptions}>
            {currentQuestion.question_type === 'yes_no' ? (
              <>
                <TouchableOpacity
                  onPress={() => handleSurveyAnswer(currentQuestion.id, 'yes')}
                  style={styles.surveyOption}
                >
                  <Text style={styles.surveyOptionText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSurveyAnswer(currentQuestion.id, 'no')}
                  style={styles.surveyOption}
                >
                  <Text style={styles.surveyOptionText}>No</Text>
                </TouchableOpacity>
              </>
            ) : currentQuestion.question_type === 'multiple_choice' && currentQuestion.options ? (
              (() => {
                // options가 문자열인 경우 파싱
                let optionsArray = currentQuestion.options;
                if (typeof optionsArray === 'string') {
                  try {
                    optionsArray = JSON.parse(optionsArray);
                  } catch (e) {
                    console.error('options 파싱 오류:', e);
                    optionsArray = [];
                  }
                }
                
                return Array.isArray(optionsArray) && optionsArray.length > 0 ? (
                  optionsArray.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleSurveyAnswer(currentQuestion.id, option)}
                      style={styles.surveyOption}
                    >
                      <Text style={styles.surveyOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.textInputContainer}>
                    <Text style={styles.textInputLabel}>No options available.</Text>
                  </View>
                );
              })()
            ) : (
              <View style={styles.textInputContainer}>
                <Text style={styles.textInputLabel}>Please enter your answer</Text>
                {/* 텍스트 입력은 나중에 구현 가능 */}
              </View>
            )}
          </View>
        </View>

        <View style={styles.surveyFooter}>
          <TouchableOpacity
            onPress={() => {
              if (surveyStep > 0) {
                setSurveyStep(surveyStep - 1);
              } else {
                setShowSurvey(false);
                setShowTimePicker(true);
              }
            }}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>Back</Text>
          </TouchableOpacity>
          {creatingAppointment && (
            <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 16 }} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
      >
      {/* 지도 영역 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Find nearby clinics</Text>
          <TouchableOpacity 
            style={styles.appointmentButton}
            onPress={() => setShowAppointmentsModal(true)}
          >
            <Icon name="event-note" size={24} color="#ffffff" />
            {appointments.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{appointments.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.mapCard}
          onPress={() => setShowFullscreenMap(true)}
          activeOpacity={0.8}
        >
        <MapView
            ref={smallMapRef}
            provider={MAP_PROVIDER}
            key={`map-${currentLocation.latitude}-${currentLocation.longitude}`}
            style={styles.mapContainer}
            initialRegion={regionFromZoom(
              currentLocation.latitude,
              currentLocation.longitude,
              15,
            )}
          >
            {/* 현재 위치 마커 */}
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.currentLocationMarker}>
                <View style={styles.currentLocationDot} />
              </View>
            </Marker>

            {/* 치과 마커들 */}
            {clinics.map((clinic, index) => {
              const lat = parseFloat(clinic.latitude);
              const lng = parseFloat(clinic.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
              <Marker
                key={clinic.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={`${index + 1}. ${clinic.name}`}
                description={clinic.distance ? `${parseFloat(clinic.distance).toFixed(2)}km` : ''}
                pinColor={clinic.is_partner === 1 ? '#2563eb' : '#ef4444'}
              />
              );
            })}
          </MapView>
          <View style={styles.mapOverlayHint}>
            <Text style={styles.mapOverlayText}>📍 Tap the map to expand</Text>
          </View>
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={(e) => {
              e.stopPropagation();
              moveToMyLocation(false);
            }}
          >
            <Icon name="my-location" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* 풀스크린 지도 모달 */}
      <Modal
        visible={showFullscreenMap}
        animationType="slide"
        onRequestClose={() => setShowFullscreenMap(false)}
      >
        <View style={styles.fullscreenMapContainer}>
          <MapView
            ref={mapRef}
            provider={MAP_PROVIDER}
            key={`fullscreen-map-${currentLocation.latitude}-${currentLocation.longitude}`}
            style={styles.fullscreenMap}
            initialRegion={regionFromZoom(
              currentLocation.latitude,
              currentLocation.longitude,
              15,
            )}
          >
            {/* 현재 위치 마커 */}
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.currentLocationMarker}>
                <View style={styles.currentLocationDot} />
              </View>
            </Marker>

            {/* 치과 마커들 */}
            {clinics.map((clinic, index) => {
              const lat = parseFloat(clinic.latitude);
              const lng = parseFloat(clinic.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
              <Marker
                key={clinic.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={`${index + 1}. ${clinic.name}`}
                description={clinic.distance ? `${parseFloat(clinic.distance).toFixed(2)}km` : ''}
                pinColor={clinic.is_partner === 1 ? '#2563eb' : '#ef4444'}
                onPress={() => handleMarkerTap(clinic.id)}
              />
              );
            })}
          </MapView>
          <TouchableOpacity
            style={styles.closeMapButton}
            onPress={() => setShowFullscreenMap(false)}
          >
            <Icon name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.myLocationButtonFullscreen}
            onPress={() => moveToMyLocation(true)}
          >
            <Icon name="my-location" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 치과 리스트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All clinics ({total})</Text>
        <View style={styles.divider} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading clinic list...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Icon name="error" size={48} color="#ef4444" />
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchClinics(1)}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : clinics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="sentiment-dissatisfied" size={48} color="#9ca3af" />
            <Text style={styles.emptyMessage}>No clinics registered.</Text>
          </View>
        ) : (
        <View style={styles.clinicList}>
            {clinics.map((clinic, index) => (
              <View 
                key={clinic.id} 
                ref={(ref) => clinicCardRefs.current[clinic.id] = ref}
                style={styles.clinicCard}
              >
              <View style={styles.clinicInfo}>
                <View style={styles.clinicHeader}>
                    <TouchableOpacity 
                      style={styles.clinicNameRow}
                      onPress={() => handleClinicCardTap(clinic)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.clinicNumberBadge}>
                        <Text style={styles.clinicNumberText}>{index + 1}</Text>
                      </View>
                  <Text style={styles.clinicName}>{clinic.name}</Text>
                      {clinic.is_partner === 1 && (
                        <View style={styles.partnerBadge}>
                          <Text style={styles.partnerBadgeText}>Partner</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  <View style={styles.clinicRating}>
                      <Icon name="star" size={16} color="#fbbf24" />
                      <Text style={styles.ratingText}>{clinic.rating || 'N/A'}</Text>
                    <Text style={styles.separator}>•</Text>
                      <Text style={styles.distanceText}>
                        {clinic.distance ? `${parseFloat(clinic.distance).toFixed(2)}km` : 'N/A'}
                      </Text>
                  </View>
                </View>

                <View style={styles.clinicDetails}>
                  <View style={styles.clinicDetail}>
                      <Icon name="location-on" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{clinic.address}</Text>
                  </View>
                    {clinic.phone && (
                  <View style={styles.clinicDetail}>
                        <Icon name="phone" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{clinic.phone}</Text>
                  </View>
                    )}
                </View>

                  {clinic.availableSlots && clinic.availableSlots.length > 0 && (
                <View style={styles.slotsSection}>
                  <Text style={styles.slotsLabel}>Available times</Text>
                  <View style={styles.slotsContainer}>
                        {clinic.availableSlots.map((slot, slotIndex) => (
                          <View key={slotIndex} style={styles.slotTag}>
                        <Text style={styles.slotText}>{slot}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                  )}

                  {clinic.is_partner === 1 ? (
                <TouchableOpacity
                  onPress={() => handleBooking(clinic)}
                  style={styles.bookingButton}
                >
                      <Icon name="event" size={18} color="#ffffff" style={styles.buttonIcon} />
                      <Text style={styles.bookingButtonText}>Book</Text>
                </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleCall(clinic)}
                      style={styles.callButton}
                    >
                      <Icon name="phone" size={18} color="#ffffff" style={styles.buttonIcon} />
                      <Text style={styles.callButtonText}>Call to book</Text>
                    </TouchableOpacity>
                  )}
              </View>
            </View>
          ))}

          {/* 더보기 버튼 (다음 페이지가 있을 때만) */}
          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={loadMoreClinics}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Text style={styles.loadMoreButtonText}>
                  Load more ({clinics.length}/{total})
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        )}
      </View>
      </ScrollView>

      {/* 날짜 선택 모달 */}
      {renderDatePicker()}

      {/* 시간 선택 모달 */}
      {renderTimePicker()}

      {/* 예약 목록 모달 */}
      <Modal
        visible={showAppointmentsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAppointmentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My appointments ({appointments.length})</Text>
              <TouchableOpacity onPress={() => setShowAppointmentsModal(false)}>
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {appointmentsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.loadingText}>Loading appointments...</Text>
                </View>
              ) : appointmentsError ? (
                <View style={styles.errorContainer}>
                  <Icon name="error" size={48} color="#ef4444" />
                  <Text style={styles.errorMessage}>{appointmentsError}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={fetchAppointments}
                  >
                    <Text style={styles.retryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : appointments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="event" size={48} color="#9ca3af" />
                  <Text style={styles.emptyMessage}>No appointments.</Text>
                </View>
              ) : (
                <View style={styles.appointmentList}>
                  {appointments.map((appointment) => (
                    <View key={appointment.id} style={styles.appointmentCard}>
          <View style={styles.appointmentContent}>
                        <View style={[
                          styles.appointmentIcon,
                          { backgroundColor: 
                            appointment.status === 'confirmed' ? '#dcfce7' :
                            appointment.status === 'completed' ? '#e0e7ff' :
                            appointment.status === 'cancelled' ? '#fee2e2' :
                            '#fef3c7'
                          }
                        ]}>
                          <Icon
                            name={
                              appointment.status === 'confirmed' ? 'check-circle' :
                              appointment.status === 'completed' ? 'check-circle' :
                              appointment.status === 'cancelled' ? 'cancel' :
                              'schedule'
                            }
                            size={20}
                            color={
                              appointment.status === 'confirmed' ? '#16a34a' :
                              appointment.status === 'completed' ? '#6366f1' :
                              appointment.status === 'cancelled' ? '#ef4444' :
                              '#f59e0b'
                            }
                          />
            </View>
            <View style={styles.appointmentInfo}>
                          <Text style={styles.appointmentClinic}>{appointment.clinic_name}</Text>
                          <Text style={styles.appointmentDate}>
                            {appointment.appointment_date} {appointment.appointment_time ? appointment.appointment_time.substring(0, 5) : ''}
                          </Text>
                          {appointment.symptoms && (
                            <Text style={styles.appointmentSymptoms}>Symptoms: {appointment.symptoms}</Text>
                          )}
            </View>
          </View>
                      <Icon name="chevron-right" size={20} color="#9ca3af" />
        </View>
                  ))}
      </View>
              )}
    </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#6b7280',
    fontWeight: '300',
  },
  modalContent: {
    padding: 16,
  },
  surveyHeader: {
    padding: 16,
    backgroundColor: 'white',
  },
  surveyTitle: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  surveySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  surveyCard: {
    margin: 16,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  surveyQuestion: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  surveyOptions: {
    gap: 12,
  },
  surveyOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  surveyOptionText: {
    color: '#374151',
    fontSize: 16,
  },
  surveyFooter: {
    alignItems: 'center',
    marginTop: 24,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  appointmentButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 10,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapContainer: {
    height: 192,
    backgroundColor: '#dbeafe',
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlayHint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mapOverlayText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mapIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  mapText: {
    color: 'white',
    fontSize: 16,
  },
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenMap: {
    flex: 1,
  },
  closeMapButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeMapButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  myLocationButtonFullscreen: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    width: 48,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentLocationMarker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  clinicMarkerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clinicMarker: {
    alignItems: 'center',
  },
  clinicMarkerContent: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clinicMarkerText: {
    fontSize: 20,
  },
  clinicMarkerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ef4444',
    marginTop: -2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  errorText: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  clinicList: {
    gap: 16,
  },
  loadMoreButton: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loadMoreButtonText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  clinicCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  clinicInfo: {
    gap: 12,
  },
  clinicHeader: {
    marginBottom: 8,
  },
  clinicNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  clinicNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  clinicName: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  partnerBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  partnerBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  clinicRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: {
    fontSize: 16,
  },
  ratingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  separator: {
    fontSize: 14,
    color: '#9ca3af',
  },
  distanceText: {
    fontSize: 14,
    color: '#6b7280',
  },
  clinicDetails: {
    gap: 8,
  },
  clinicDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailIcon: {
    fontSize: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  slotsSection: {
    marginTop: 8,
  },
  slotsLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  slotTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
  },
  slotText: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  bookingButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  bookingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 0,
  },
  callButton: {
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  callButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  appointmentList: {
    gap: 12,
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  appointmentIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentIconText: {
    fontSize: 20,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentClinic: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  appointmentDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  appointmentSymptoms: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  appointmentArrow: {
    color: '#9ca3af',
    fontSize: 20,
  },
  dateList: {
    gap: 12,
  },
  dateItem: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateItemSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
  },
  dateTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  // 달력
  calendar: {
    paddingBottom: 8,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNav: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  calNavText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#2563eb',
    fontWeight: '700',
  },
  calNavDisabled: {
    color: '#d1d5db',
  },
  calMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calSunday: {
    color: '#ef4444',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  calDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayAvail: {
    backgroundColor: '#eff6ff',
  },
  calDaySelected: {
    backgroundColor: '#2563eb',
  },
  calDayText: {
    fontSize: 14,
    color: '#111827',
  },
  calDayTextDisabled: {
    color: '#d1d5db',
  },
  calDayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  timeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 80,
    alignItems: 'center',
  },
  timeItemSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  timeText: {
    fontSize: 16,
    color: '#374151',
  },
  timeTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  textInputContainer: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  textInputLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
});