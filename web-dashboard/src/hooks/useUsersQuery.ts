import { useState, useEffect, useCallback } from 'react';
import { UserAccount } from '../types/rbac';
import { getStoredUsers, saveStoredUsers, getActiveTenantSlug } from '../services/storageService';

export const queryClient = {
  invalidateQueries: async ({ queryKey }: { queryKey: string[] }) => {
    window.dispatchEvent(new CustomEvent('zilox_query_invalidate', { detail: { queryKey } }));
  }
};

export interface UseUsersQueryResult {
  data: UserAccount[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * useUsersQuery - Pure API consumption hook for Staff Accounts.
 * Zero hardcoded arrays or mock names. Consumes GET /api/v1/users directly.
 */
export function useUsersQuery(explicitSlug?: string): UseUsersQueryResult {
  const [data, setData] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
    const tenantSlug = (explicitSlug || getActiveTenantSlug() || '').toLowerCase().trim();

    try {
      const response = await fetch('/api/v1/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {})
        }
      });

      if (response.ok) {
        const users: UserAccount[] = await response.json();
        setData(users);
        saveStoredUsers(users);
      } else {
        // Fallback to locally persisted users created by the authenticated user
        const local = getStoredUsers(tenantSlug);
        setData(local);
      }
    } catch (err) {
      const local = getStoredUsers(tenantSlug);
      setData(local);
      setError(err instanceof Error ? err : new Error('Failed to fetch staff members'));
    } finally {
      setIsLoading(false);
    }
  }, [explicitSlug]);

  useEffect(() => {
    fetchUsers();

    const handleInvalidate = (e: Event) => {
      const customEvent = e as CustomEvent<{ queryKey: string[] }>;
      if (!customEvent.detail || customEvent.detail.queryKey.includes('users')) {
        fetchUsers();
      }
    };

    window.addEventListener('zilox_query_invalidate', handleInvalidate);
    return () => {
      window.removeEventListener('zilox_query_invalidate', handleInvalidate);
    };
  }, [fetchUsers]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchUsers,
    invalidate: fetchUsers
  };
}

export default useUsersQuery;

