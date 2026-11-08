import React, { useState, useEffect } from 'react';
import { 
  Users, Phone, Mail, MapPin, Plus, Star, ShieldCheck, 
  X, Check, Building2, AlertCircle 
} from 'lucide-react';
import { getStoredSuppliers, saveStoredSuppliers, initialSuppliers } from '../../services/storageService';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';

interface SuppliersViewProps {
  lang: 'en' | 'ar';
}

interface SupplierItem {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  country: string;
  category: string;
  rating: number;
  activePOs: number;
}

export default function SuppliersView({ lang }: SuppliersViewProps) {
  const isAr = lang === 'ar';

  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() => getStoredSuppliers());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form State
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState(isAr ? 'تجهيزات ومعدات إلكترونية' : 'Electronics & Hardware');
  const [rating, setRating] = useState('4.8');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    saveStoredSuppliers(suppliers);
  }, [suppliers]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenModal = () => {
    setCompany('');
    setContact('');
    setPhone('');
    setEmail('');
    setCountry('');
    setCategory(isAr ? 'تجهيزات ومعدات إلكترونية' : 'Electronics & Hardware');
    setRating('4.8');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم شركة التوريد' : 'Please enter company name');
      return;
    }
    if (!contact.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم جهة الاتصال / الشخص المسؤول' : 'Please enter contact person name');
      return;
    }
    if (!phone.trim()) {
      setFormError(isAr ? 'يرجى إدخال رقم الهاتف' : 'Please enter phone number');
      return;
    }

    const nextIdNum = suppliers.length + 1;
    const newId = `SUP-${nextIdNum < 10 ? `0${nextIdNum}` : nextIdNum}`;

    const newSupplier: SupplierItem = {
      id: newId,
      company: company.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
      email: email.trim() || 'contact@supplier.com',
      country: country.trim() || (isAr ? 'عالمي' : 'International'),
      category: category.trim(),
      rating: Number(rating) || 4.8,
      activePOs: 1
    };

    const updated = [newSupplier, ...suppliers];
    setSuppliers(updated);
    saveStoredSuppliers(updated);
    setIsAddModalOpen(false);
    showToast(isAr ? `تمت إضافة المورد (${newSupplier.company}) وحفظه في النظام بنجاح!` : `Supplier ${newSupplier.company} added and saved!`);
  };

  return (
    <div className="view-content-wrapper fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-banner glass-panel" style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999 }}>
          <Check size={16} className="green-text" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">{isAr ? 'دليل الموردين والتوريدات' : 'Authorized Suppliers Directory'}</h2>
          <p className="view-subtitle">{isAr ? 'قائمة الموردين المعتمدين، اتفاقيات التوريد، والاتصال المباشر' : 'Approved vendors, SLA agreements, and active purchase contracts'}</p>
        </div>

        <button type="button" className="btn-add-primary" onClick={handleOpenModal}>
          <Plus size={16} />
          <span>{isAr ? 'إضافة مورد جديد' : 'New Supplier'}</span>
        </button>
      </div>

      {/* Suppliers Grid Cards */}
      <div className="suppliers-grid">
        {suppliers.map(s => (
          <div key={s.id} className="wh-card glass-panel fade-in">
            <div className="wh-card-header">
              <div className="wh-avatar-box">
                <Building2 size={22} className="text-cyan" />
              </div>
              <div>
                <span className="code-badge font-mono">{s.id}</span>
                <h3 className="wh-card-title"><span dir="auto">{s.company}</span></h3>
                <small className="category-tag">{s.category}</small>
              </div>
            </div>

            <div className="wh-meta-list">
              <div className="wh-meta-row">
                <Users size={15} />
                <span dir="auto">{s.contact}</span>
              </div>
              <div className="wh-meta-row">
                <Phone size={15} />
                <span><bdi>{s.phone}</bdi></span>
              </div>
              <div className="wh-meta-row">
                <Mail size={15} />
                <span>{s.email}</span>
              </div>
              <div className="wh-meta-row">
                <MapPin size={15} />
                <span dir="auto">{s.country}</span>
              </div>
            </div>

            <div className="wh-occupancy-section">
              <div className="occ-labels">
                <span>{isAr ? 'تقييم المورد:' : 'Supplier Rating:'}</span>
                <strong className="green-text">{s.rating} / 5.0</strong>
              </div>
              <div className="occ-labels">
                <span>{isAr ? 'أوامر الشراء النشطة:' : 'Active Purchase Orders:'}</span>
                <strong className="orange-text">{s.activePOs} {isAr ? 'شحنات قيد التوريد' : 'orders in transit'}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Supplier Modal - Robust Modern Design */}
      {isAddModalOpen && (
        <DialogPortal>
          <DialogOverlay onClick={() => setIsAddModalOpen(false)} />
          <DialogContent
            className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl p-0 text-foreground overflow-hidden flex flex-col my-auto"
            style={{
              maxWidth: '560px',
              width: '95%',
              maxHeight: '90vh',
              padding: 0,
              borderRadius: '1rem',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
            }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Modal Header (Pinned) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground leading-tight m-0">
                    {isAr ? 'إضافة مورد تجاري جديد' : 'Register New Vendor / Supplier'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-normal m-0">
                    {isAr ? 'إدراج بيانات الشركة، المسؤول، ووسائل التواصل' : 'Enter vendor credentials, primary contact & catalog info'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="p-1.5 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={() => setIsAddModalOpen(false)}
                title={isAr ? 'إلغاء' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSupplier} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Form Body */}
              <div className="p-5 overflow-y-auto max-h-[calc(85vh-130px)] space-y-3.5">
                {/* Error Banner */}
                {formError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'اسم شركة التوريد' : 'Company / Vendor Name'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: شركة النور للتجارة العامة' : 'e.g. Al-Noor Global Trading'}
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                      <Building2 className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'الشخص المسؤول / جهة الاتصال' : 'Contact Person'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: م. مصطفى العبيدي' : 'e.g. Mustafa Al-Obeidi'}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Users className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'رقم الهاتف والتواصل' : 'Phone Number'} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'مثال: 0770 123 4567' : '+964 770 123 4567'}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Phone className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="orders@supplier.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        dir="ltr"
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <Mail className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'الدولة والمدينة والفرع' : 'Country & Location'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={isAr ? 'مثال: الدولة - المدينة / العنوان' : 'e.g. Country - City / Region'}
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                      <MapPin className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'مجال التوريد والتخصص' : 'Supply Category'}
                    </label>
                    <input
                      type="text"
                      placeholder={isAr ? 'إلكترونيات وشاشات وأجهزة ذكية' : 'Electronics, Monitors & Hardware'}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-9 w-full px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-foreground block">
                      {isAr ? 'التقييم الأولي (من 5.0)' : 'Initial Rating'}
                    </label>
                    <div className="relative">
                      <select 
                        value={rating} 
                        onChange={(e) => setRating(e.target.value)}
                        className="h-9 w-full ps-3 pe-8 rounded-lg border border-border bg-background text-foreground text-xs font-bold outline-none focus:border-primary cursor-pointer transition-all"
                      >
                        <option value="5.0">{isAr ? '5.0 - مميز جداً' : '5.0 - Excellent'}</option>
                        <option value="4.9">{isAr ? '4.9 - معتمد وممتاز' : '4.9 - Approved'}</option>
                        <option value="4.8">{isAr ? '4.8 - جيد جداً' : '4.8 - Very Good'}</option>
                        <option value="4.5">{isAr ? '4.5 - موثوق' : '4.5 - Reliable'}</option>
                      </select>
                      <Star className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Pinned) */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-border bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isAr ? 'حفظ وإضافة المورد' : 'Save & Register'}</span>
                </button>
              </div>
            </form>
          </DialogContent>
        </DialogPortal>
      )}
    </div>
  );
}
