import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDatadog, isEnabled, isReadEnabled, sendLogs, searchLogs, sendEvent, sendMetrics, resetConfig } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Datadog client', () => {
  beforeEach(() => {
    resetConfig();
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    resetConfig();
    vi.unstubAllEnvs();
  });

  describe('initDatadog', () => {
    it('returns null when DATADOG_API_KEY is not set', () => {
      expect(initDatadog()).toBeNull();
      expect(isEnabled()).toBe(false);
    });

    it('returns config when DATADOG_API_KEY is set', () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      const cfg = initDatadog();
      expect(cfg).not.toBeNull();
      expect(cfg!.apiKey).toBe('test-key');
      expect(cfg!.site).toBe('datadoghq.com');
      expect(isEnabled()).toBe(true);
    });

    it('reads DD_APPLICATION_KEY for read path', () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      vi.stubEnv('DD_APPLICATION_KEY', 'app-key');
      initDatadog();
      expect(isReadEnabled()).toBe(true);
    });

    it('isReadEnabled is false without application key', () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      expect(isReadEnabled()).toBe(false);
    });

    it('uses custom DD_SITE', () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      vi.stubEnv('DD_SITE', 'datadoghq.eu');
      const cfg = initDatadog();
      expect(cfg!.site).toBe('datadoghq.eu');
    });
  });

  describe('sendLogs', () => {
    it('is a no-op when disabled', async () => {
      await sendLogs([{ message: 'test', ddsource: 'console', ddtags: '', hostname: 'h', service: 's', status: 'info' }]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends POST to logs intake when enabled', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      mockFetch.mockResolvedValueOnce({ ok: true });

      const payload = [{ message: 'test', ddsource: 'console', ddtags: 'env:test', hostname: 'h', service: 's', status: 'info' }];
      await sendLogs(payload);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://http-intake.logs.datadoghq.com/api/v2/logs');
      expect(opts.method).toBe('POST');
      expect(opts.headers['DD-API-KEY']).toBe('test-key');
      expect(JSON.parse(opts.body)).toEqual(payload);
    });

    it('logs error on non-ok response', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await sendLogs([{ message: 'test', ddsource: 'console', ddtags: '', hostname: 'h', service: 's', status: 'info' }]);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('sendLogs failed'));
      spy.mockRestore();
    });
  });

  describe('searchLogs', () => {
    it('returns null when read is not enabled', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      const result = await searchLogs({ filter: { query: 'test', from: '2026-01-01T00:00:00Z' } });
      expect(result).toBeNull();
    });

    it('sends POST to logs search endpoint with both keys', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      vi.stubEnv('DD_APPLICATION_KEY', 'app-key');
      initDatadog();

      const mockResponse = { data: [], meta: {} };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponse) });

      const request = { filter: { query: '@dispatch_worker_id:w1', from: '2026-01-01T00:00:00Z' } };
      const result = await searchLogs(request);

      expect(result).toEqual(mockResponse);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.datadoghq.com/api/v2/logs/events/search');
      expect(opts.headers['DD-API-KEY']).toBe('test-key');
      expect(opts.headers['DD-APPLICATION-KEY']).toBe('app-key');
    });
  });

  describe('sendEvent', () => {
    it('sends POST to events endpoint', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendEvent({ title: 'test', text: 'body', tags: ['a:b'], alert_type: 'info', source_type_name: 'dispatch' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.datadoghq.com/api/v1/events');
    });
  });

  describe('sendMetrics', () => {
    it('sends POST to series endpoint', async () => {
      vi.stubEnv('DATADOG_API_KEY', 'test-key');
      initDatadog();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendMetrics({ series: [{ metric: 'dispatch.test', type: 1, points: [{ timestamp: 1, value: 42 }], tags: [] }] });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.datadoghq.com/api/v2/series');
    });
  });
});
