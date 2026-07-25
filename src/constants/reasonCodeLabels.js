// src/constants/reasonCodeLabels.js
//
// 추천 상품의 reason_code -> 사용자용 한글 문구 매핑.
// 아래 5개는 백엔드(참조 전용, 수정 금지) V1 룰 엔진이 실제로 방출하는 reason_code다.
// 출처(읽기 전용):
//   KGPT-USC-Hackerton-Agent/BloomDent-backend-main/agent/services/productRecommendationService.js
//   KGPT-USC-Hackerton-Agent/BloomDent-backend-main/agent/catalog/hygieneProductCatalog.js
// 정책: 알 수 없는 코드는 원문을 출력하지 않고 배지를 표시하지 않는다(null 반환).
//       임의의 일반 fallback 문구를 생성하지 않는다.
const REASON_CODE_LABELS = {
  GENERAL_DAILY_HYGIENE: '매일 구강 위생 관리',
  GENTLE_BRUSHING_SUPPORT: '부드러운 칫솔질에 도움',
  CAVITY_PREVENTION_SUPPORT: '충치 예방 관리',
  FLUORIDE_HYGIENE_SUPPORT: '불소 위생 관리',
  INTERDENTAL_CLEANING_SUPPORT: '치아 사이 관리',
};

/**
 * 알려진 reason_code면 한글 문구, 아니면 null(배지 미표시).
 * @param {*} reasonCode
 * @returns {string|null}
 */
export function getReasonLabel(reasonCode) {
  if (typeof reasonCode !== 'string') {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(REASON_CODE_LABELS, reasonCode)
    ? REASON_CODE_LABELS[reasonCode]
    : null;
}

export default REASON_CODE_LABELS;
