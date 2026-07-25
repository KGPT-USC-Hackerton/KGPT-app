// __tests__/services/agentService.test.js
// agentService 단위 테스트 (fetch mock 기반, 실제 네트워크/Secret 없음).
// 테스트 값은 모두 명백한 가짜(*.invalid).
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    AGENT_DEMO_TOKEN: 'fake-agent-token.invalid',
    API_BASE_URL: 'https://api.invalid/api',
  },
}));

import Config from 'react-native-config';
import { createSession } from '../../src/services/agentService';

const FAKE_TOKEN = 'fake-agent-token.invalid';

function mockFetchOnce({ ok = true, status = 200, json }) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => json,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('agentService', () => {
  test('createSession: Authorization Bearer + Idempotency-Key, user_id 미전송, data 언랩', async () => {
    mockFetchOnce({ json: { success: true, data: { status: 'ready', session_id: 'sess.invalid' } } });

    const data = await createSession(
      { history_id: 'hist-1', survey_session_id: 'surv-1' },
      'idem-session-1',
    );
    expect(data).toEqual({ status: 'ready', session_id: 'sess.invalid' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.invalid/api/agent/sessions');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(opts.headers['Idempotency-Key']).toBe('idem-session-1');

    const body = JSON.parse(opts.body);
    expect(body).toEqual({ history_id: 'hist-1', survey_session_id: 'surv-1' });
    expect('user_id' in body).toBe(false);
    expect(JSON.stringify(global.fetch.mock.calls[0])).not.toContain('user_id');
  });

  test('createSession: survey_session_id 없으면 body에 포함하지 않음', async () => {
    mockFetchOnce({ json: { success: true, data: { status: 'ready', session_id: 's' } } });
    await createSession({ history_id: 'hist-1' }, 'k');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ history_id: 'hist-1' });
  });

  test('실패 envelope의 error_code 보존', async () => {
    mockFetchOnce({
      ok: false,
      status: 409,
      json: { success: false, error_code: 'INVALID_HISTORY', message: '변경됨' },
    });
    await expect(
      createSession({ history_id: 'h' }, 'k'),
    ).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_HISTORY' });
  });

  test('AbortError → AGENT_TIMEOUT(408)', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    await expect(createSession({ history_id: 'h' }, 'k')).rejects.toMatchObject({
      status: 408,
      errorCode: 'AGENT_TIMEOUT',
    });
  });

  test('네트워크 오류 → NETWORK_ERROR, 자동 retry 0회 (fetch 1회)', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network request failed'));
    await expect(
      createSession({ history_id: 'h' }, 'k'),
    ).rejects.toMatchObject({ status: 0, errorCode: 'NETWORK_ERROR' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('토큰 없으면 네트워크 요청 0회 + AGENT_TOKEN_MISSING + 값 로그 0회', async () => {
    const original = Config.AGENT_DEMO_TOKEN;
    delete Config.AGENT_DEMO_TOKEN;
    const fetchSpy = (global.fetch = jest.fn());
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(createSession({ history_id: 'h' }, 'k')).rejects.toMatchObject({
        errorCode: 'AGENT_TOKEN_MISSING',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errSpy).not.toHaveBeenCalled();
    } finally {
      Config.AGENT_DEMO_TOKEN = original;
    }
  });

  test('Secret 토큰 문자열을 로그하지 않는다', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchOnce({ json: { success: true, data: {} } });
    await createSession({ history_id: 'h' }, 'k');
    const logged = [...logSpy.mock.calls, ...errSpy.mock.calls].flat().join(' ');
    expect(logged).not.toContain(FAKE_TOKEN);
  });
});
