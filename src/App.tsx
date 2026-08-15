import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { PosBilling } from './components/pos/PosBilling';
import { SalesModule } from './components/modules/SalesModule';
import { ProductsModule } from './components/modules/ProductsModule';
import { CustomersModule } from './components/modules/CustomersModule';
import { SuppliersModule } from './components/modules/SuppliersModule';
import { PurchasesModule } from './components/modules/PurchasesModule';
import { InventoryModule } from './components/modules/InventoryModule';
import { FinanceModule } from './components/modules/FinanceModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { AdminModule } from './components/modules/AdminModule';
import { LoginScreen } from './components/auth/LoginScreen';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400">
        <div className="text-center space-y-3">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-medium">Initializing Shri Revanasiddeshwara Agro Center System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'pos':
        return <PosBilling />;
      case 'sales_history':
      case 'sales_returns':
        return <SalesModule activeSubTab={activeTab} />;
      case 'products':
      case 'categories':
      case 'brands':
      case 'units':
      case 'hsn':
        return <ProductsModule activeSubTab={activeTab} />;
      case 'customers':
      case 'customer_ledger':
      case 'customer_payments':
        return <CustomersModule activeSubTab={activeTab} />;
      case 'suppliers':
      case 'supplier_ledger':
      case 'supplier_payments':
        return <SuppliersModule activeSubTab={activeTab} />;
      case 'purchase_invoices':
      case 'purchase_orders':
      case 'purchase_returns':
        return <PurchasesModule activeSubTab={activeTab} />;
      case 'stock_current':
      case 'batch_expiry':
      case 'stock_adjustments':
      case 'stock_transfers':
      case 'stock_movements':
        return <InventoryModule activeSubTab={activeTab} />;
      case 'cash_register':
      case 'day_closing':
      case 'expenses':
      case 'gst_hub':
        return <FinanceModule activeSubTab={activeTab} />;
      case 'reports_sales':
      case 'reports_profit':
      case 'reports_aging':
      case 'reports_export':
        return <ReportsModule activeSubTab={activeTab} />;
      case 'admin_users':
      case 'admin_stores':
      case 'admin_audit':
      case 'admin_backup':
        return <AdminModule activeSubTab={activeTab} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden antialiased">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
