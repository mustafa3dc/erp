import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/rbac';
import { getStoredAuthSession, safeSet, KEYS } from '../services/storageService';
import { queryClient } from './useUsersQuery';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredAuthSession());

  const refreshUser = useCallback(() => {
    const session = getStoredAuthSession();
    setCurrentUser(session);
  }, []);

  useEffect(() => {
    const handleInvalidate = (e: Event) => {
      const customEvent = e as CustomEvent<{ queryKey: string[] }>;
      if (!customEvent.detail || customEvent.detail.queryKey.some(k => k === 'currentUser' || k === 'auth')) {
        refreshUser();
      }
    };

    window.addEventListener('zilox_query_invalidate', handleInvalidate);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('zilox_query_invalidate', handleInvalidate);
      window.removeEventListener('storage', refreshUser);
    };
  }, [refreshUser]);

  const updateAvatar = async (avatarUrl: string): Promise<boolean> => {
    if (!currentUser) return false;

    // 1. Optimistic update of local session
    const updatedUser: UserProfile = {
      ...currentUser,
      avatarUrl
    };
    safeSet(KEYS.AUTH_SESSION, updatedUser);
    setCurrentUser(updatedUser);

    // 2. Call backend API if possible
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');
      await fetch(`/api/v1/users/${currentUser.id}/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ avatarUrl })
      });
    } catch {
      // Fallback gracefully
    }

    // 3. Invalidate cache across topbar and users table
    await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    return true;
  };

  return {
    currentUser,
    setCurrentUser,
    refreshUser,
    updateAvatar
  };
}

export default useAuth;

