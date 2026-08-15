import { User } from '../types';

let authToken: string | null = localStorage.getItem('agri_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('agri_token', token);
  } else {
    localStorage.removeItem('agri_token');
  }
}

export function getAuthToken(): string | null {
  return authToken || localStorage.getItem('agri_token');
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
  const currentToken = getAuthToken();
  if (currentToken && !authToken) {
    authToken = currentToken;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${text.slice(0, 150)}`);
      }
      throw new Error(`Expected JSON from ${endpoint}, but received non-JSON (${contentType || 'text/html'})`);
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || `API error (${response.status})`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    // Retry on transient fetch errors (e.g. while server is rebooting or network reconnecting)
    if (retries > 0 && (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return apiRequest<T>(endpoint, options, retries - 1);
    }
    throw err;
  }
}
