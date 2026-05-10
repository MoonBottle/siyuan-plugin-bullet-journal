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

async function rawForwardProxyRequest(body: Record<string, any>): Promise<any> {
  const resp = await fetch(API_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return await resp.json();
}

export async function forwardProxy(params: ForwardProxyParams): Promise<ForwardProxyResult> {
  const body: Record<string, any> = {
    url: params.url,
    method: params.method ?? 'GET',
    timeout: params.timeout ?? DEFAULT_TIMEOUT,
    contentType: params.contentType ?? 'application/json',
    headers: params.headers ?? [],
    payload: params.payload ?? '',
  };

  if (params.payloadEncoding) {
    body.payloadEncoding = params.payloadEncoding;
  }
  if (params.responseEncoding) {
    body.responseEncoding = params.responseEncoding;
  }

  const response = await rawForwardProxyRequest(body);

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
    const response = await rawForwardProxyRequest({
      url: 'https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3',
      method: 'GET',
      timeout: 3000,
    });
    return response?.code === 0;
  } catch {
    return false;
  }
}
