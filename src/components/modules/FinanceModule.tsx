import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Landmark, Lock, DollarSign, Receipt, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface FinanceModuleProps {
  activeSubTab?: string;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'register' | 'closing' | 'expenses' | 'gst' => {
    if (subTab === 'cash_register') return 'register';
    if (subTab === 'day_closing') return 'closing';
    if (subTab === 'expenses') return 'expenses';
    if (subTab === 'gst_hub') return 'gst';
    return 'register';
  };

  const [activeTab, setActiveTab] = useState<'register' | 'closing' | 'expenses' | 'gst'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setActiveTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);
  const [register, setRegister] = useState<any | null>(null);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [gstSummary, setGstSummary] = useState<any | null>(null);
  const [closingResult, setClosingResult] = useState<any | null>(null);

  // Expense form
  const [expCategory, setExpCategory] = useState('Rent & Utilities');
  const [expVendor, setExpVendor] = useState('');
  const [expAmount, setExpAmount] = useState('');

  const loadData = async () => {
    try {
      const regRes = await apiRequest('/api/cash/register');
      setRegister(regRes.register);

      const expRes = await apiRequest('/api/expenses');
      setExpenses(expRes.expenses || []);

      const gstRes = await apiRequest('/api/gst/summary');
      setGstSummary(gstRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecuteDayClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/cash/day-closing', {
        method: 'POST',
        body: JSON.stringify({
          actual_cash: Number(actualCash),
          notes
        })
      });
      setClosingResult(res.closingSummary);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Day closing failed');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: expCategory,
          vendor_name: expVendor,
          amount: Number(expAmount),
          payment_mode: 'Cash'
        })
      });
      setExpVendor('');
      setExpAmount('');
      loadData();
      alert('Expense recorded.');
    } catch (err: any) {
      alert(err.message || 'Expense failed');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-emerald-400" />
            <span>Finance, Cash Register & Indian GST Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Day closing manager reconciliation, cash register lock, expense tracking, and GSTR-1 / GSTR-2 tax liability.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'register' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cash Register Status
          </button>
          <button
            onClick={() => setActiveTab('closing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'closing' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Day Closing & Lock
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'expenses' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Expenses Tracker
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'gst' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            GST Returns & Summary
          </button>
        </div>
      </div>

      {activeTab === 'register' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Landmark className="w-4 h-4 text-emerald-400" />
            <span>Daily Cash Register Overview</span>
          </h3>

          {register ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Opening Balance</span>
                <div className="text-xl font-bold text-slate-100">₹{register.opening_cash}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Cash Sales Collected</span>
                <div className="text-xl font-bold text-emerald-400">₹{register.cash_sales}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Farmer Cash Receipts</span>
                <div className="text-xl font-bold text-teal-400">₹{register.customer_cash_payments || 0}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Expected Closing Cash</span>
                <div className="text-xl font-bold text-amber-400">₹{register.expected_closing_cash}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Loading cash register summary...</p>
          )}
        </div>
      )}

      {activeTab === 'closing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Daily Cash Register & Day Closing Lock</span>
            </h3>

            {register && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Register Date:</span><span className="font-bold text-slate-100">{register.register_date}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Opening Cash:</span><span className="font-semibold text-slate-200">₹{register.opening_cash}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Status:</span><span className={register.status === 'Closed' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{register.status}</span></div>
              </div>
            )}

            {register?.status === 'Closed' ? (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs font-semibold">
                Cash register for today is CLOSED and locked by Manager.
              </div>
            ) : (
              <form onSubmit={handleExecuteDayClosing} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Enter Physical Cash Counted in Drawer (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Physical cash count"
                    value={actualCash}
                    onChange={e => setActualCash(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2.5 text-slate-100 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Manager Day Closing Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Verified by Ramesh (Manager)"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg">
                  Lock Register & Execute Day Closing
                </button>
              </form>
            )}
          </div>

          {closingResult && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 text-xs">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Day Closing Statement Executed</span>
              </h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Total Sales:</span><span className="font-bold">₹{closingResult.totalSales}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cash Sales:</span><span>₹{closingResult.cashSales}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">UPI / Digital Sales:</span><span>₹{closingResult.upiSales + closingResult.cardSales}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Expected Drawer Cash:</span><span className="font-bold text-slate-200">₹{closingResult.expectedCash}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Actual Counted Cash:</span><span className="font-bold text-emerald-400">₹{closingResult.actualCash}</span></div>
                <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                  <span>Cash Shortage / Overage:</span>
                  <span className={closingResult.difference < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    ₹{closingResult.difference}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-100">Record Store Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                >
                  <option value="Rent & Utilities">Rent & Utilities</option>
                  <option value="Electricity Bill">Electricity Bill</option>
                  <option value="Freight & Transport">Freight & Transport</option>
                  <option value="Staff Salary & Refreshment">Staff Salary & Refreshment</option>
                  <option value="Shop Maintenance">Shop Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Paid To (Vendor Name)</label>
                <input
                  type="text"
                  placeholder="e.g. HESCOM Electricity"
                  value={expVendor}
                  onChange={e => setExpVendor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg">
                Record Expense
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                <tr>
                  <th className="p-3">Expense #</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Vendor / Notes</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-emerald-400">{e.expense_number}</td>
                    <td className="p-3 font-medium">{e.category}</td>
                    <td className="p-3 text-slate-400">{e.vendor_name || 'N/A'}</td>
                    <td className="p-3 text-slate-400">{e.expense_date}</td>
                    <td className="p-3 text-right font-bold text-slate-100">₹{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'gst' && gstSummary && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">GSTR-1 Output GST (Sales Tax)</div>
              <div className="text-xl font-bold text-emerald-400">₹{gstSummary.outputGst.total_tax.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">Taxable Sales: ₹{gstSummary.outputGst.taxable.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">GSTR-2 Input Tax Credit (ITC)</div>
              <div className="text-xl font-bold text-teal-400">₹{gstSummary.inputGst.total_tax.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">Taxable Inward: ₹{gstSummary.inputGst.taxable.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">Net GST Tax Payable Liability</div>
              <div className="text-xl font-bold text-amber-400">₹{gstSummary.netLiability.total.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">CGST: ₹{gstSummary.netLiability.cgst.toFixed(2)} | SGST: ₹{gstSummary.netLiability.sgst.toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-100">HSN Code-wise GST Sales Summary</h3>
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                <tr>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Taxable Value (₹)</th>
                  <th className="p-3 text-right">CGST (₹)</th>
                  <th className="p-3 text-right">SGST (₹)</th>
                  <th className="p-3 text-right">Total GST Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {gstSummary.hsnSummary.map((h: any) => (
                  <tr key={h.hsn_code} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-emerald-400">{h.hsn_code}</td>
                    <td className="p-3 text-slate-400">{h.description || 'Agricultural Commodities'}</td>
                    <td className="p-3 text-right font-medium">₹{h.taxable_value.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{h.cgst.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{h.sgst.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-slate-100">₹{h.total_tax.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
