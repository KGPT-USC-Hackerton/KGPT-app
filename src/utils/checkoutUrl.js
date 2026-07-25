// src/utils/checkoutUrl.js
//
// Shopify hosted checkout URL 안전 검증(순수 함수, 테스트 가능).
// RN 런타임과 Jest(node)에서 동일하게 동작하도록 URL 전역에 의존하지 않고
// 문자열 기반으로 authority를 파싱한다.
//
// 규칙:
//  - 문자열이어야 한다
//  - protocol 은 https 만 허용(http 거부)
//  - userinfo(user:pass@host) 포함 URL 거부
//  - 비어 있지 않은 host 필요
//  - hostname 을 특정 도메인(myshopify.com 등)으로 제한하지 않는다
//    (Shopify hosted checkout 도메인이 달라질 수 있음)

/**
 * @param {*} url
 * @returns {boolean}
 */
export function isSafeCheckoutUrl(url) {
  if (typeof url !== 'string') {
    return false;
  }
  const trimmed = url.trim();
  if (trimmed === '') {
    return false;
  }
  // https 전용(대소문자 무시). http:// 는 거부된다.
  if (!/^https:\/\//i.test(trimmed)) {
    return false;
  }
  const schemeSep = trimmed.indexOf('://');
  const afterScheme = trimmed.slice(schemeSep + 3);
  // authority = 첫 '/', '?', '#' 이전까지
  const authority = afterScheme.split(/[/?#]/)[0];
  if (!authority) {
    return false;
  }
  // userinfo 존재(예: user:pass@host) 거부
  if (authority.indexOf('@') !== -1) {
    return false;
  }
  // host(:port 제거)
  const host = authority.split(':')[0];
  if (!host) {
    return false;
  }
  if (/\s/.test(host)) {
    return false;
  }
  return true;
}

export default isSafeCheckoutUrl;
