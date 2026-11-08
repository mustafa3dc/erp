export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  domain: string;
  details?: Array<{ field: string; code: string; attemptedValue?: unknown }>;
}

export function getTenantAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    if (typeof window !== 'undefined') {
      const rawSession = localStorage.getItem('logistock_erp_v3_auth_session') 
        || localStorage.getItem('zilox_sys_auth_session');
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session.token) {
          headers['Authorization'] = `Bearer ${session.token}`;
        }
        if (session.tenantSlug) {
          headers['X-Tenant-Slug'] = session.tenantSlug;
        }
        if (session.tenantId) {
          headers['X-Tenant-Id'] = session.tenantId;
        }
        if (session.role === 'PlatformSuperAdmin') {
          headers['X-Platform-SuperAdmin'] = 'true';
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
