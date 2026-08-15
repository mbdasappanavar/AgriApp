import React, { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, Package, PackagePlus,
  Users, Truck, Landmark, BarChart3, Settings, ShieldAlert, FileSpreadsheet,
  ChevronRight, ChevronDown, Sparkles, Sprout
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'pos' | 'sales_history' | 'sales_returns'
  | 'purchase_orders' | 'purchase_invoices' | 'purchase_returns'
  | 'stock_current' | 'stock_movements' | 'stock_adjustments' | 'stock_transfers' | 'batch_expiry'
  | 'products' | 'categories' | 'brands' | 'units' | 'hsn'
  | 'customers' | 'customer_ledger' | 'customer_payments'
  | 'suppliers' | 'supplier_ledger' | 'supplier_payments'
  | 'expenses' | 'cash_register' | 'day_closing' | 'gst_hub'
  | 'reports_sales' | 'reports_profit' | 'reports_aging' | 'reports_export'
  | 'admin_users' | 'admin_stores' | 'admin_audit' | 'admin_backup';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { hasPermission } = useAuth();
  const [openSection, setOpenSection] = useState<string>('sales');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? '' : section);
  };

  const navItem = (id: ActiveTab, label: string, permCode?: string) => {
    if (permCode && !hasPermission(permCode)) return null;
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
          isActive
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <span>{label}</span>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />}
      </button>
    );
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30 text-white font-bold">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold text-xs tracking-tight text-white flex items-center space-x-1">
            <span>SRI REVANASIDDESHWARA</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold tracking-wide">Agro Center, Kalaghatagi</div>
        </div>
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-sm scrollbar-thin scrollbar-thumb-slate-800">
        {/* Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        {/* Sales & POS */}
        <div className="pt-2">
          <button
            onClick={() => toggleSection('sales')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sales & POS</span>
            </div>
            {openSection === 'sales' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'sales' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('pos', 'POS Counter Billing', 'pos:access')}
              {navItem('sales_history', 'Sales History & Invoices', 'sales:view')}
              {navItem('sales_returns', 'Sales Returns & Exchange', 'sales:return')}
            </div>
          )}
        </div>

        {/* Purchases */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('purchases')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Purchases</span>
            </div>
            {openSection === 'purchases' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'purchases' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('purchase_invoices', 'Purchase Invoices', 'purchases:view')}
              {navItem('purchase_orders', 'Purchase Orders', 'purchases:view')}
            </div>
          )}
        </div>

        {/* Inventory */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('inventory')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>Inventory</span>
            </div>
            {openSection === 'inventory' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'inventory' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('stock_current', 'Current Stock Levels', 'inventory:view')}
              {navItem('batch_expiry', 'Batch & Expiry Watch', 'inventory:view')}
              {navItem('stock_adjustments', 'Stock Adjustments', 'inventory:adjust')}
              {navItem('stock_movements', 'Inventory Movement Ledger', 'inventory:view')}
            </div>
          )}
        </div>

        {/* Masters */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('masters')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <PackagePlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Products & Masters</span>
            </div>
            {openSection === 'masters' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'masters' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('products', 'Product Catalog Master', 'products:manage')}
              {navItem('categories', 'Hierarchical Categories', 'products:manage')}
              {navItem('brands', 'Brands & Manufacturers', 'products:manage')}
              {navItem('units', 'Units & Conversions', 'products:manage')}
              {navItem('hsn', 'HSN & GST Configuration', 'products:manage')}
            </div>
          )}
        </div>

        {/* Customers */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('customers')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customers & Credit</span>
            </div>
            {openSection === 'customers' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'customers' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('customers', 'Customer Directory & Credit', 'customers:manage')}
              {navItem('customer_ledger', 'Customer Ledger Statements', 'customers:manage')}
            </div>
          )}
        </div>

        {/* Suppliers */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('suppliers')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Suppliers</span>
            </div>
            {openSection === 'suppliers' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'suppliers' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('suppliers', 'Supplier Directory & Payables', 'suppliers:manage')}
              {navItem('supplier_ledger', 'Supplier Ledger Statements', 'suppliers:manage')}
            </div>
          )}
        </div>

        {/* Finance & GST */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('finance')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>Finance & GST</span>
            </div>
            {openSection === 'finance' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'finance' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('cash_register', 'Daily Cash Register', 'expenses:manage')}
              {navItem('day_closing', 'Day Closing & Manager Lock', 'day_closing:execute')}
              {navItem('expenses', 'Store Expense Tracker', 'expenses:manage')}
              {navItem('gst_hub', 'GST Returns & Input Tax', 'gst:view')}
            </div>
          )}
        </div>

        {/* Reports */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('reports')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Business Reports</span>
            </div>
            {openSection === 'reports' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'reports' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('reports_sales', 'Sales Reports & Registers', 'reports:view')}
              {navItem('reports_profit', 'Profitability & COGS Analysis', 'reports:view')}
              {navItem('reports_aging', 'Overdue Outstanding Aging', 'reports:view')}
              {navItem('reports_export', 'Export Reports (CSV / PDF)', 'reports:view')}
            </div>
          )}
        </div>

        {/* Administration */}
        <div className="pt-1">
          <button
            onClick={() => toggleSection('admin')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>Administration</span>
            </div>
            {openSection === 'admin' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSection === 'admin' && (
            <div className="ml-3 pl-2 border-l border-slate-800 mt-1 space-y-1">
              {navItem('admin_users', 'Users & Role Permissions', 'users:manage')}
              {navItem('admin_stores', 'Store Profile & Config', 'settings:manage')}
              {navItem('admin_audit', 'System Audit Trail Logs', 'audit:view')}
              {navItem('admin_backup', 'Database Backup & CSV Import', 'backup:manage')}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 text-center bg-slate-950/60">
        <div>Indian GST Compliant v2.6.0</div>
        <div className="text-[10px] text-slate-600 mt-0.5">ACID Database Persistence Active</div>
      </div>
    </aside>
  );
};
