import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import {
  BarChart3, FileSpreadsheet, Download, Printer, Search,
  TrendingUp, DollarSign, Calendar, Users, Filter, FileText
} from 'lucide-react';

interface ReportsModuleProps {
  activeSubTab?: string;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ activeSubTab }) => {
  const getReportFromSubTab = (subTab?: string): 'sales' | 'profit' | 'aging' | 'export' => {
    if (subTab === 'reports_sales') return 'sales';
    if (subTab === 'reports_aging') return 'aging';
    if (subTab === 'reports_export') return 'export';
    return 'profit';
  };

  const [activeReport, setActiveReport] = useState<'sales' | 'profit' | 'aging' | 'export'>(() =>
    getReportFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setActiveReport(getReportFromSubTab(activeSubTab));
  }, [activeSubTab]);

  const [profitData, setProfitData] = useState<any[]>([]);
  const [agingData, setAgingData] = useState<any | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);

  // Universal Export Hub state
  const [exportCategory, setExportCategory] = useState<
    'sales' | 'purchases' | 'inventory' | 'farmers' | 'suppliers' | 'profitability' | 'expenses' | 'gst'
  >('sales');

  const [exportData, setExportData] = useState<any[]>([]);
  const [exportSearch, setExportSearch] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);

  const loadReports = async () => {
    try {
      if (activeReport === 'sales') {
        const res = await apiRequest('/api/sales');
        setSalesData(res.invoices || []);
      } else if (activeReport === 'profit') {
        const res = await apiRequest('/api/reports/profitability');
        setProfitData(res.productProfit || []);
      } else if (activeReport === 'aging') {
        const res = await apiRequest('/api/reports/aging');
        setAgingData(res);
      } else if (activeReport === 'export') {
        loadExportCategoryData(exportCategory);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadReports();
  }, [activeReport, exportCategory]);

  const loadExportCategoryData = async (cat: string) => {
    setLoadingExport(true);
    try {
      if (cat === 'sales') {
        const res = await apiRequest('/api/sales');
        setExportData(res.invoices || []);
      } else if (cat === 'purchases') {
        const res = await apiRequest('/api/purchases');
        setExportData(res.purchases || []);
      } else if (cat === 'inventory') {
        const res = await apiRequest('/api/products');
        setExportData(res.products || []);
      } else if (cat === 'farmers') {
        const res = await apiRequest('/api/customers');
        setExportData(res.customers || []);
      } else if (cat === 'suppliers') {
        const res = await apiRequest('/api/suppliers');
        setExportData(res.suppliers || []);
      } else if (cat === 'profitability') {
        const res = await apiRequest('/api/reports/profitability');
        setExportData(res.productProfit || []);
      } else if (cat === 'expenses') {
        const res = await apiRequest('/api/expenses');
        setExportData(res.expenses || []);
      } else if (cat === 'gst') {
        const res = await apiRequest('/api/gst/summary');
        setExportData([
          { type: 'GSTR-1 Outward Taxable Sales', amount: res.outwardTaxable, cgst: res.outwardCGST, sgst: res.outwardSGST, totalTax: res.outwardTaxable * 0.18 },
          { type: 'GSTR-3B Input Tax Credit Purchases', amount: res.inwardTaxable, cgst: res.inwardCGST, sgst: res.inwardSGST, totalTax: res.inwardTaxable * 0.18 },
          { type: 'Net GST Liability Payable', amount: res.netTaxLiability, cgst: res.netTaxLiability/2, sgst: res.netTaxLiability/2, totalTax: res.netTaxLiability }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExport(false);
    }
  };

  // Filter export data based on search term
  const filteredExportData = exportData.filter(row => {
    if (!exportSearch) return true;
    const str = JSON.stringify(row).toLowerCase();
    return str.includes(exportSearch.toLowerCase());
  });

  // CSV Exporter Utility
  const handleExportCSV = () => {
    if (filteredExportData.length === 0) {
      alert('No data available to export');
      return;
    }

    const keys = Object.keys(filteredExportData[0]);
    const csvRows = [];
    csvRows.push(keys.join(','));

    for (const row of filteredExportData) {
      const values = keys.map(key => {
        const val = row[key] === null || row[key] === undefined ? '' : row[key];
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${exportCategory.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print / Save as PDF Utility
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header & Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Business Analytics & Export Reports Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sales registers, gross profitability, farmer receivables, and universal CSV/PDF export center
          </p>
        </div>

        {/* Report Sub-Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveReport('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeReport === 'sales' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sales Registers
          </button>
          <button
            onClick={() => setActiveReport('profit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeReport === 'profit' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profitability & COGS
          </button>
          <button
            onClick={() => setActiveReport('aging')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeReport === 'aging' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Outstanding Aging
          </button>
          <button
            onClick={() => setActiveReport('export')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
              activeReport === 'export' ? 'bg-emerald-600 text-white shadow' : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV / PDF</span>
          </button>
        </div>
      </div>

      {/* REPORT 1: SALES REGISTERS */}
      {activeReport === 'sales' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center text-xs">
            <span className="font-bold text-slate-200">Daily Sales Invoices Register</span>
            <span className="text-slate-400">Total Invoices: {salesData.length}</span>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer / Farmer</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3 text-right">Grand Total (₹)</th>
                  <th className="p-3 text-right">Balance Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salesData.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No sales invoices recorded.</td></tr>
                ) : (
                  salesData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-emerald-400">{s.invoice_number}</td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">{s.invoice_date}</td>
                      <td className="p-3 font-semibold text-slate-100">{s.customer_name || 'Counter Customer'}</td>
                      <td className="p-3 font-semibold text-teal-400">{s.payment_mode}</td>
                      <td className="p-3 text-right font-bold text-slate-100">₹{s.grand_total}</td>
                      <td className="p-3 text-right font-bold text-amber-400">₹{s.balance_due || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: PROFITABILITY */}
      {activeReport === 'profit' && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Units Sold</th>
                <th className="p-3 text-right">Total Revenue (₹)</th>
                <th className="p-3 text-right">Cost of Goods Sold (₹)</th>
                <th className="p-3 text-right">Gross Profit (₹)</th>
                <th className="p-3 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {profitData.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-100">{p.product_name}</td>
                  <td className="p-3 text-slate-400">{p.category_name}</td>
                  <td className="p-3 text-right font-medium">{p.total_qty}</td>
                  <td className="p-3 text-right font-bold text-slate-200">₹{p.total_revenue.toFixed(2)}</td>
                  <td className="p-3 text-right text-slate-400">₹{p.total_cogs.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-emerald-400">₹{p.gross_profit.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-teal-400">{p.margin_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REPORT 3: AGING */}
      {activeReport === 'aging' && agingData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Farmer Credit Receivables Aging</h3>
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-2">Farmer Name</th>
                  <th className="p-2">Village</th>
                  <th className="p-2 text-right">Credit Limit</th>
                  <th className="p-2 text-right">Outstanding (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {agingData.customerAging?.map((c: any) => (
                  <tr key={c.id}>
                    <td className="p-2 font-semibold text-slate-100">{c.name}</td>
                    <td className="p-2 text-slate-400">{c.village}</td>
                    <td className="p-2 text-right text-slate-400">₹{c.credit_limit}</td>
                    <td className="p-2 text-right font-bold text-rose-400">₹{c.current_outstanding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Supplier Payables Aging</h3>
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-2">Supplier Company</th>
                  <th className="p-2">Contact</th>
                  <th className="p-2 text-right">Payable Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {agingData.supplierAging?.map((s: any) => (
                  <tr key={s.id}>
                    <td className="p-2 font-semibold text-slate-100">{s.company_name}</td>
                    <td className="p-2 text-slate-400">{s.contact_person}</td>
                    <td className="p-2 text-right font-bold text-amber-400">₹{s.current_outstanding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: UNIVERSAL EXPORT CENTER (CSV / PDF) */}
      {activeReport === 'export' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 shadow-lg print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Dataset Select */}
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <label className="text-xs font-bold text-slate-300">Select Report Dataset:</label>
                <select
                  value={exportCategory}
                  onChange={e => setExportCategory(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none"
                >
                  <option value="sales">🛒 Sales Invoices & Registers</option>
                  <option value="purchases">📦 Supplier Purchase Invoices (Inward Stock)</option>
                  <option value="inventory">🏷️ Products & Stock Inventory Master</option>
                  <option value="farmers">👨‍🌾 Farmers Directory & Credit Khata Balances</option>
                  <option value="suppliers">🚚 Suppliers & Vendor Accounts</option>
                  <option value="profitability">📈 Product Gross Profit & Margins</option>
                  <option value="expenses">💸 Store Expenses Ledger</option>
                  <option value="gst">🏛️ GST Tax Summary (GSTR-1 & R3B)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportCSV}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export PDF / Print</span>
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter report dataset by any keyword..."
                  value={exportSearch}
                  onChange={e => setExportSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing {filteredExportData.length} of {exportData.length} records
              </span>
            </div>
          </div>

          {/* Printable Report Header (Visible when printing / PDF) */}
          <div className="hidden print:block p-6 bg-white text-black space-y-4">
            <div className="border-b-2 border-black pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wide">Sri Revanasiddeshwara Agro Center</h1>
                <p className="text-xs text-gray-700">APMC Market Yard, Kalaghatagi, Dharwad, Karnataka - 581204</p>
                <p className="text-xs text-gray-700">GSTIN: 29AABCS1234F1Z5 | Phone: +91 98450 12345</p>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold text-sm uppercase">Official Audit Report</div>
                <div>Category: <span className="font-semibold uppercase">{exportCategory}</span></div>
                <div>Generated: {new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-slate-900 print:bg-white print:text-black rounded-xl border border-slate-800 print:border-none overflow-x-auto shadow-md">
            {loadingExport ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading dataset...</div>
            ) : filteredExportData.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No data available in this report view.</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-200 print:text-black">
                <thead className="bg-slate-950 print:bg-gray-100 text-slate-400 print:text-black uppercase font-semibold border-b border-slate-800 print:border-black text-[10px]">
                  <tr>
                    {Object.keys(filteredExportData[0]).map((key) => (
                      <th key={key} className="p-3 capitalize">
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-300">
                  {filteredExportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      {Object.keys(row).map((key) => (
                        <td key={key} className="p-3 font-mono text-[11px]">
                          {typeof row[key] === 'object' && row[key] !== null
                            ? JSON.stringify(row[key])
                            : String(row[key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Signature Block for Printed PDF */}
          <div className="hidden print:flex justify-between items-end pt-12 text-xs text-black">
            <div>
              <p className="font-bold">Prepared By</p>
              <p className="text-gray-600">Authorized Store Manager</p>
            </div>
            <div className="text-right">
              <p className="font-bold">Sri Revanasiddeshwara Agro Center</p>
              <p className="text-gray-600 mt-6">Authorized Signatory</p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
