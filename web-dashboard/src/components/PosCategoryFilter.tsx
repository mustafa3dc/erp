import React from 'react';
import { Button } from './ui/button';
import { useCategories } from '../hooks/useCategories';

export interface PosCategoryFilterProps {
  selectedCategory: string;
  setSelectedCategory: (categoryId: string) => void;
  lang?: 'en' | 'ar';
  className?: string;
}

const CATEGORY_MAP: Record<string, { ar: string; en: string }> = {
  'شبكات وتمديدات': { ar: 'شبكات وتمديدات', en: 'Networks & Cabling' },
  'شاشات': { ar: 'شاشات', en: 'Monitors & Displays' },
  'إلكترونيات وشاشات': { ar: 'إلكترونيات وشاشات', en: 'Electronics & Screens' },
  'أجهزة حاسوب ومحمول': { ar: 'أجهزة حاسوب ومحمول', en: 'Computers & Laptops' },
  'طاقة وحماية كهربائية': { ar: 'طاقة وحماية كهربائية', en: 'Power & Protection' },
  'ملحقات وإكسسوارات': { ar: 'ملحقات وإكسسوارات', en: 'Accessories & Peripherals' },
  'طابعات وتجهيزات مكتبية': { ar: 'طابعات وتجهيزات مكتبية', en: 'Printers & Office Equipment' },
  'عام وغير مصنف': { ar: 'عام وغير مصنف', en: 'General' },
};

/**
 * POS Top Bar / Product Filter Bar
 * Dynamically binds to tenant categories fetched via useCategories hook.
 * Strictly adheres to Zero-Mock rules: NO hardcoded category arrays.
 */
export default function PosCategoryFilter({
  selectedCategory,
  setSelectedCategory,
  lang = 'ar',
  className = ''
}: PosCategoryFilterProps) {
  const isAr = lang === 'ar';
  const { data: categories = [] } = useCategories();

  return (
    <div 
      className={`flex items-center gap-1.5 overflow-x-auto py-1 select-none ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ display: 'flex', gap: '6px', overflowX: 'auto', alignItems: 'center' }}
    >
      {/* Default Primary 'All' Button */}
      <Button
        key="ALL"
        type="button"
        onClick={() => setSelectedCategory('ALL')}
        variant={selectedCategory === 'ALL' ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-3.5 text-xs font-semibold shrink-0 cursor-pointer transition-all shadow-xs"
      >
        {isAr ? 'الكل' : 'All'}
      </Button>

      {/* Dynamic Tenant Categories (Rendered strictly from active database/API with bilingual mapping) */}
      {categories.map((category) => {
        const catName = isAr 
          ? (category.nameAr || CATEGORY_MAP[category.name]?.ar || category.name) 
          : (category.nameEn || CATEGORY_MAP[category.name]?.en || category.name);

        return (
          <Button 
            key={category.id} 
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            className="h-8 px-3.5 text-xs font-semibold shrink-0 cursor-pointer transition-all shadow-xs"
          >
            {catName}
          </Button>
        );
      })}
    </div>
  );
}
