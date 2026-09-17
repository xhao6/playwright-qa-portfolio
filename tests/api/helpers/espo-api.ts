import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ENV } from '../../../playwright.config';

export function basicAuthHeader(user = ENV.ADMIN_USER, pass = ENV.ADMIN_PASS) {
  return {
    'Espo-Authorization': Buffer.from(`${user}:${pass}`).toString('base64'),
  };
}

export class EspoApi {
  private readonly authHeaders: Record<string, string>;

  constructor(private readonly request: APIRequestContext) {
    this.authHeaders = basicAuthHeader();
  }

  private async readBody(res: APIResponse): Promise<unknown> {
    const contentType = res.headers()['content-type'] ?? '';
    if (!contentType.includes('application/json')) return {};
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  async create(entity: string, data: Record<string, unknown>) {
    const res = await this.request.post(`/api/v1/${entity}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await this.readBody(res)) as { id: string } };
  }

  async get(entity: string, id: string) {
    const res = await this.request.get(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await this.readBody(res)) as Record<string, unknown> };
  }

  async update(entity: string, id: string, data: Record<string, unknown>) {
    const res = await this.request.put(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await this.readBody(res)) as Record<string, unknown> };
  }

  async remove(entity: string, id: string) {
    const res = await this.request.delete(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await this.readBody(res)) as boolean };
  }

  async search(entity: string, attribute: string, value: string) {
    const res = await this.request.get(`/api/v1/${entity}`, {
      headers: this.authHeaders,
      params: {
        'where[0][type]': 'contains',
        'where[0][attribute]': attribute,
        'where[0][value]': value,
      },
    });
    return {
      status: res.status(),
      body: (await this.readBody(res)) as { total: number; list: Array<Record<string, unknown>> },
    };
  }
}
