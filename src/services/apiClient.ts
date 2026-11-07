import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * The one Axios instance every service uses.
 *
 *  - Base URL: VITE_API_URL, else http://localhost:3000/api. It already ends in
 *    `/api`, so service paths are written WITHOUT it ("/tasks", not "/api/tasks").
 *  - Requests carry `Authorization: Bearer <accessToken>` when a token is stored.
 *  - Failures reject with an `ApiError` (one shape for HTTP errors, network
 *    errors and timeouts). A 401 clears the stored session and sends the user
 *    to /login. Cancelled requests (AbortSignal) reject untouched.
 */

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export const DEFAULT_API_URL = 'http://localhost:3000/api';

/** `||` (not `??`) so an empty VITE_API_URL also falls back to the default. */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export const DEFAULT_TIMEOUT_MS = 15_000;

/** localStorage key that holds the JWT. */
export const ACCESS_TOKEN_KEY = 'accessToken';

/**
 * Everything removed from localStorage when the session ends. Only these keys
 * are removed (not the whole storage), so unrelated preferences survive. Add a
 * key here if login stores anything else (e.g. a cached profile).
 */
export const AUTH_STORAGE_KEYS: readonly string[] = [ACCESS_TOKEN_KEY];

export const LOGIN_PATH = '/login';

/** Pages where an expired session must not trigger another redirect. */
const AUTH_PAGE_PATHS: readonly string[] = [LOGIN_PATH, '/signup'];

/** Options every service method accepts. */
export interface RequestOptions {
  /** Abort the request, e.g. when a component unmounts. An aborted request rejects with Axios' CanceledError, not ApiError. */
  signal?: AbortSignal;
}

/* -------------------------------------------------------------------------- */
/* Token storage (localStorage can throw: private mode, blocked storage)      */
/* -------------------------------------------------------------------------- */

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Call after a successful login. */
export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // storage unavailable: the session just won't survive a reload
  }
  isUnauthorizedHandled = false; // a new session: 401s must be handled again
}

export function clearAuthStorage(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing to clear
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'unknown';

/**
 * The only error type services reject with (besides cancellations).
 * `status` is the HTTP status, or 0 when there was no HTTP response.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Individual messages, e.g. one per failed validation rule (NestJS returns an array). */
  readonly details: string[];

  constructor(
    init: { kind: ApiErrorKind; status: number; message: string; details?: string[] },
    options?: { cause?: unknown }
  ) {
    super(init.message, options);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.details = init.details ?? [];
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 400 / 422: the server rejected the data; `details` says why. */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True for requests aborted through an AbortSignal; usually safe to ignore. */
export function isRequestCanceled(error: unknown): boolean {
  return axios.isCancel(error);
}

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'The request was not valid.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you asked for.',
  409: 'That conflicts with existing data.',
  422: 'Some of the data was not valid.',
};

/** NestJS error bodies are `{ statusCode, message: string | string[], error }`; plain-text bodies are used only if short. */
function readServerMessages(data: unknown): string[] {
  if (typeof data === 'string') {
    const text = data.trim();
    return text !== '' && text.length <= 200 && !text.startsWith('<') ? [text] : [];
  }
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const { message } = data as { message: unknown };
    if (typeof message === 'string') return [message];
    if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError(
      { kind: 'unknown', status: 0, message: error instanceof Error ? error.message : 'Something went wrong.' },
      { cause: error }
    );
  }

  const response = error.response;
  if (!response) {
    const timedOut = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT;
    return new ApiError(
      {
        kind: timedOut ? 'timeout' : 'network',
        status: 0,
        message: timedOut
          ? 'The server took too long to respond. Please try again.'
          : 'Cannot reach the server. Check your connection and try again.',
      },
      { cause: error }
    );
  }

  const body: unknown = response.data;
  const details = readServerMessages(body);
  const fallback = STATUS_MESSAGES[response.status] ?? (response.status >= 500 ? 'The server had a problem. Please try again.' : 'The request failed.');
  return new ApiError(
    { kind: 'http', status: response.status, message: details.length > 0 ? details.join('; ') : fallback, details },
    { cause: error }
  );
}

/**
 * Guards a list endpoint: a body that is not an array (for example an
 * `{ items: [...] }` envelope) fails loudly here instead of as ".map is not a
 * function" somewhere in a component.
 */
export function ensureArray<T>(data: unknown, endpoint: string): T[] {
  if (!Array.isArray(data)) {
    throw new ApiError({ kind: 'invalid-response', status: 0, message: `${endpoint} did not return a list.` });
  }
  return data as T[];
}

/* -------------------------------------------------------------------------- */
/* 401 handling                                                               */
/* -------------------------------------------------------------------------- */

type UnauthorizedHandler = () => void;

/** Full-page redirect: also drops any in-memory state that belonged to the old session. */
const redirectToLogin: UnauthorizedHandler = () => {
  window.location.assign(LOGIN_PATH);
};

let unauthorizedHandler: UnauthorizedHandler = redirectToLogin;
let isUnauthorizedHandled = false;

/**
 * Replaces what happens after a 401 (default: full-page redirect to /login).
 * Plug react-router in to navigate without a reload, e.g.
 * `setUnauthorizedHandler(() => navigate('/login', { replace: true }))`.
 * Pass `null` to restore the default.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler ?? redirectToLogin;
  isUnauthorizedHandled = false;
}

/** A 401 from login/register means "wrong credentials", not "session expired": it must not log anyone out. */
function isCredentialsEndpoint(url: string | undefined): boolean {
  return url !== undefined && /\/auth\/(login|register)\/?(\?.*)?$/i.test(url);
}

function onAuthPage(): boolean {
  return typeof window !== 'undefined' && AUTH_PAGE_PATHS.includes(window.location.pathname);
}

function handleUnauthorized(): void {
  clearAuthStorage();
  // Several requests can fail together: redirect once.
  if (isUnauthorizedHandled) return;
  isUnauthorizedHandled = true;
  if (onAuthPage()) return;
  unauthorizedHandler();
}

/* -------------------------------------------------------------------------- */
/* Instance                                                                   */
/* -------------------------------------------------------------------------- */

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  // An explicit Authorization header on a call wins over the stored token.
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    isUnauthorizedHandled = false; // the session works again
    return response;
  },
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const apiError = toApiError(error);
    const url = axios.isAxiosError(error) ? error.config?.url : undefined;
    if (apiError.status === 401 && !isCredentialsEndpoint(url)) handleUnauthorized();
    return Promise.reject(apiError);
  }
);

export default apiClient;
