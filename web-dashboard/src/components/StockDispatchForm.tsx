import React, { useState } from 'react';
import { apiClient, extractErrorMessage } from '../lib/api-client';

interface DispatchFormProps {
  warehouseId: string;
  itemId: string;
  onSuccess: (movementId: string) => void;
}

export const StockDispatchForm: React.FC<DispatchFormProps> = ({ warehouseId, itemId, onSuccess }) => {
  const [quantity, setQuantity] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/api/inventory/dispatch', {
        warehouseId,
        itemId,
        quantity: parseFloat(quantity),
      });

      if (response && response.success) {
        onSuccess(response.movementId);
        setQuantity('');
      } else {
        setErrorMessage(response?.message || 'Error occurred');
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, (key) => key));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="dispatch-form">
      {errorMessage && (
        <div className="error-banner" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={loading}
          placeholder="0.00"
        />
      </div>

      <button type="submit" disabled={loading || !quantity}>
        {loading ? 'Processing...' : 'Dispatch Stock'}
      </button>
    </form>
  );
};
