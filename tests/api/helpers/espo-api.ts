import type { APIRequestContext } from '@playwright/test';
import { ENV } from '../../../playwright.config';

export class EspoApi {
  private readonly authHeaders: Record<string, string>;

  constructor(private readonly request: APIRequestContext) {
    const basic = Buffer.from(
      `${ENV.ADMIN_USER}:${ENV.ADMIN_PASS}`,
    ).toString('base64');
    this.authHeaders = { 'Espo-Authorization': basic };
  }

  async create(entity: string, data: Record<string, unknown>) {
    const res = await this.request.post(`/api/v1/${entity}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await res.json()) as { id: string } };
  }

  async get(entity: string, id: string) {
    const res = await this.request.get(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  }

  async update(entity: string, id: string, data: Record<string, unknown>) {
    const res = await this.request.put(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
      data,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  }

  async remove(entity: string, id: string) {
    const res = await this.request.delete(`/api/v1/${entity}/${id}`, {
      headers: this.authHeaders,
    });
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
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
      body: (await res.json()) as { total: number; list: Array<Record<string, unknown>> },
    };
  }
}