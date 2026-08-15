import { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, Package, AlertTriangle, Users,
  BarChart2, ArrowUpRight, ArrowDownRight, Sprout
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { LowStockWidget } from './LowStockWidget';

export const Dashboard = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboard = () => {
    setIsLoading(true);
    setErrorMsg(null);
    apiRequest('/api/reports/dashboard')
      .then(res => {
        setData(res);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load dashboard:', err);
        setErrorMsg(err.message || 'Could not fetch dashboard statistics');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
        <span>Loading Executive Agri Business Dashboard...</span>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 my-12 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="text-rose-400 font-semibold text-sm">
          {errorMsg || 'Unable to display dashboard data.'}
        </div>
        <p className="text-xs text-slate-400">
          Please verify server connection or user credentials.
        </p>
        <button
          onClick={loadDashboard}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg"
        >
          Retry Loading Dashboard
        </button>
      </div>
    );
  }

  const { kpis, charts } = data;

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Header Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Sprout className="w-5 h-5 text-emerald-400" />
            <span>Retail Executive Dashboard & KPIs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time sales, profitability, inventory valuation, and Indian GST analytics.
          </p>
        </div>
      </div>

      {/* KPI Cards Row 1: Sales & Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Today's Net Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">₹{kpis.todaySales.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <span className="text-emerald-400 font-semibold">{kpis.todayInvoices} bills</span>
            <span>| Avg bill ₹{Math.round(kpis.avgInvoice)}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Monthly Gross Profit</span>
            <DollarSign className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">₹{kpis.grossProfit.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <span className="text-emerald-400 font-semibold">{kpis.marginPct}% Gross Margin</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Monthly Net Profit</span>
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">₹{kpis.netProfit.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">
            Expenses deducted: ₹{kpis.monthExpenses.toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Inventory Cost Valuation</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">₹{kpis.inventoryValuationCost.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">
            MRP value: ₹{kpis.inventoryValuationMrp.toLocaleString()} ({kpis.totalProducts} items)
          </div>
        </div>
      </div>

      {/* KPI Cards Row 2: Receivables & Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Total Customer Receivables</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400">₹{kpis.totalReceivables.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">Farmer credit balance</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Total Supplier Payables</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400">₹{kpis.totalPayables.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">Outstanding supplier invoices</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Low Stock Items</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">{kpis.lowStockCount} Products</div>
          <div className="text-[11px] text-slate-400">Reorder threshold reached</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Expired Batches</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-500">{kpis.expiredCount} Batches</div>
          <div className="text-[11px] text-slate-400">Requires removal / return</div>
        </div>
      </div>

      {/* Proactive Low Stock & Reordering Widget */}
      <LowStockWidget />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200">7-Day Sales Trend (₹)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.salesTrend}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Top 5 Selling Products by Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.topProducts}>
                <XAxis dataKey="product_name" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.length > 12 ? `${v.slice(0, 12)}...` : v} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
