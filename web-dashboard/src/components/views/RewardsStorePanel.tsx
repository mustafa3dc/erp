import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Edit3,
  Gift,
  ImagePlus,
  Package,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { ModalBackdropPortal } from '../ui/dialog';
import { getTranslation } from '../../lib/i18n';
import { getStoredProducts } from '../../services/storageService';
import {
  LoyaltyRewardItem,
  compressRewardImageFile,
  createLoyaltyReward,
  deleteLoyaltyReward,
  fetchLoyaltyRewards,
  toggleLoyaltyReward,
  updateLoyaltyReward
} from '../../services/loyaltyRewardsService';

interface RewardsStorePanelProps {
  lang: 'en' | 'ar';
  onToast: (msg: string) => void;
}

export default function RewardsStorePanel({ lang, onToast }: RewardsStorePanelProps) {
  const isAr = lang === 'ar';
  const tr = (key: string) => getTranslation(lang, `ui.rewardsStore.${key}`);
  const ptsUnit = getTranslation(lang, 'ui.loyalty.pointsUnit');

  const [rewards, setRewards] = useState<LoyaltyRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [products] = useState<any[]>(() => getStoredProducts());

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyRewardItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCostInput, setPointsCostInput] = useState('');
  const [productId, setProductId] = useState('');
  const [displayOrderInput, setDisplayOrderInput] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const list = await fetchLoyaltyRewards();
      setRewards(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, []);

  const stats = useMemo(
    () => ({
      total: rewards.length,
      active: rewards.filter(r => r.isActive).length,
      linked: rewards.filter(r => Boolean(r.productId)).length
    }),
    [rewards]
  );

  const openCreateModal = () => {
    setEditingReward(null);
    setTitle('');
    setDescription('');
    setPointsCostInput('');
    setProductId('');
    setDisplayOrderInput(String(rewards.length));
    setIsActive(true);
    setImageUrl(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (reward: LoyaltyRewardItem) => {
    setEditingReward(reward);
    setTitle(reward.title);
    setDescription(reward.description || '');
    setPointsCostInput(String(reward.pointsCost));
    setProductId(reward.productId || '');
    setDisplayOrderInput(String(reward.displayOrder || 0));
    setIsActive(reward.isActive);
    setImageUrl(reward.imageUrl || null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressRewardImageFile(file);
      setImageUrl(compressed);
    } catch {
      setFormError(tr('validationError'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseFloat(pointsCostInput);
    if (!title.trim() || !Number.isFinite(pts) || pts <= 0) {
      setFormError(tr('validationError'));
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl,
        pointsCost: pts,
        productId: productId || null,
        isActive,
        displayOrder: parseInt(displayOrderInput, 10) || 0
      };

      if (editingReward) {
        await updateLoyaltyReward(editingReward.id, payload);
      } else {
        await createLoyaltyReward(payload);
      }
      await loadRewards();
      setIsModalOpen(false);
      onToast(tr('savedToast'));
    } catch (err: any) {
      setFormError(err?.message || tr('validationError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (reward: LoyaltyRewardItem) => {
    await toggleLoyaltyReward(reward.id);
    await loadRewards();
    onToast(tr('toggledToast'));
  };

  const handleDelete = async (reward: LoyaltyRewardItem) => {
    if (!window.confirm(tr('deleteConfirm').replace('{title}', reward.title))) return;
    await deleteLoyaltyReward(reward.id);
    await loadRewards();
    onToast(tr('deletedToast'));
  };

  return (
    <div className="space-y-4">
      {/* Store Header + Summary */}
      <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="m-0 text-sm font-bold text-foreground">{tr('headerTitle')}</h3>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">{tr('headerSubtitle')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="btn-clean-primary"
        >
          <Plus size={15} />
          <span>{tr('addRewardBtn')}</span>
        </button>
      </div>

      {/* Compact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{tr('kpiTotalRewards')}</span>
          <span className="text-lg font-extrabold text-foreground tabular-nums">{stats.total}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{tr('kpiActiveRewards')}</span>
          <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.active}
          </span>
        </div>
        <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{tr('kpiLinkedInventory')}</span>
          <span className="text-lg font-extrabold text-primary tabular-nums">{stats.linked}</span>
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="p-10 rounded-2xl bg-card border border-border text-center text-xs text-muted-foreground">
          {getTranslation(lang, 'ui.common.loadingData')}
        </div>
      ) : rewards.length === 0 ? (
        <div className="p-10 rounded-2xl bg-card border border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Gift size={24} />
          </div>
          <div className="text-sm font-bold text-foreground">{tr('emptyTitle')}</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto m-0">{tr('emptySubtitle')}</p>
          <button type="button" onClick={openCreateModal} className="btn-clean-primary mt-2">
            <Plus size={15} />
            <span>{tr('addRewardBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map(r => (
            <div
              key={r.id}
              className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col justify-between transition-all hover:border-primary/40"
            >
              <div>
                {/* Image Banner */}
                <div className="relative h-40 bg-muted/60 border-b border-border flex items-center justify-center overflow-hidden">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <Gift size={36} className="text-muted-foreground/40" />
                  )}

                  <span
                    className={`absolute top-2.5 end-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-xs ${
                      r.isActive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-muted/90 text-muted-foreground border-border'
                    }`}
                  >
                    {r.isActive ? tr('statusActive') : tr('statusInactive')}
                  </span>

                  <span
                    dir="ltr"
                    className="absolute bottom-2.5 start-2.5 px-2.5 py-1 rounded-lg bg-card/95 border border-border text-amber-600 dark:text-amber-400 text-xs font-extrabold tabular-nums inline-flex items-center gap-1 shadow-xs"
                  >
                    <Award size={13} />
                    <span>{Number(r.pointsCost).toLocaleString('en-US')}</span>
                    <span className="text-[10px] font-semibold">{ptsUnit}</span>
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h4 className="m-0 text-sm font-bold text-foreground line-clamp-1" dir="auto">
                    {r.title}
                  </h4>
                  {r.description && (
                    <p className="m-0 text-xs text-muted-foreground line-clamp-2" dir="auto">
                      {r.description}
                    </p>
                  )}

                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    {r.productId ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          r.inStock
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-destructive/10 text-destructive border-destructive/25'
                        }`}
                      >
                        <Package size={12} />
                        <span className="truncate max-w-[140px]" dir="auto">
                          {r.productName || ''}
                        </span>
                        <span className="tabular-nums">
                          —{' '}
                          {r.inStock
                            ? tr('inStockBadge').replace('{count}', String(r.liveStockQuantity))
                            : tr('outOfStockBadge')}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                        <CheckCircle2 size={12} />
                        <span>{tr('unlimitedBadge')}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(r)}
                  role="switch"
                  aria-checked={r.isActive}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer bg-transparent border-0 p-0"
                >
                  <span
                    className={`w-8 h-4.5 rounded-full transition-colors relative inline-flex items-center px-0.5 ${
                      r.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        r.isActive ? (isAr ? '-translate-x-3.5' : 'translate-x-3.5') : ''
                      }`}
                    />
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {r.isActive ? tr('statusActive') : tr('statusInactive')}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(r)}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>{tr('editBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-destructive cursor-pointer"
                    title={tr('deleteBtn')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Reward Modal */}
      {isModalOpen && (
        <ModalBackdropPortal onClose={() => setIsModalOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
          <div
            className="bg-card text-foreground border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <h3 className="m-0 text-sm font-bold text-foreground">
                {editingReward ? tr('editRewardTitle') : tr('addRewardTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer border-0 bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {tr('imageLabel')}
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-18 h-18 rounded-xl border border-border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus size={22} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                        <ImagePlus size={13} />
                        <span>{tr('uploadImageBtn')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium cursor-pointer"
                        >
                          {tr('removeImageBtn')}
                        </button>
                      )}
                    </div>
                    <p className="m-0 text-[11px] text-muted-foreground">{tr('imageHint')}</p>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {tr('titleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tr('titlePlaceholder')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {tr('descriptionLabel')}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tr('descriptionPlaceholder')}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-sm text-foreground resize-none"
                />
              </div>

              {/* Points Cost + Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {tr('pointsCostLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    dir="ltr"
                    value={pointsCostInput}
                    onChange={(e) => setPointsCostInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono font-bold tabular-nums text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {tr('displayOrderLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    dir="ltr"
                    value={displayOrderInput}
                    onChange={(e) => setDisplayOrderInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono tabular-nums text-foreground"
                  />
                </div>
              </div>

              {/* Linked Product */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {tr('linkedProductLabel')}
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground"
                >
                  <option value="">{tr('noLinkedProduct')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {tr('productStockOption')
                        .replace('{name}', isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr)
                        .replace('{stock}', String(Number(p.currentStock) || 0))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Switch */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-xs font-semibold text-foreground">{tr('isActiveLabel')}</span>
              </label>

              {formError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-clean-secondary"
                >
                  {tr('cancelBtn')}
                </button>
                <button type="submit" disabled={isSaving} className="btn-clean-primary">
                  {tr('saveRewardBtn')}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdropPortal>
      )}
    </div>
  );
}
