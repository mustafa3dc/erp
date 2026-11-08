import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Tag, 
  X, 
  Edit3, 
  Plus, 
  Trash2, 
  Check, 
  Package, 
  AlertTriangle,
  FolderTree
} from 'lucide-react';
import { Product } from '../../types/warehouse';
import { 
  saveStoredProducts, 
  getStoredCategories, 
  saveStoredCategories, 
  StoredCategory 
} from '../../services/storageService';

export interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProducts?: (products: Product[]) => void;
  lang: string;
}

// Global bilingual dictionary for standard and enterprise categories
const CATEGORY_NAMES_MAP: Record<string, { ar: string; en: string }> = {
  'شبكات وتمديدات': { ar: 'شبكات وتمديدات', en: 'Networks & Cabling' },
  'شاشات': { ar: 'شاشات', en: 'Monitors & Displays' },
  'إلكترونيات وشاشات': { ar: 'إلكترونيات وشاشات', en: 'Electronics & Screens' },
  'أجهزة حاسوب ومحمول': { ar: 'أجهزة حاسوب ومحمول', en: 'Computers & Laptops' },
  'طاقة وحماية كهربائية': { ar: 'طاقة وحماية كهربائية', en: 'Power & Protection' },
  'ملحقات وإكسسوارات': { ar: 'ملحقات وإكسسوارات', en: 'Accessories & Peripherals' },
  'طابعات وتجهيزات مكتبية': { ar: 'طابعات وتجهيزات مكتبية', en: 'Printers & Office Equipment' },
  'عام وغير مصنف': { ar: 'عام وغير مصنف', en: 'General / Unclassified' },
  'General': { ar: 'عام وغير مصنف', en: 'General' },
};

