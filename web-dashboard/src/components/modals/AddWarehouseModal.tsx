import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, 
  X, 
  Check, 
  MapPin, 
  Layers,
  Phone,
  User,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { Warehouse } from '../../types/warehouse';
import { 
  GLOBAL_COUNTRIES, 
  STORAGE_CLASSIFICATIONS, 
  getCountryByCode, 
  getStatesForCountry, 
  getStorageTypeById 
} from '../../data/globalLocations';

export interface AddWarehouseModalProps {
  lang: 'en' | 'ar';
  isOpen: boolean;
  onClose: () => void;
  onAddWarehouse: (data: any) => void;
  initialCountryCode?: string;
  totalWarehousesCount?: number;
}

export default function AddWarehouseModal({
  lang,
  isOpen,
  onClose,
  onAddWarehouse,
  initialCountryCode = 'IQ',
  totalWarehousesCount = 1
}: AddWarehouseModalProps) {
  if (!isOpen) return null;
  const isAr = lang === 'ar';

  const initialCountry = getCountryByCode(initialCountryCode) || GLOBAL_COUNTRIES[0];
  const [countryCode, setCountryCode] = useState<string>(initialCountryCode || initialCountry?.code || 'US');
  const defaultStates = getStatesForCountry(countryCode);
  const [state, setState] = useState<string>(defaultStates[0] ? (isAr ? defaultStates[0].nameAr : defaultStates[0].nameEn) : '');
  
  const [form, setForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    city: defaultStates[0] ? (isAr ? defaultStates[0].nameAr : defaultStates[0].nameEn) : '',
    address: '',
    postalCode: '10001',
    currency: initialCountry?.currencySymbol || '$',
    timezone: initialCountry?.defaultTimezone || 'UTC',
    storageType: 'rdc_general',
    manager: '',
    phone: '',
    capacity: 15000,
    status: 'active' as 'active' | 'maintenance'
  });

  const availableStates = getStatesForCountry(countryCode);

  const matchedState = availableStates.find(s => s.nameAr === state || s.nameEn === state || s.code === state);
  const selectedStateValue = matchedState ? (isAr ? matchedState.nameAr : matchedState.nameEn) : state;

  const handleCountryChange = (cCode: string) => {
    setCountryCode(cCode);
    const country = getCountryByCode(cCode);
    const firstState = isAr ? (country.states[0]?.nameAr || '') : (country.states[0]?.nameEn || country.states[0]?.nameAr || '');
    setState(firstState);
    setForm(prev => ({
      ...prev,
      city: firstState,
      currency: country.currency,
      timezone: country.defaultTimezone,
      phone: country.phoneCode + ' '
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      alert(isAr ? 'يرجى إدخال اسم المستودع بالعربية' : 'Please enter warehouse name');
      return;
    }

    const countryObj = getCountryByCode(countryCode);
    const storageObj = getStorageTypeById(form.storageType);
    const autoCode = form.code.trim() || `WH-${countryObj.code}-${String(totalWarehousesCount + 1).padStart(2, '0')}`;

    onAddWarehouse({
      code: autoCode.toUpperCase(),
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || form.nameAr.trim(),
      country: countryObj.nameAr,
      countryCode: countryObj.code,
      state: state,
      city: form.city.trim() || state,
      address: form.address.trim(),
      postalCode: form.postalCode.trim(),
      timezone: form.timezone,
      currency: form.currency,
      storageType: form.storageType,
      storageTypeLabelAr: storageObj.nameAr,
      storageTypeLabelEn: storageObj.nameEn,
      manager: form.manager.trim() || (isAr ? 'مدير العمليات' : 'Operations Manager'),
      phone: form.phone.trim(),
      capacity: Number(form.capacity) || 10000,
      status: form.status
    });

    onClose();
  };

  return createPortal(
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="modal-content glass-panel" 
        style={{ maxWidth: '820px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Plus size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {isAr ? 'تسجيل مستودع جديد' : 'Register New Warehouse'}
              </h3>
              <small style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
                {isAr ? 'إضافة فرع أو مركز لوجستي جديد إلى الشبكة السحابية' : 'Add a new logistics hub to the cloud network'}
              </small>
            </div>
          </div>
          <button 
            type="button" 
            className="icon-circle-btn"
            onClick={onClose}
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="goods-modal-scroll-body" style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* SECTION 1: IDENTITY & MANAGEMENT */}
            <div className="goods-form-section">
              <div className="goods-section-header">
                <Building2 size={16} />
                <span>{isAr ? '1. هوية المستودع والمسؤول' : '1. Hub Identity & Management'}</span>
              </div>
              <div className="form-grid-2">
                <div className="goods-input-group">
                  <label>{isAr ? 'اسم المستودع *' : 'Warehouse Name *'}</label>
                  <input
                    type="text"
                    required
                    className="goods-text-input"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    placeholder={isAr ? 'مثال: المستودع اللوجستي الرئيسي' : 'e.g. Central Logistics Hub'}
                    dir="auto"
                  />
                </div>
                <div className="goods-input-group">
                  <label>{isAr ? 'كود المستودع (تلقائي إن ترك فارغاً)' : 'Warehouse Code'}</label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="WH-01"
                    dir="ltr"
                    style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div className="form-grid-3" style={{ marginTop: '10px' }}>
                <div className="goods-input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={13} />
                    <span>{isAr ? 'مدير / مسؤول المستودع' : 'Warehouse Manager'}</span>
                  </label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.manager}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    placeholder={isAr ? 'اسم المشرف المسؤول' : 'Supervisor name'}
                    dir="auto"
                  />
                </div>
                <div className="goods-input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={13} />
                    <span>{isAr ? 'رقم هاتف المستودع' : 'Contact Phone'}</span>
                  </label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={isAr ? 'رقم هاتف المستودع...' : '+1 (555) 000-0000'}
                    dir="ltr"
                  />
                </div>
                <div className="goods-input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} />
                    <span>{isAr ? 'حالة التشغيل' : 'Operational Status'}</span>
                  </label>
                  <select
                    className="goods-select-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'maintenance' })}
                  >
                    <option value="active">{isAr ? 'نشط ويعمل' : 'Active'}</option>
                    <option value="maintenance">{isAr ? 'تحت الصيانة والتجهيز' : 'Maintenance'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: GEOGRAPHY & LOCATION */}
            <div className="goods-form-section">
              <div className="goods-section-header">
                <MapPin size={16} />
                <span>{isAr ? '2. الموقع الجغرافي والعنوان' : '2. Geographic Location'}</span>
              </div>
              <div className="form-grid-3">
                <div className="goods-input-group">
                  <label>{isAr ? 'الدولة (Country) *' : 'Country *'}</label>
                  <select
                    className="goods-select-input"
                    value={countryCode}
                    onChange={(e) => handleCountryChange(e.target.value)}
                  >
                    {GLOBAL_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {isAr ? c.nameAr : c.nameEn} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'المحافظة / الولاية *' : 'State / Province *'}</label>
                  <select
                    className="goods-select-input"
                    value={selectedStateValue}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setState(selected);
                      const matched = availableStates.find(s => s.nameAr === selected || s.nameEn === selected);
                      const cityName = matched ? (isAr ? matched.nameAr : matched.nameEn) : selected;
                      setForm(prev => ({ ...prev, city: cityName }));
                    }}
                  >
                    {availableStates.map(s => (
                      <option key={s.code} value={isAr ? s.nameAr : s.nameEn}>
                        {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'المدينة / المنطقة' : 'City / District'}</label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder={isAr ? 'اكتب اسم المنطقة أو الحي...' : 'Enter district or area name...'}
                    dir="auto"
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '10px' }}>
                <div className="goods-input-group">
                  <label>{isAr ? 'العنوان التفصيلي / الشارع والمجمع' : 'Street Address'}</label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={isAr ? 'المنطقة الصناعية، قرب الخط الدولي...' : 'Industrial area...'}
                    dir="auto"
                  />
                </div>
                <div className="goods-input-group">
                  <label>{isAr ? 'الرمز البريدي (Postal / ZIP)' : 'Postal Code'}</label>
                  <input
                    type="text"
                    className="goods-text-input"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="10001"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: STORAGE CAPACITY & TYPE */}
            <div className="goods-form-section">
              <div className="goods-section-header">
                <Layers size={16} />
                <span>{isAr ? '3. التصنيف الفني والسعة التخزينية' : '3. Classification & Capacity'}</span>
              </div>
              <div className="form-grid-2">
                <div className="goods-input-group">
                  <label>{isAr ? 'نوع وتصنيف التخزين *' : 'Storage Classification *'}</label>
                  <select
                    className="goods-select-input"
                    value={form.storageType}
                    onChange={(e) => setForm({ ...form, storageType: e.target.value })}
                  >
                    {STORAGE_CLASSIFICATIONS.map(st => (
                      <option key={st.id} value={st.id}>
                        {isAr ? st.nameAr : st.nameEn} - {isAr ? st.tempRangeAr : st.tempRangeEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="goods-input-group">
                  <label>{isAr ? 'السعة الكلية التقديرية (م³)' : 'Total Capacity (m³)'}</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    className="goods-text-input"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    placeholder="15000"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="modal-actions" style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--muted)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
            >
              <Check size={16} />
              <span>{isAr ? 'تسجيل المستودع الآن' : 'Save Warehouse'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
