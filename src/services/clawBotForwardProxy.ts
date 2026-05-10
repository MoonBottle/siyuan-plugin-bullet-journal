import { fetchSyncPost } from 'siyuan';

type ForwardProxyParams = {
  url: string;
  method?: string;
  timeout?: number;
  contentType?: string;
  headers?: Record<string, string>[];
  payload?: any;
  payloadEncoding?: string;
  responseEncoding?: string;
};

type ForwardProxyResult = {
  status: number;
  contentType: string;
  body: string;
  bodyEncoding: string;
  headers: Record<string, string>;
  url: string;
  elapsed: number;
};

type ForwardProxyBinaryResult = {
  status: number;
  contentType: string;
  body: ArrayBuffer;
};

const API_PATH = '/api/network/forwardProxy';
const DEFAULT_TIMEOUT = 7000;
const LONG_POLL_TIMEOUT = 60000;

export async function forwardProxy(params: ForwardProxyParams): Promise<ForwardProxyResult> {
  const body: Record<string, any> = {
    url: params.url,
    method: params.method ?? 'GET',
    timeout: params.timeout ?? DEFAULT_TIMEOUT,
    contentType: params.contentType ?? 'application/json',
    headers: params.headers ?? [],
    payload: params.payload ?? '',
    payloadEncoding: params.payloadEncoding ?? 'text',
    responseEncoding: params.responseEncoding ?? 'text',
  };

  const response = await fetchSyncPost(API_PATH, body) as any;

  if (response?.code !== 0) {
    throw new Error(response?.msg ?? 'forwardProxy request failed');
  }

  return response.data as ForwardProxyResult;
}

export async function forwardProxyBinary(params: ForwardProxyParams): Promise<ForwardProxyBinaryResult> {
  const result = await forwardProxy({
    ...params,
    responseEncoding: 'base64',
  });

  const binary = result.bodyEncoding === 'base64'
    ? Uint8Array.from(atob(result.body), c => c.charCodeAt(0))
    : new TextEncoder().encode(result.body);

  return {
    status: result.status,
    contentType: result.contentType,
    body: binary.buffer,
  };
}

export async function forwardProxyLongPoll(params: Omit<ForwardProxyParams, 'timeout'>): Promise<ForwardProxyResult> {
  return forwardProxy({ ...params, timeout: LONG_POLL_TIMEOUT });
}

export async function isForwardProxyAvailable(): Promise<boolean> {
  try {
    const response = await fetchSyncPost(API_PATH, {
      url: 'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
      method: 'GET',
      timeout: 3000,
    }) as any;
    return response?.code === 0;
  } catch {
    return false;
  }
}