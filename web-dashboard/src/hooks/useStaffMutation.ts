import { useState } from 'react';
import { queryClient } from './useUsersQuery';
import { deleteUserAccount, toggleUserStatus } from '../services/storageService';

export function useDeleteStaffMutation() {
  const [isDeleting, setIsDeleting] = useState(false);

  const mutateAsync = async (userId: string): Promise<boolean> => {
    setIsDeleting(true);
    const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');

    try {
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      // Synchronize persistent local record
      deleteUserAccount(userId);

      // Invalidate cache immediately so row vanishes cleanly
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      return response.ok;
    } catch {
      deleteUserAccount(userId);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      return true;
    } finally {
      setIsDeleting(false);
    }
  };

  return { mutateAsync, isDeleting };
}

export function useToggleStaffStatusMutation() {
  const [isUpdating, setIsUpdating] = useState(false);

  const mutateAsync = async (userId: string): Promise<boolean> => {
    setIsUpdating(true);
    const token = localStorage.getItem('token') || localStorage.getItem('zilox_token');

    try {
      await fetch(`/api/v1/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const nextStatus = toggleUserStatus(userId);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      return nextStatus;
    } catch {
      const nextStatus = toggleUserStatus(userId);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      return nextStatus;
    } finally {
      setIsUpdating(false);
    }
  };

  return { mutateAsync, isUpdating };
}

