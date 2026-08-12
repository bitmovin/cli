import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

vi.mock('../../src/lib/client.js', () => ({
  getAuthHeaders: async () => ({'X-Api-Key': 'test-key', 'X-Api-Client': 'bitmovin-cli'}),
}));

const {apiRequest, BitmovinRestError} = await import('../../src/lib/rest.js');

function mockFetch(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiRequest', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('unwraps the data.result envelope and builds the query string', async () => {
    const fetchMock = mockFetch(200, {requestId: 'req-1', status: 'SUCCESS', data: {result: {items: [{caseId: 1}]}}});

    const result = await apiRequest<{items: {caseId: number}[]}>('/support/tickets', {
      query: {limit: 25, offset: 0, status: 'open', severity: undefined},
    });

    expect(result.items[0].caseId).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.bitmovin.com/v1/support/tickets?limit=25&offset=0&status=open');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('test-key');
    expect((init.headers as Record<string, string>)['X-Api-Client']).toBe('bitmovin-cli');
    expect(init.headers).not.toHaveProperty('X-Tenant-Org-Id');
  });

  it('sends X-Tenant-Org-Id and a JSON body for POSTs', async () => {
    const fetchMock = mockFetch(200, {status: 'SUCCESS', data: {result: {id: 42}}});

    await apiRequest('/support/tickets', {method: 'POST', body: {body: 'hi'}, tenantOrgId: 'org-9'});

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Tenant-Org-Id']).toBe('org-9');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"body":"hi"}');
  });

  it('maps an error envelope onto a BitmovinRestError carrying the targeted organization', async () => {
    mockFetch(403, {
      requestId: 'req-2',
      status: 'ERROR',
      data: {code: 1003, message: 'Access denied', developerMessage: 'Check your API key.'},
    });

    const error = await apiRequest('/support/tickets', {tenantOrgId: 'org-9'}).catch((err) => err);
    expect(error).toBeInstanceOf(BitmovinRestError);
    expect(error.httpStatusCode).toBe(403);
    expect(error.errorCode).toBe(1003);
    expect(error.message).toBe('Access denied');
    expect(error.developerMessage).toBe('Check your API key.');
    expect(error.requestId).toBe('req-2');
    expect(error.tenantOrgId).toBe('org-9');
  });

  it('falls back to the raw body when the error response is not an envelope', async () => {
    mockFetch(502, 'gateway exploded');

    const error = await apiRequest('/support/tickets').catch((err) => err);
    expect(error.httpStatusCode).toBe(502);
    expect(error.message).toContain('HTTP 502');
    expect(error.developerMessage).toBe('gateway exploded');
  });
});
