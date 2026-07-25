// src/services/agentService.js
//
// Agent Copilot(6B) 전용 API 클라이언트.
// - 인증: Config.AGENT_DEMO_TOKEN 을 Authorization: Bearer 로만 사용(서버가 사용자 결정).
//   user_id / 의료정보 / 설문 답변 원문을 절대 전송하지 않는다.
// - 응답 envelope({ success, data } / { success:false, error_code, message }) 언랩.
// - 요청별 AbortController 타임아웃(약 15s). 자동 retry 없음(특히 POST /shopify-cart).
// - Token 값은 로그/출력하지 않는다.
import Config from 'react-native-config';

const DEFAULT_TIMEOUT_MS = 15000;

function getToken() {
  // 값은 반환만 하고 절대 로그하지 않는다.
  return Config && Config.AGENT_DEMO_TOKEN ? Config.AGENT_DEMO_TOKEN : null;
}

function getBaseUrl() {
  return Config && Config.API_BASE_URL ? Config.API_BASE_URL : null;
}

// 표준화된 에러(값 비노출). status / errorCode / message (+선택 cartRequestId).
function makeAgentError(status, errorCode, message, extra = {}) {
  const err = new Error(message || 'AGENT_ERROR');
  err.status = typeof status === 'number' ? status : 0;
  err.errorCode = errorCode || null;
  if (extra && extra.cartRequestId) {
    err.cartRequestId = extra.cartRequestId;
  }
  return err;
}

// 공통 Agent fetch 래퍼. 자동 retry 없음.
async function agentFetch(method, endpoint, { body, idempotencyKey, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = getToken();
  if (!token) {
    // 토큰 미설정: 네트워크 요청을 보내지 않고 안전한 설정 오류를 던진다(값 비노출).
    throw makeAgentError(0, 'AGENT_TOKEN_MISSING', 'Agent 데모 토큰이 설정되지 않았습니다. 개발 설정을 확인해 주세요.');
  }
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw makeAgentError(0, 'API_BASE_URL_MISSING', 'API 기본 주소가 설정되지 않았습니다. 개발 설정을 확인해 주세요.');
  }

  const url = `${baseUrl}${endpoint}`;

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    // 앱의 다른 호출과 동일하게 ngrok 경고 페이지 우회.
    'ngrok-skip-browser-warning': 'true',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error && error.name === 'AbortError') {
      throw makeAgentError(408, 'AGENT_TIMEOUT', '응답이 지연되고 있어요. 다시 시도해 주세요.');
    }
    // 네트워크 오류. 자동 재시도하지 않는다.
    throw makeAgentError(0, 'NETWORK_ERROR', '네트워크 연결을 확인해 주세요.');
  }
  clearTimeout(timeoutId);

  let json;
  try {
    json = await response.json();
  } catch (e) {
    throw makeAgentError(response.status || 0, 'INVALID_RESPONSE', '일시적인 오류가 발생했어요. 다시 시도해 주세요.');
  }

  if (!json || typeof json !== 'object') {
    throw makeAgentError(response.status || 0, 'INVALID_RESPONSE', '일시적인 오류가 발생했어요. 다시 시도해 주세요.');
  }

  // 2xx + success:true 만 성공으로 취급한다. data 만 반환(내부 비밀 필드는 백엔드가 이미 제외).
  if (response.ok && json.success === true) {
    return json.data;
  }

  const errorCode = typeof json.error_code === 'string' ? json.error_code : null;
  const message = typeof json.message === 'string' ? json.message : '요청 처리 중 오류가 발생했습니다.';
  throw makeAgentError(response.status || 0, errorCode, message, {
    cartRequestId: typeof json.cart_request_id === 'string' ? json.cart_request_id : undefined,
  });
}

/**
 * POST /agent/sessions
 * @param {{ history_id: string, survey_session_id?: string }} params  (user_id 금지)
 * @param {string} idempotencyKey  sessionCreateKey
 */
export async function createSession({ history_id, survey_session_id } = {}, idempotencyKey) {
  const body = { history_id };
  if (survey_session_id) {
    body.survey_session_id = survey_session_id;
  }
  return agentFetch('POST', '/agent/sessions', { body, idempotencyKey });
}

/**
 * GET /agent/sessions/:sessionId/product-recommendations
 */
export async function getProductRecommendations(sessionId) {
  return agentFetch('GET', `/agent/sessions/${encodeURIComponent(sessionId)}/product-recommendations`, {});
}

/**
 * POST /agent/sessions/:sessionId/shopify-cart
 * body 는 { confirmed:true, proposal_hash, items:[{product_key, quantity}] } 만 전송한다.
 * (display_name / user_id / 의료정보 금지). 자동 retry 없음.
 * @param {string} idempotencyKey  cartCreateKey
 */
export async function createShopifyCart(sessionId, { proposal_hash, items } = {}, idempotencyKey) {
  const body = {
    confirmed: true,
    proposal_hash,
    items: (items || []).map((it) => ({ product_key: it.product_key, quantity: it.quantity })),
  };
  return agentFetch('POST', `/agent/sessions/${encodeURIComponent(sessionId)}/shopify-cart`, { body, idempotencyKey });
}

export default {
  createSession,
  getProductRecommendations,
  createShopifyCart,
};
