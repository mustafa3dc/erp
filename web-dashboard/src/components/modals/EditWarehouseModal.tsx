import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Edit3, 
  X, 
  Check, 
  MapPin, 
  Building2, 
  Layers,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Warehouse } from '../../types/warehouse';
import { 
  GLOBAL_COUNTRIES, 
  STORAGE_CLASSIFICATIONS, 
  getCountryByCode, 
  getStatesForCountry, 
  getStorageTypeById 
} from '../../data/globalLocations';

export interface EditWarehouseModalProps {
  lang: 'en' | 'ar';
  warehouse: Warehouse | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateWarehouse: (id: string, updates: Partial<Warehouse>) => void;
}

export default function EditWarehouseModal({
  lang,
  warehouse,
  isOpen,
  onClose,
  onUpdateWarehouse
}: EditWarehouseModalProps) {
  if (!isOpen || !warehouse) return null;
  const isAr = lang === 'ar';

  const [countryCode, setCountryCode] = useState<string>(warehouse.countryCode || 'US');
  const [state, setState] = useState<string>(warehouse.state || warehouse.city || '');
  const [form, setForm] = useState({
    code: warehouse.code,
    nameAr: warehouse.nameAr,
    nameEn: warehouse.nameEn || '',
    city: warehouse.city || '',
    address: warehouse.address || '',
    postalCode: warehouse.postalCode || '',
    currency: warehouse.currency || 'USD',
    timezone: warehouse.timezone || 'UTC',
    storageType: warehouse.storageType || 'rdc_general',
    manager: warehouse.manager || '',
    phone: warehouse.phone || '',
    capacity: warehouse.capacity || 10000,
    status: (warehouse.status || 'active') as 'active' | 'maintenance'
  });

  useEffect(() => {
    if (warehouse) {
      const cCode = warehouse.countryCode || 'US';
      const country = getCountryByCode(cCode);
      setCountryCode(cCode);
      setState(warehouse.state || warehouse.city || '');
      setForm({
        code: warehouse.code,
        nameAr: warehouse.nameAr,
        nameEn: warehouse.nameEn || '',
        city: warehouse.city || '',
        address: warehouse.address || '',
        postalCode: warehouse.postalCode || '',
        currency: warehouse.currency || country.currency,
        timezone: warehouse.timezone || country.defaultTimezone,
        storageType: warehouse.storageType || 'rdc_general',
        manager: warehouse.manager || '',
        phone: warehouse.phone || '',
        capacity: warehouse.capacity || 10000,
        status: (warehouse.status || 'active') as 'active' | 'maintenance'
      });
    }
  }, [warehouse]);

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
      timezone: country.defaultTimezone
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      alert(isAr ? 'يرجى إدخال اسم المستودع' : 'Please enter warehouse name');
      return;
    }

    const countryObj = getCountryByCode(countryCode);
    const storageObj = getStorageTypeById(form.storageType);

    onUpdateWarehouse(warehouse.id, {
      code: form.code.trim().toUpperCase() || warehouse.code,
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
      manager: form.manager.trim(),
      phone: form.phone.trim(),
      capacity: Number(form.capacity) || warehouse.capacity,
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
              <Edit3 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {isAr ? 'تعديل بيانات ومواصفات المستودع' : 'Edit Warehouse Specifications'}
              </h3>
              <small style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>
                {isAr ? 'المستودع المستهدف: ' : 'Target Hub: '}<span dir="auto" style={{ fontWeight: 700, color: 'var(--primary)' }}>{warehouse.nameAr}</span> ({warehouse.code})
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
              <div className="section-title-row">
                <Building2 size={16} className="text-cyan" />
                <h4>{isAr ? '1. هوية المستودع والسعة التخزينية والإدارة' : '1. Identity, Capacity & Management'}</h4>
              </div>

              <div className="form-grid-3">
                <div className="goods-input-group">
                  <label>{isAr ? 'كود المستودع *' : 'Hub Code *'}</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="goods-text-input font-mono"
                  />
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'السعة التخزينية الكلية (m³) *' : 'Capacity (m³) *'}</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="goods-text-input"
                  />
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'الحالة التشغيلية' : 'Operating Status'}</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'maintenance' })}
                    className="goods-select-input"
                  >
                    <option value="active">{isAr ? 'نشط ويعمل بكفاءة' : 'Active & Operational'}</option>
                    <option value="maintenance">{isAr ? 'تحت الصيانة والجرد' : 'Under Maintenance'}</option>
                  </select>
                </div>
              </div>

              <div className="goods-input-group" style={{ marginTop: '12px' }}>
                <label>{isAr ? 'اسم المستودع / الفرع *' : 'Warehouse Name *'}</label>
                <input
                  type="text"
                  required
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder={isAr ? 'مثال: المستودع اللوجستي الرئيسي' : 'e.g. Central Logistics Hub'}
                  className="goods-text-input"
                  dir="auto"
                />
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="goods-input-group">
                  <label>{isAr ? 'المدير المسؤول *' : 'Responsible Manager *'}</label>
                  <input
                    type="text"
                    required
                    value={form.manager}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className="goods-text-input"
                  />
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'رقم هاتف التواصل *' : 'Contact Phone *'}</label>
                  <input
                    type="text"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="goods-text-input font-mono"
                    dir="ltr"
                    style={{ textAlign: isAr ? 'right' : 'left' }}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: GLOBAL LOCATION */}
            <div className="goods-form-section">
              <div className="section-title-row">
                <MapPin size={16} className="text-cyan" />
                <h4>{isAr ? '2. الموقع الجغرافي والعنوان اللوجستي' : '2. Geographic Location & Address'}</h4>
              </div>

              <div className="form-grid-3">
                <div className="goods-input-group">
                  <label>{isAr ? 'الدولة *' : 'Country *'}</label>
                  <select
                    value={countryCode}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="goods-select-input"
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
                    value={selectedStateValue}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setState(selected);
                      const matched = availableStates.find(s => s.nameAr === selected || s.nameEn === selected);
                      const cityName = matched ? (isAr ? matched.nameAr : matched.nameEn) : selected;
                      setForm(prev => ({ ...prev, city: cityName }));
                    }}
                    className="goods-select-input"
                  >
                    {availableStates.map(s => (
                      <option key={s.code} value={isAr ? s.nameAr : s.nameEn}>
                        {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="goods-input-group">
                  <label>{isAr ? 'المدينة / المنطقة *' : 'City / District *'}</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="goods-text-input"
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="goods-input-group">
                  <label>{isAr ? 'العنوان التفصيلي / المجمع اللوجستي' : 'Detailed Address / Logistics Park'}</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="goods-text-input"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="goods-input-group">
                    <label>{isAr ? 'الرمز البريدي' : 'Postal Code'}</label>
                    <input
                      type="text"
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      className="goods-text-input font-mono"
                    />
                  </div>

                  <div className="goods-input-group">
                    <label>{isAr ? 'العملة التشغيلية' : 'Currency'}</label>
                    <input
                      type="text"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="goods-text-input font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: STORAGE TYPE CLASSIFICATION */}
            <div className="goods-form-section">
              <div className="section-title-row">
                <Layers size={16} className="text-cyan" />
                <h4>{isAr ? '3. نوع وتصنيف التخزين والتحكم البيئي' : '3. Storage Classification'}</h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {STORAGE_CLASSIFICATIONS.map(st => {
                  const isSelected = form.storageType === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setForm({ ...form, storageType: st.id })}
                      style={{
                        background: isSelected ? 'var(--primary-light)' : 'var(--card-bg, #ffffff)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--foreground)' }}>
                          {isAr ? st.nameAr : st.nameEn}
                        </span>
                        {isSelected && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                        {isAr ? st.tempRangeAr : st.tempRangeEn}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Modal Actions Footer */}
          <div className="goods-modal-actions" style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="btn-modal-submit" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              <span>{isAr ? 'حفظ تعديلات المستودع' : 'Save Warehouse Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
