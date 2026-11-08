/**
 * ProductValidationSchema.ts
 * Enterprise validation rules for Product Management and 3-Tier Margin Protection.
 */

export interface PricingValidationInput {
  costPrice: number;
  sellingPrice: number;
  minSellingPrice: number;
}

export interface PricingValidationResult {
  isValid: boolean;
  errorMessage: string | null;
  fieldErrors: {
    costPrice?: string;
    sellingPrice?: string;
    minSellingPrice?: string;
  };
}

/**
 * Validates 3-Tier pricing rules:
 * Rule 1: Neither sellingPrice nor minSellingPrice can be less than costPrice.
 * Rule 2: sellingPrice must be greater than or equal to minSellingPrice.
 * Rule 3: Prices must be non-negative.
 */
export function validateProductPricing(
  input: PricingValidationInput,
  lang: 'en' | 'ar' = 'ar'
): PricingValidationResult {
  const isAr = lang === 'ar';
  const { costPrice, sellingPrice, minSellingPrice } = input;
  const fieldErrors: PricingValidationResult['fieldErrors'] = {};

  // Rule 0: Non-negative
  if (costPrice < 0) fieldErrors.costPrice = isAr ? 'سعر التكلفة لا يمكن أن يكون سالباً' : 'Cost cannot be negative';
  if (sellingPrice < 0) fieldErrors.sellingPrice = isAr ? 'سعر البيع لا يمكن أن يكون سالباً' : 'Selling price cannot be negative';
  if (minSellingPrice < 0) fieldErrors.minSellingPrice = isAr ? 'أقل سعر مسموح لا يمكن أن يكون سالباً' : 'Min price cannot be negative';

  if (Object.keys(fieldErrors).length > 0) {
    return {
      isValid: false,
      errorMessage: isAr ? 'لا يمكن إدخال قيم أسعار سالبة في النظام' : 'Prices cannot be negative',
      fieldErrors
    };
  }

  // Rule 1: Strict margin protection (Selling & Min Price >= Cost Price)
  if (sellingPrice < costPrice || minSellingPrice < costPrice) {
    const msg = isAr 
      ? 'لا يمكن أن يكون سعر البيع أو حد الأمان أقل من سعر التكلفة' 
      : 'Selling price and safety minimum cannot be below cost price';

    if (sellingPrice < costPrice) fieldErrors.sellingPrice = msg;
    if (minSellingPrice < costPrice) fieldErrors.minSellingPrice = msg;

    return {
      isValid: false,
      errorMessage: msg,
      fieldErrors
    };
  }

  // Rule 2: Official selling price >= Minimum allowed price
  if (sellingPrice < minSellingPrice) {
    const msg = isAr 
      ? 'سعر البيع الرسمي يجب أن يكون أكبر من أو يساوي أقل سعر مسموح' 
      : 'Official selling price must be greater than or equal to minimum allowed price';

    fieldErrors.sellingPrice = msg;
    fieldErrors.minSellingPrice = msg;

    return {
      isValid: false,
      errorMessage: msg,
      fieldErrors
    };
  }

  return {
    isValid: true,
    errorMessage: null,
    fieldErrors: {}
  };
}

