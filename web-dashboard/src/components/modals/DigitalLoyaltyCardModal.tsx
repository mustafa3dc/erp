import React, { useState } from 'react';
import { Award, Check, Copy, ExternalLink, MessageCircle, QrCode, X } from 'lucide-react';
import { ModalBackdropPortal } from '../ui/dialog';
import QrCodeSvg from '../QrCodeSvg';
import BarcodeSvg from '../BarcodeSvg';
import { getTranslation } from '../../lib/i18n';
import { useSettings } from '../../context/settings-context';
import { normalizeLoyaltyPhone } from '../../services/storageService';

export interface DigitalLoyaltyCustomerInfo {
  id: string;
  name: string;
  phone?: string;
  loyaltyMemberCode?: string;
  loyaltyCardToken?: string;
  loyaltyPoints?: number;
  loyaltyPointsBalance?: number;
}

interface DigitalLoyaltyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DigitalLoyaltyCustomerInfo | null;
  lang: 'en' | 'ar';
}

export default function DigitalLoyaltyCardModal({
  isOpen,
  onClose,
  customer,
  lang
}: DigitalLoyaltyCardModalProps) {
  const isAr = lang === 'ar';
  const { settings } = useSettings();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !customer || !customer.loyaltyCardToken) return null;

  const dwTr = (key: string) => getTranslation(lang, `ui.digitalWallet.${key}`);
  const ptsUnit = getTranslation(lang, 'ui.loyalty.pointsUnit');
  const points = Number(customer.loyaltyPointsBalance ?? customer.loyaltyPoints ?? 0) || 0;
  const memberCode = customer.loyaltyMemberCode || 'LOY-10001';
  const storeName = settings.organizationName?.trim() || 'ZiloX Store';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cardPath = `/card/${encodeURIComponent(customer.loyaltyCardToken)}`;
  const cardUrl = `${origin}${cardPath}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback select
    }
  };

  const handleSendWhatsApp = () => {
    const message = dwTr('whatsappGreeting')
      .replace('{name}', customer.name)
      .replace('{store}', storeName)
      .replace('{points}', points.toLocaleString('en-US'))
      .replace('{url}', cardUrl);

    const norm = normalizeLoyaltyPhone(customer.phone);
    const waPhone = norm ? (norm.startsWith('964') ? norm : `964${norm}`) : '';
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <ModalBackdropPortal onClose={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div
        className="bg-card text-foreground border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-foreground">{dwTr('modalTitle')}</h3>
              <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">{dwTr('modalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer border-0 bg-transparent"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Summary Card */}
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">{storeName}</div>
              <div className="text-base font-bold text-foreground truncate" dir="auto">
                {customer.name}
              </div>
              <span
                dir="ltr"
                className="inline-block mt-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-bold"
              >
                {memberCode}
              </span>
            </div>

            <div className="text-end shrink-0">
              <div className="text-[11px] font-medium text-muted-foreground">{dwTr('pointsBalanceLabel')}</div>
              <div
                dir="ltr"
                className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-end gap-1"
              >
                <Award size={18} className="shrink-0" />
                <span>{points.toLocaleString('en-US')}</span>
                <span className="text-xs font-semibold">{ptsUnit}</span>
              </div>
            </div>
          </div>

          {/* Crisp White QR + 1D Barcode Box (always readable in Dark Mode) */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl border border-border shadow-xs inline-flex flex-col items-center gap-2">
              <QrCodeSvg value={cardUrl} size={156} />
              <div className="pt-1 border-t border-slate-200 w-full flex flex-col items-center">
                <BarcodeSvg value={memberCode} width={152} height={34} color="#000000" showText />
                <span className="text-[10px] font-medium text-slate-600 mt-1">
                  {dwTr('scanMemberCodeHint')}
                </span>
              </div>
            </div>

            <div
              dir="ltr"
              className="w-full px-3 py-2 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground truncate text-center select-all"
            >
              {cardUrl}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              <span>{copied ? dwTr('copiedBtn') : dwTr('copyLinkBtn')}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2.5 rounded-xl border-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <MessageCircle size={15} />
              <span>{dwTr('sendWhatsappBtn')}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
            <a
              href={cardPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
            >
              <ExternalLink size={13} />
              <span>{dwTr('previewCardBtn')}</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold cursor-pointer"
            >
              {dwTr('closeBtn')}
            </button>
          </div>
        </div>
      </div>
    </ModalBackdropPortal>
  );
}
