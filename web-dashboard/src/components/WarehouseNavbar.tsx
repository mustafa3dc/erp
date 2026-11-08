import React from 'react';
import { 
  Boxes, 
  Warehouse, 
  Bell, 
  Sun, 
  Moon, 
  Globe, 
  Search, 
  ShieldCheck,
  QrCode,
  Plus
} from 'lucide-react';

interface WarehouseNavbarProps {
  selectedWarehouse: string;
  setSelectedWarehouse: (id: string) => void;
  warehouses: Array<{ id: string; nameAr: string; nameEn: string }>;
  theme: string;
  toggleTheme: () => void;
  lang: string;
  toggleLang: () => void;
  onOpenAddProduct: () => void;
  onOpenScanner: () => void;
}

export default function WarehouseNavbar({
  selectedWarehouse,
  setSelectedWarehouse,
  warehouses,
  theme,
  toggleTheme,
  lang,
  toggleLang,
  onOpenAddProduct,
  onOpenScanner
}: WarehouseNavbarProps) {
  const isAr = lang === 'ar';

  return (
    <header className="navbar-container glass-panel">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-wrapper">
          <div className="brand-icon-box">
            <Boxes className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <div className="brand-title">
              <span>ERP</span> <span className="brand-accent">Warehouse</span> Pro
            </div>
            <div className="brand-subtitle">
              {isAr ? 'منظومة إدارة المخازن والمستودعات والتوريد' : 'Enterprise Supply Chain & Logistics Suite'}
            </div>
          </div>
        </div>

        {/* Multi-Warehouse Selector */}
        <div className="warehouse-selector-pill">
          <Warehouse size={16} className="wh-icon" />
          <span className="wh-label">{isAr ? 'المستودع النشط:' : 'Active Hub:'}</span>
          <select 
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="wh-select"
          >
            <option value="ALL">{isAr ? ' كل المستودعات والفروع' : ' All Warehouses'}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>
                {wh.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="navbar-actions">
          {/* Barcode Quick Scan */}
          <button className="action-btn-outline" onClick={onOpenScanner} title={isAr ? 'مسح الباركود' : 'Barcode Scanner'}>
            <QrCode size={16} />
            <span>{isAr ? 'قارئ الباركود' : 'Barcode Scan'}</span>
          </button>

          {/* Quick Add Product */}
          <button className="btn-primary-glow" onClick={onOpenAddProduct}>
            <Plus size={16} />
            <span>{isAr ? 'إضافة بضاعة' : 'Add Item'}</span>
          </button>

          {/* Language Toggle */}
          <button className="action-icon-btn" onClick={toggleLang}>
            <Globe size={18} />
            <span className="lang-text">{isAr ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme Toggle */}
          <button className="action-icon-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} className="theme-sun" /> : <Moon size={18} />}
          </button>

          {/* User Badge */}
          <div className="user-badge-mini">
            <span className="online-indicator"></span>
            <span>{isAr ? 'مدير العمليات اللوجستية' : 'Logistics Manager'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
