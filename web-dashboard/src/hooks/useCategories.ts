import { useState, useEffect, useCallback } from 'react';
import { getStoredCategories, getActiveTenantSlug } from '../services/storageService';

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  nameAr?: string;
  nameEn?: string;
}

export interface UseCategoriesResult {
  data: Category[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Enterprise API Hook for Tenant Categories
 * Strictly complies with Zero-Mock Rule: connects to real backend API or tenant-isolated storage.
 */
export function useCategories(tenantSlug?: string): UseCategoriesResult {
  const [data, setData] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const activeSlug = tenantSlug || getActiveTenantSlug();

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Attempt dynamic API fetch from backend
      const response = await fetch('/api/pos/categories', {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': activeSlug
        }
      });

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json)) {
          const mapped: Category[] = json.map((item: any) => ({
            id: String(item.id || item.Id || item.code || item.name),
            name: String(item.name || item.Name || item.categoryName || ''),
            code: item.code || item.Code || '',
            description: item.description || item.Description || ''
          }));
          setData(mapped);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Network failure or offline mode: proceed to tenant storage
    }

    try {
      // 2. Fetch tenant-isolated database storage
      const stored = getStoredCategories(activeSlug);
      setData(stored);
    } catch (err: unknown) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      setError(parsedError);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeSlug]);

  useEffect(() => {
    fetchCategories();

    const handleUpdate = () => {
      fetchCategories();
    };

    window.addEventListener('erp_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('erp_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchCategories]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCategories
  };
}
