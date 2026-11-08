import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  CheckCircle2, 
  X, 
  Send, 
  KeyRound, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { ManagerOverrideApproval } from '../../types/warehouse';

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (approval: ManagerOverrideApproval) => void;
  productName: string;
  originalPrice: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  proposedPrice: number;
  maxCashierPercent: number;
  lang: 'en' | 'ar';
}

export default function ManagerOverrideModal({
  isOpen,
  onClose,
  onApprove,
  productName,
  originalPrice,
  discountType,
  discountValue,
  proposedPrice,
  maxCashierPercent,
  lang
}: ManagerOverrideModalProps) {
  const isAr = lang === 'ar';
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRemoteRequested, setIsRemoteRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus PIN input field when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setIsRemoteRequested(false);
      setIsSubmitting(false);
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const discountPercentCalculated = discountType === 'PERCENT' 
    ? discountValue 
    : originalPrice > 0 ? (discountValue / originalPrice) * 100 : 0;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMsg('');
      pinInputRef.current?.focus();
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
    pinInputRef.current?.focus();
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
    pinInputRef.current?.focus();
  };

  const handleVerifyPin = (overridePin?: string) => {
    const pinToTest = overridePin || pin;
    if (!pinToTest) {
      setErrorMsg(isAr ? 'الرجاء إدخال الرمز السري للمشرف' : 'Please enter manager PIN');
      pinInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      // Validation rules:
      // PIN 1234 -> Supervisor (Ahmed Al-Shammari) - max 15%
      // PIN 8899 -> Admin (Fahad Al-Tamimi) - unlimited
      if (pinToTest === '1234') {
        if (discountPercentCalculated > 15.0) {
          setErrorMsg(isAr 
            ? 'الخصم المطلوب يتجاوز الصلاحية المسموحة لهذه المادة' 
            : 'Requested discount exceeds authorized limit for this item');
          setIsSubmitting(false);
          pinInputRef.current?.focus();
          return;
        }

        const approval: ManagerOverrideApproval = {
          managerId: 'MGR-04',
          managerName: isAr ? 'أحمد الشمري (مشرف الفرع)' : 'Ahmed Al-Shammari (Supervisor)',
          token: `OVR-${Date.now().toString().slice(-6)}`,
          approvedAt: new Date().toISOString()
        };
        onApprove(approval);
        setIsSubmitting(false);
      } else if (pinToTest === '8899') {
        const approval: ManagerOverrideApproval = {
          managerId: 'ADM-01',
          managerName: isAr ? 'مدير النظام المعتمد' : 'Authorized System Admin',
          token: `OVR-${Date.now().toString().slice(-6)}`,
          approvedAt: new Date().toISOString()
        };
        onApprove(approval);
        setIsSubmitting(false);
      } else {
        setErrorMsg(isAr ? 'رمز المشرف غير صالح أو غير مصرح له بالاعتماد' : 'Invalid manager PIN or unauthorized');
        setIsSubmitting(false);
        pinInputRef.current?.focus();
      }
    }, 250);
  };

  const handleRemoteRequest = () => {
    setIsRemoteRequested(true);
    setErrorMsg('');
    // Simulate push notification dispatch to supervisor tablet/phone
    setTimeout(() => {
      const approval: ManagerOverrideApproval = {
        managerId: 'MGR-REMOTE',
        managerName: isAr ? 'اعتماد عن بعد (المشرف العام)' : 'Remote Approval (General Supervisor)',
        token: `OVR-REM-${Date.now().toString().slice(-6)}`,
        approvedAt: new Date().toISOString()
      };
      onApprove(approval);
    }, 2000);
  };

  return (
    <div 
      className="modal-backdrop-custom fade-in" 
      onClick={(e) => {
        // Stop bubbling so clicking the backdrop never closes parent modals
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 24, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px'
      }}
    >
      <div 
        className="glass-panel" 
        onClick={(e) => e.stopPropagation()} // Stop any click from bubbling up
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '18px',
          background: '#0d1527',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.35)'
        }}
      >
        {/* Header with Security Badge */}
        <div style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.05) 100%)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f87171' }}>
                {isAr ? 'هذا الخصم يتطلب اعتماد المشرف' : 'Manager Override Required'}
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {isAr ? 'نظام حماية هامش الربح والرقابة الصامتة' : 'Profit Margin & Cost Protection Engine'}
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {/* Item details card (Strictly Cost Masked: NO Cost Price shown) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            padding: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{productName}</span>
              <span style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                {discountType === 'PERCENT' ? `${discountValue}%` : `$${discountValue}`} {isAr ? 'خصم مطلوب' : 'Requested'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>{isAr ? 'سعر البيع الرسمي:' : 'Retail Price:'}</span>
                <strong style={{ color: '#f8fafc', fontSize: '14px' }}>${originalPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>{isAr ? 'السعر بعد الخصم:' : 'Discounted Price:'}</span>
                <strong style={{ color: '#10b981', fontSize: '14px' }}>${proposedPrice.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#fbbf24'
            }}>
              <span>{isAr ? `حد الكاشير المسموح: ${maxCashierPercent}%` : `Cashier limit: ${maxCashierPercent}%`}</span>
              <span>{isAr ? `التجاوز المطلوب: +${(discountPercentCalculated - maxCashierPercent).toFixed(1)}%` : `Exceeded by: +${(discountPercentCalculated - maxCashierPercent).toFixed(1)}%`}</span>
            </div>
          </div>

          {/* Remote approval pending state */}
          {isRemoteRequested ? (
            <div style={{
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <div className="spinner-orbit" style={{
                width: '36px',
                height: '36px',
                border: '3px solid var(--primary-border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                margin: '0 auto 12px auto',
                animation: 'spin 1s linear infinite'
              }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                {isAr ? 'تم إرسال إشعار اعتماد فوري للمشرف...' : 'Instant approval notification sent...'}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                {isAr ? 'في انتظار موافقة المشرف من تطبيق الهاتف أو لوحة الإدارة' : 'Waiting for manager approval on mobile or dashboard'}
              </p>
            </div>
          ) : (
            <>
              {/* PIN Display & Real Keyboard Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  <KeyRound size={14} style={{ display: 'inline', marginLeft: isAr ? '6px' : '0', marginRight: isAr ? '0' : '6px', color: 'var(--primary)' }} />
                  {isAr ? 'أدخل الرمز السري للمشرف (أو اكتبه بالكيبورد مباشرة):' : 'Enter Supervisor PIN (or type on keyboard):'}
                </label>
                
                <div style={{ position: 'relative' }}>
                  <input
                    ref={pinInputRef}
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                      setPin(clean);
                      setErrorMsg('');
                    }}
                    onKeyDown={(e) => {
                      // CRITICAL: Stop propagation so key presses never trigger parent form submit or shortcut
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerifyPin();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        onClose();
                      }
                    }}
                    placeholder="••••"
                    style={{
                      width: '100%',
                      height: '48px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: errorMsg ? '2px solid #ef4444' : '1px solid var(--primary-border)',
                      borderRadius: '10px',
                      padding: '0 16px',
                      textAlign: 'center',
                      fontSize: '24px',
                      letterSpacing: '10px',
                      fontFamily: 'monospace',
                      color: 'var(--foreground)',
                      fontWeight: 800,
                      outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    left: isAr ? 'auto' : '14px',
                    right: isAr ? '14px' : 'auto',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--primary)'
                  }}>
                    <Lock size={16} />
                  </div>
                </div>

                {errorMsg && (
                  <span style={{ display: 'block', color: '#ef4444', fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>
                    {errorMsg}
                  </span>
                )}
              </div>

              {/* Numeric Keypad for Touch Terminals */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '14px'
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
                  <button
                    key={btn}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (btn === 'C') handleClear();
                      else if (btn === '⌫') handleDelete();
                      else handleKeyPress(btn);
                    }}
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      background: btn === 'C' ? 'rgba(239, 68, 68, 0.15)' : btn === '⌫' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: btn === 'C' ? '#f87171' : btn === '⌫' ? '#fbbf24' : '#fff',
                      fontSize: '16px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {btn}
                  </button>
                ))}
              </div>



              {/* Actions: Submit PIN / Remote Request */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={!pin || isSubmitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerifyPin();
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: pin ? 'var(--primary)' : '#94a3b8',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: pin ? 'pointer' : 'not-allowed'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{isSubmitting ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'اعتماد الخصم فورياً' : 'Authorize Override')}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoteRequest();
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={14} />
                  <span>{isAr ? 'طلب موافقة عن بعد' : 'Remote'}</span>
                </button>
              </div>
            </>
          )}

          {/* Audit trail disclosure notice */}
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#64748b'
          }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>
              {isAr 
                ? 'سيتم تسجيل هوية المشرف وتفاصيل الخصم في سجل الرقابة المشفر (Audit Trail) تلقائياً.' 
                : 'All overrides are automatically logged in the immutable Discount Audit Trail.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