function formatSkuCount(count: number, isAr: boolean): string {
  if (isAr) {
    if (count === 0) return '0 صنف';
    if (count === 1) return 'صنف واحد';
    if (count === 2) return 'صنفان';
    if (count >= 3 && count <= 10) return `${count} أصناف`;
    return `${count} صنف`;
  }
  return count === 1 ? '1 SKU' : `${count} SKUs`;
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  products,
  onUpdateProducts,
  lang
}: ManageCategoriesModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';

  // Dynamic set of deleted category names that were explicitly removed in session
  const [deletedCategoryKeys, setDeletedCategoryKeys] = useState<Set<string>>(new Set());

  // Extract all unique categories and count products in each
  const categoriesStats = useMemo(() => {
    const counts: Record<string, number> = {};

    // 1. Count actual linked products
    products.forEach(p => {
      const cat = p.category?.trim();
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });

    // 2. Load stored custom categories
    try {
      const stored = getStoredCategories();
      stored.forEach(c => {
        const name = c.name?.trim();
        if (name && !(name in counts) && !deletedCategoryKeys.has(name)) {
          counts[name] = 0;
        }
      });
    } catch {
      // ignore
    }

    // 3. Fallback only if tenant has zero categories and zero products yet
    if (Object.keys(counts).length === 0) {
      counts[isAr ? 'عام' : 'General'] = 0;
    }

    return Object.entries(counts)
      .filter(([name]) => !deletedCategoryKeys.has(name))
      .map(([name, count]) => {
        const translation = CATEGORY_NAMES_MAP[name];
        let displayName = name;
        let subtitle: string | null = null;

        if (translation) {
          if (isAr) {
            displayName = translation.ar;
            if (name !== translation.ar) subtitle = name;
          } else {
            displayName = translation.en;
            if (name !== translation.en) subtitle = name;
          }
        }

        return {
          originalName: name,
          displayName,
          subtitle,
          count
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [products, isAr, deletedCategoryKeys]);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [renamedValue, setRenamedValue] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [categoryToDelete, setCategoryToDelete] = useState<{ originalName: string; displayName: string; count: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleStartEdit = (originalName: string, currentDisplayName: string) => {
    setCategoryToDelete(null);
    setEditingCategory(originalName);
    setRenamedValue(currentDisplayName);
  };

  const handleSaveRename = (oldOriginalCat: string) => {
    const trimmed = renamedValue.trim();
    if (!trimmed || trimmed === oldOriginalCat) {
      setEditingCategory(null);
      return;
    }

    // Update all products with old category
    const updatedProducts = products.map(p => {
      if (p.category === oldOriginalCat) {
        return { ...p, category: trimmed };
      }
      return p;
    });

    if (onUpdateProducts) {
      onUpdateProducts(updatedProducts);
    }
    saveStoredProducts(updatedProducts);

    // Update stored categories
    try {
      const stored = getStoredCategories();
      const updatedStored = stored.map(c => c.name === oldOriginalCat ? { ...c, name: trimmed } : c);
      saveStoredCategories(updatedStored);
    } catch {
      // ignore
    }

    setEditingCategory(null);
    triggerToast(isAr 
      ? `تم تعديل التصنيف إلى "${trimmed}" وتحديث الأصناف المرتبطة به بنجاح!` 
      : `Renamed category to "${trimmed}" and updated all related SKUs!`);
  };

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    // Check if exists
    if (categoriesStats.some(c => c.displayName.toLowerCase() === trimmed.toLowerCase() || c.originalName.toLowerCase() === trimmed.toLowerCase())) {
      triggerToast(isAr ? 'هذا التصنيف موجود بالفعل في النظام' : 'This category already exists');
      return;
    }

    // Save to stored categories
    try {
      const stored = getStoredCategories();
      const newStored: StoredCategory = {
        id: `CAT-${Date.now().toString().slice(-4)}`,
        name: trimmed,
        nameAr: isAr ? trimmed : undefined,
        nameEn: !isAr ? trimmed : undefined
      };
      saveStoredCategories([...stored, newStored]);
    } catch {
      // ignore
    }

    // Remove from deleted set if was previously deleted
    setDeletedCategoryKeys(prev => {
      const next = new Set(prev);
      next.delete(trimmed);
      return next;
    });

    setNewCategoryName('');
    triggerToast(isAr 
      ? `تمت إضافة التصنيف الجديد: "${trimmed}" بنجاح!` 
      : `New category "${trimmed}" added successfully!`);
  };

  const handleDeleteClick = (cat: { originalName: string; displayName: string; count: number }) => {
    setEditingCategory(null);
    if (cat.count === 0) {
      executeDelete(cat.originalName, cat.displayName, 0);
    } else {
      setCategoryToDelete(cat);
    }
  };

  const executeDelete = (originalName: string, displayName: string, count: number) => {
    const fallbackCategory = isAr ? 'عام وغير مصنف' : 'General';

    // If there are products linked to this category, reclassify them
    if (count > 0) {
      const updatedProducts = products.map(p => {
        if (p.category === originalName) {
          return { ...p, category: fallbackCategory };
        }
        return p;
      });

      if (onUpdateProducts) {
        onUpdateProducts(updatedProducts);
      }
      saveStoredProducts(updatedProducts);
    }

    // Remove from stored categories
    try {
      const stored = getStoredCategories();
      const filtered = stored.filter(c => c.name !== originalName);
      saveStoredCategories(filtered);
    } catch {
      // ignore
    }

    // Add to deleted set
    setDeletedCategoryKeys(prev => new Set(prev).add(originalName));
    setCategoryToDelete(null);

    triggerToast(
      count > 0
        ? (isAr 
            ? `تم حذف التصنيف "${displayName}" ونقل ${count} صنف إلى "${fallbackCategory}" بنجاح!` 
            : `Deleted "${displayName}" and reclassified ${count} SKU(s) to "${fallbackCategory}"!`)
        : (isAr 
            ? `تم حذف التصنيف "${displayName}" بنجاح!` 
            : `Category "${displayName}" deleted successfully!`)
    );
  };

  const totalCategorizedSkus = useMemo(() => {
    return categoriesStats.reduce((sum, c) => sum + c.count, 0);
  }, [categoriesStats]);

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div 
        className="w-full max-w-xl bg-card text-foreground border border-border/80 shadow-2xl rounded-2xl flex flex-col p-0 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        style={{ maxWidth: '620px', width: '95%', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Pinned) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-2xs shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground leading-tight m-0">
                {isAr ? 'إدارة وتعديل تصنيفات الأصناف' : 'Manage Product Categories'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal m-0">
                {isAr 
                  ? 'إعادة تسمية التصنيفات، حذفها، ونقل المنتجات التابعة لها فورياً' 
                  : 'Add, rename, or delete categories and automatically reclassify SKUs'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="p-1.5 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={onClose}
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 border-b border-primary/20 text-primary text-xs font-semibold animate-in fade-in shrink-0">
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
          
          {/* Section 1: Add New Category */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'إضافة تصنيف جديد' : 'Add New Category'}</span>
            </div>
            <form onSubmit={handleAddNewCategory} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'اكتب اسم التصنيف الجديد... (مثال: أجهزة ذكية)' : 'Enter category name...'}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-9 w-full px-3 ps-8 rounded-lg border border-border/80 bg-background text-foreground text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <Tag className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <button 
                type="submit" 
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إضافة تصنيف' : 'Add Category'}</span>
              </button>
            </form>
          </div>

          {/* Inline Delete Confirmation Alert (If a category with products is being deleted) */}
          {categoryToDelete && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5 text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold m-0 leading-tight">
                    {isAr ? `تأكيد حذف تصنيف: "${categoryToDelete.displayName}"` : `Confirm Deleting Category: "${categoryToDelete.displayName}"`}
                  </h4>
                  <p className="text-[11px] leading-relaxed text-destructive/90 m-0">
                    {isAr 
                      ? `هذا التصنيف مرتبط حالياً بـ ${categoryToDelete.count} صنف. عند الحذف سيتم نقل هذه الأصناف تلقائياً إلى تصنيف "عام وغير مصنف". هل ترغب في المتابعة؟`
                      : `This category is currently linked to ${categoryToDelete.count} SKU(s). Deleting will reclassify all of them to "General". Are you sure you want to proceed?`}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-3 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => executeDelete(categoryToDelete.originalName, categoryToDelete.displayName, categoryToDelete.count)}
                  className="px-3.5 py-1.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نعم، حذف ونقل الأصناف' : 'Yes, Delete & Reclassify'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Active Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>{isAr ? 'قائمة التصنيفات والأصناف المرتبطة' : 'Current Categories & Linked SKUs'}</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/60">
                {categoriesStats.length} {isAr ? 'تصنيف' : 'Categories'}
              </span>
            </div>

            {/* List */}
            <div className="space-y-2">
              {categoriesStats.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground space-y-1">
                  <Tag className="w-6 h-6 mx-auto opacity-40 mb-2" />
                  <p className="text-xs font-semibold m-0">{isAr ? 'لا توجد تصنيفات مسجلة حالياً' : 'No categories found'}</p>
                </div>
              ) : (
                categoriesStats.map(cat => {
                  const isEditing = editingCategory === cat.originalName;

                  return (
                    <div 
                      key={cat.originalName}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all gap-3 ${
                        isEditing 
                          ? 'border-primary bg-primary/5 shadow-2xs' 
                          : 'border-border/80 bg-card hover:bg-muted/30'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="text"
                            value={renamedValue}
                            onChange={(e) => setRenamedValue(e.target.value)}
                            className="h-8 flex-1 px-2.5 text-xs font-medium rounded-lg border border-border/80 bg-background text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(cat.originalName);
                              if (e.key === 'Escape') setEditingCategory(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cat.originalName)}
                            className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title={isAr ? 'حفظ التعديل' : 'Save changes'}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isAr ? 'حفظ' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory(null)}
                            className="h-8 px-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Left: Category Icon & Name */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                              <Tag className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-foreground truncate leading-tight" dir="auto">
                                {cat.displayName}
                              </span>
                              {cat.subtitle && (
                                <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                  {cat.subtitle}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Badge & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* SKU Count Pill */}
                            <span 
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                                cat.count > 0 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                  : 'bg-muted text-muted-foreground border-border/80'
                              }`}
                            >
                              <Package className="w-3 h-3" />
                              <span>{formatSkuCount(cat.count, isAr)}</span>
                            </span>

                            {/* Rename Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(cat.originalName, cat.displayName)}
                              className="h-7 px-2 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={isAr ? 'تعديل اسم التصنيف' : 'Rename Category'}
                            >
                              <Edit3 className="w-3 h-3 text-muted-foreground" />
                              <span className="hidden sm:inline">{isAr ? 'تعديل' : 'Rename'}</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(cat)}
                              className="h-7 px-2 rounded-lg border border-border/80 bg-background hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={isAr ? 'حذف هذا التصنيف' : 'Delete Category'}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden sm:inline">{isAr ? 'حذف' : 'Delete'}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer (Pinned) */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/40 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            {isAr 
              ? `إجمالي التصنيفات: ${categoriesStats.length} • الأصناف المسجلة: ${totalCategorizedSkus}` 
              : `Total Categories: ${categoriesStats.length} • Total SKUs: ${totalCategorizedSkus}`}
          </span>
          <button 
            type="button" 
            className="px-4 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer"
            onClick={onClose}
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}