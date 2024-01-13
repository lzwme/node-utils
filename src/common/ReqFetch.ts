import type { OutgoingHttpHeaders } from 'node:http';
import { urlFormat } from './url';
import { toLowcaseKeyObject } from './objects';
import type { AnyObject } from '../types';
import { cookieParse, cookieStringfiy } from './cookie';

interface ReqOptions extends Omit<RequestInit, 'headers'> {
  headers?: OutgoingHttpHeaders;
}

export class ReqBase {
  protected cookies: Record<string, string> = {};
  protected headers: OutgoingHttpHeaders = {
    pragma: 'no-cache',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'accept-language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4,es;q=0.2',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  };
  constructor(cookie?: string, headers?: OutgoingHttpHeaders) {
    if (cookie) this.setCookie(cookie);
    if (headers) this.setHeaders(headers);
  }
  getHeaders(urlObject?: URL, headers?: OutgoingHttpHeaders) {
    headers = {
      ...this.headers,
      ...toLowcaseKeyObject(headers),
    };

    if (urlObject) {
      if (!headers.host) headers.host = urlObject.host;
      if (!headers.origin) headers.origin = urlObject.origin || `${urlObject.protocol}://${urlObject.hostname}`;
    }

    if (!headers.cookie && Object.keys(this.cookies).length > 0) headers.cookie = this.getCookie() as string;

    return headers;
  }
  setHeaders(headers: OutgoingHttpHeaders) {
    if (headers) this.headers = Object.assign(this.headers, toLowcaseKeyObject(headers));
    return this;
  }
  setCookie(cookie: string, reset = false) {
    if (reset) this.cookies = {};
    Object.assign(this.cookies, cookieParse(cookie));
    return this;
  }
  getCookie(isString = true) {
    return isString ? cookieStringfiy(this.cookies) : this.cookies;
  }
}

export class ReqFetch extends ReqBase {
  static instance: ReqFetch;
  static getInstance() {
    if (!this.instance) this.instance = new ReqFetch();
    return this.instance;
  }
  constructor(cookie?: string, headers?: OutgoingHttpHeaders) {
    super(cookie, headers);
  }
  req(url: string | URL, parameters?: AnyObject, options: ReqOptions = {}) {
    const urlObject = typeof url === 'string' ? new URL(url) : url;
    options = { ...options, headers: this.getHeaders(urlObject, options.headers) };

    if (parameters) {
      options.body = String(options.headers!['content-type']).includes('application/json')
        ? JSON.stringify(parameters)
        : new URLSearchParams(parameters as Record<string, string>).toString();
      options.headers!['content-length'] = Buffer.byteLength(options.body).toString();
    }

    return fetch(urlObject, options as never);
  }
  async request<T = AnyObject>(method: string, url: string | URL, parameters?: AnyObject, options?: ReqOptions) {
    const response = await this.req(url, parameters, { ...options, method });
    const buffer = await response.arrayBuffer();
    const str = new TextDecoder().decode(buffer);
    const r = { response, buffer, data: str as T };
    try {
      r.data = JSON.parse(str);
    } catch {
      r.data = str as T;
    }
    return r;
  }
  get<T = AnyObject>(url: string, parameters?: AnyObject, headers?: OutgoingHttpHeaders, options?: ReqOptions) {
    return this.request<T>('GET', urlFormat(url, parameters), void 0, { ...options, headers: { ...options?.headers, ...headers } });
  }
  post<T = AnyObject>(url: string, parameters: AnyObject, headers?: OutgoingHttpHeaders, options?: ReqOptions) {
    return this.request<T>('POST', url, parameters, { ...options, headers: { ...options?.headers, ...headers } });
  }
}
