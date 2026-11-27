export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  domain: string;
  details?: Array<{ field: string; code: string; attemptedValue?: unknown }>;
}

const JWT_TOKEN_STORAGE_KEYS = [
  'zilox_auth_token',
  'logistock_erp_jwt_token',
  'token',
  'zilox_token',
] as const;

const SESSION_STORAGE_KEYS = [
  'logistock_erp_v3_auth_session',
  'zilox_sys_auth_session',
  'zilox_auth_session',
] as const;

export function getStoredJwtToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    for (const key of JWT_TOKEN_STORAGE_KEYS) {
      const direct = localStorage.getItem(key);
      if (direct && direct.trim()) {
        return direct.trim();
      }
    }

    for (const key of SESSION_STORAGE_KEYS) {
      const rawSession = localStorage.getItem(key);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
          return parsed.token.trim();
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  return null;
}

export function saveStoredJwtToken(token: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = typeof token === 'string' ? token.trim() : '';
    if (!cleaned) return;
    for (const key of JWT_TOKEN_STORAGE_KEYS) {
      localStorage.setItem(key, cleaned);
    }
  } catch {
    // ignore storage errors
  }
}

export function getTenantAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    if (typeof window !== 'undefined') {
      const token = getStoredJwtToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      for (const key of SESSION_STORAGE_KEYS) {
        const rawSession = localStorage.getItem(key);
        if (rawSession) {
          const session = JSON.parse(rawSession);
          if (session?.tenantSlug && !headers['X-Tenant-Slug']) {
            headers['X-Tenant-Slug'] = session.tenantSlug;
          }
          if (session?.tenantId && !headers['X-Tenant-Id']) {
            headers['X-Tenant-Id'] = session.tenantId;
          }
          if (session?.role === 'PlatformSuperAdmin') {
            headers['X-Platform-SuperAdmin'] = 'true';
          }
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  return headers;
}

export const apiClient = {
  get: async (url: string) => {
    const res = await fetch(url, {
      method: 'GET',
      headers: getTenantAuthHeaders(),
    });
    return res.json();
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: getTenantAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: getTenantAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (url: string) => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getTenantAuthHeaders(),
    });
    return res.json();
  }
};

export function extractErrorMessage(
  error: unknown,
  tErrors: (key: string, values?: Record<string, unknown>) => string
): string {
  if (error && typeof error === 'object' && 'errorCode' in error) {
    const apiError = error as ApiErrorResponse;
    return tErrors(apiError.errorCode, { domain: apiError.domain });
  }
  return tErrors('ERR.UNKNOWN_INTERNAL_ERROR');
}
