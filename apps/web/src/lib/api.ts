import { getEncryptedItem } from './storage';

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const apiProtocol = protocol === 'https:' ? 'https:' : 'http:';
    return `${apiProtocol}//${hostname}:4001`;
  }

  return 'http://localhost:4001';
}

export function getAuthenticatedHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  const token = getEncryptedItem('auth_token');

  if (token) {
    result.set('Authorization', `Bearer ${token}`);
  }

  return result;
}

export function getNetworkErrorMessage() {
  const baseUrl = getApiBaseUrl();
  return `NetworkError: unable to reach backend at ${baseUrl}. Please start server and try again.`;
}

export async function getSessionHealthStatus(token: string): Promise<'valid' | 'invalid' | 'unreachable'> {
  const baseUrl = getApiBaseUrl();

  try {
    const healthResponse = await fetch(`${baseUrl}/health`, {
      cache: 'no-store',
    });

    if (!healthResponse.ok) {
      return 'unreachable';
    }

    const response = await fetch(`${baseUrl}/auth/session`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return 'valid';
    }

    if (response.status === 401 || response.status === 403) {
      return 'invalid';
    }

    return 'invalid';
  } catch {
    return 'unreachable';
  }
}
