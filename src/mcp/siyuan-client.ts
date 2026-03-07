/**
 * 思源 API 客户端（Node 环境）
 * 使用 fetch 调用思源 Kernel HTTP API
 */

const DEFAULT_API_URL = 'http://127.0.0.1:6806';

export interface SiYuanClientConfig {
  apiUrl?: string;
  token: string;
}

export class SiYuanClient {
  private apiUrl: string;
  private token: string;

  constructor(config: SiYuanClientConfig) {
    this.apiUrl = config.apiUrl || DEFAULT_API_URL;
    this.token = config.token;
  }

  private async request<T>(path: string, data: unknown): Promise<T | null> {
    try {
      const url = `${this.apiUrl}${path}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.token}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.code === 0) {
        return result.data as T;
      }
      console.error('[Task Assistant MCP] API non-zero:', path, 'code:', result.code, 'msg:', result.msg);
      return null;
    } catch (error) {
      console.error('[Task Assistant MCP] API request failed:', error);
      return null;
    }
  }

  /**
   * 执行 SQL 查询
   */
  async sql(stmt: string): Promise<unknown[]> {
    const data = await this.request<unknown[]>('/api/query/sql', { stmt });
    return Array.isArray(data) ? data : [];
  }

  /**
   * 获取块/文档的 Kramdown 内容
   */
  async getBlockKramdown(id: string): Promise<string | null> {
    const data = await this.request<{ kramdown?: string }>('/api/block/getBlockKramdown', { id });
    return data?.kramdown ?? null;
  }

  /**
   * 获取工作空间下文件内容（思源 /api/file/getFile）
   * 思源约定：200 时响应体即为文件内容，202 时为 { code, msg, data }。
   */
  async getFile(path: string): Promise<string | null> {
    try {
      const url = `${this.apiUrl}/api/file/getFile`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.token}`
        },
        body: JSON.stringify({ path })
      });

      if (response.status === 200) {
        return await response.text();
      }
      if (response.status === 202) {
        const result = await response.json();
        console.error('[Task Assistant MCP] getFile failed:', path, 'code:', result.code, 'msg:', result.msg);
        return null;
      }
      console.error('[Task Assistant MCP] getFile unexpected status:', response.status);
      return null;
    } catch (error) {
      console.error('[Task Assistant MCP] getFile request failed:', error);
      return null;
    }
  }
}
