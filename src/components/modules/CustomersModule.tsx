import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Customer } from '../../types';
import { Users, Plus, Search, DollarSign, FileText, CheckCircle2, History, CreditCard } from 'lucide-react';

interface CustomersModuleProps {
  activeSubTab?: string;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'directory' | 'ledger' | 'payments' => {
    if (subTab === 'customer_ledger') return 'ledger';
    if (subTab === 'customer_payments') return 'payments';
    return 'directory';
  };

  const [tab, setTab] = useState<'directory' | 'ledger' | 'payments'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustId, setSelectedCustId] = useState<string>('');
  const [customerDetail, setCustomerDetail] = useState<{ customer: Customer; ledger: any[]; unpaidInvoices: any[]; creditNotes?: any[] } | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', village: '', mobile: ''
  });

  const loadData = async () => {
    try {
      const res = await apiRequest(`/api/customers?search=${encodeURIComponent(search)}`);
      const custs = res.customers || [];
      setCustomers(custs);
      if (custs.length > 0 && !selectedCustId) {
        setSelectedCustId(custs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  useEffect(() => {
    if (selectedCustId && tab === 'ledger') {
      loadCustomerLedger(selectedCustId);
    }
  }, [selectedCustId, tab]);

  const loadCustomerLedger = async (id: string) => {
    try {
      const res = await apiRequest(`/api/customers/${id}`);
      setCustomerDetail(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/customers', { method: 'POST', body: JSON.stringify(form) });
      setShowAddModal(false);
      setForm({ name: '', village: '', mobile: '' });
      loadData();
      alert('Customer created successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to create customer.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent, targetCustId?: string) => {
    e.preventDefault();
    const custId = targetCustId || selectedCust?.id || selectedCustId;
    if (!custId) return;

    try {
      await apiRequest(`/api/customers/${custId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentAmount),
          payment_mode: paymentMode,
          reference_number: paymentRef,
          remarks: 'Customer Khata Collection Receipt'
        })
      });
      setShowPayModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setSelectedCust(null);
      loadData();
      if (selectedCustId) loadCustomerLedger(selectedCustId);
      alert('Payment receipt recorded successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header & Sub-Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Farmers & Credit Khata Accounts</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Village registers, ledger statement audit, and receipt collection entries
          </p>
        </div>

        {/* Sub-Nav Buttons */}
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'directory' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Farmer Directory</span>
          </button>

          <button
            onClick={() => setTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'ledger' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Ledger Statements</span>
          </button>

          <button
            onClick={() => setTab('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'payments' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Khata Collection Receipts</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DIRECTORY */}
      {tab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by farmer name, mobile, village..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Register Farmer</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Customer Full Name & Code</th>
                  <th className="p-3">Village</th>
                  <th className="p-3">Mobile Number</th>
                  <th className="p-3 text-right">Outstanding Balance</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-semibold text-slate-100">{c.name}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">{c.customer_code}</div>
                    </td>
                    <td className="p-3 text-slate-200">
                      <div>{c.village || 'N/A'}</div>
                    </td>
                    <td className="p-3 text-slate-300 font-mono">
                      <div>{c.mobile || 'N/A'}</div>
                    </td>
                    <td className="p-3 text-right font-bold">
                      <span className={c.current_outstanding > 0 ? "text-amber-400" : "text-emerald-400"}>
                        ₹{c.current_outstanding}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedCust(c);
                          setShowPayModal(true);
                        }}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-[11px] font-semibold"
                      >
                        Receive Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER STATEMENTS */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <label className="text-xs font-semibold text-slate-300 min-w-max">Select Farmer Account:</label>
            <select
              value={selectedCustId}
              onChange={e => setSelectedCustId(e.target.value)}
              className="w-full sm:w-auto flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-semibold"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customer_code}) - {c.village} - Balance: ₹{c.current_outstanding}
                </option>
              ))}
            </select>
          </div>

          {customerDetail && (
            <div className="space-y-4">
              {/* Customer Summary Card */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-slate-400 text-[10px]">Customer Code & Name</div>
                  <div className="font-mono font-bold text-emerald-400">{customerDetail.customer.customer_code}</div>
                  <div className="font-bold text-slate-100">{customerDetail.customer.name}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Village</div>
                  <div className="font-semibold text-slate-200">{customerDetail.customer.village || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Mobile Number</div>
                  <div className="font-semibold text-slate-200 font-mono">{customerDetail.customer.mobile || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Current Khata Outstanding</div>
                  <div className="font-bold text-lg text-amber-400">₹{customerDetail.customer.current_outstanding}</div>
                </div>
              </div>

              {/* Customer Credit Notes Registry */}
              {customerDetail.creditNotes && customerDetail.creditNotes.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-teal-500/30 overflow-x-auto shadow-md">
                  <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-teal-400" />
                      <h3 className="text-xs font-bold text-teal-300">Issued Credit Notes & Store Credits Mapping</h3>
                    </div>
                    <span className="text-[10px] text-slate-400">Total Credit Notes: {customerDetail.creditNotes.length}</span>
                  </div>
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="p-3">Credit Note #</th>
                        <th className="p-3">Issued Date</th>
                        <th className="p-3">Original Sale Return #</th>
                        <th className="p-3 text-right">Total Credit (₹)</th>
                        <th className="p-3 text-right">Redeemed (₹)</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Redeemed In Sale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customerDetail.creditNotes.map((cn: any) => {
                        const status = cn.credit_note_status || 'Active';
                        const isUsed = status === 'Used';
                        const isPartiallyUsed = status === 'Partially Used';

                        return (
                          <tr key={cn.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-teal-400">{cn.credit_note_number || cn.return_number}</td>
                            <td className="p-3 text-slate-300 font-mono text-[11px]">{cn.return_date}</td>
                            <td className="p-3 font-mono text-slate-400">{cn.original_invoice_number || 'N/A'}</td>
                            <td className="p-3 text-right font-bold text-emerald-400">₹{cn.grand_total}</td>
                            <td className="p-3 text-right font-semibold text-amber-400">₹{cn.used_amount || 0}</td>
                            <td className="p-3 text-center">
                              {isUsed ? (
                                <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">
                                  Redeemed / Inactive
                                </span>
                              ) : isPartiallyUsed ? (
                                <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-bold">
                                  Partially Used
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-bold">
                                  Active / Unredeemed
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {cn.redeemed_invoice_number ? (
                                <div className="text-[11px]">
                                  <span className="font-mono font-bold text-emerald-400">{cn.redeemed_invoice_number}</span>
                                  {cn.redeemed_invoice_date && <span className="text-[10px] text-slate-400 block">({cn.redeemed_invoice_date})</span>}
                                </div>
                              ) : (
                                <span className="text-slate-500 text-[11px] font-italic">Not yet used</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Transactions Table */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-200">Farmer Khata Account Ledger</h3>
                  <span className="text-[10px] text-slate-400">Total Entries: {customerDetail.ledger.length}</span>
                </div>
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Ref / Invoice No</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                      <th className="p-3 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customerDetail.ledger.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-500">No transaction records found for this farmer.</td></tr>
                    ) : (
                      customerDetail.ledger.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-800/40">
                          <td className="p-3 text-slate-300 font-mono text-[11px]">{l.transaction_date}</td>
                          <td className="p-3 font-mono text-emerald-400 font-semibold">{l.reference_no}</td>
                          <td className="p-3 text-slate-200">{l.description}</td>
                          <td className="p-3 text-right font-semibold text-rose-400">{l.debit > 0 ? `₹${l.debit}` : '-'}</td>
                          <td className="p-3 text-right font-semibold text-emerald-400">{l.credit > 0 ? `₹${l.credit}` : '-'}</td>
                          <td className="p-3 text-right font-bold text-slate-100">₹{l.balance}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS COLLECTION */}
      {tab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 md:col-span-1 shadow-lg">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Record Farmer Khata Receipt</span>
            </h3>

            <form onSubmit={e => handleRecordPayment(e)} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Farmer *</label>
                <select
                  value={selectedCustId}
                  onChange={e => setSelectedCustId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Due: ₹{c.current_outstanding})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount Received (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-100 font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    placeholder="Ref No"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg mt-2"
              >
                Issue Payment Receipt
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 md:col-span-2 shadow-lg">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Farmers with Outstanding Balances</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-2.5">Farmer Name</th>
                    <th className="p-2.5">Village</th>
                    <th className="p-2.5 text-right">Outstanding Khata Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {customers.filter(c => c.current_outstanding > 0).map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-100">{c.name}</td>
                      <td className="p-2.5 text-slate-400">{c.village}</td>
                      <td className="p-2.5 text-right font-bold text-amber-400">₹{c.current_outstanding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER CUSTOMER */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Register New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basavaraj Patil"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Village *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navalgund"
                  value={form.village}
                  onChange={e => setForm({ ...form, village: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow-lg mt-2">
                Register Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE PAYMENT */}
      {showPayModal && selectedCust && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Record Payment from {selectedCust.name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400">✕</button>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Village:</span> <span className="font-semibold">{selectedCust.village}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Current Balance:</span> <span className="font-bold text-amber-400">₹{selectedCust.current_outstanding}</span></div>
            </div>
            <form onSubmit={e => handleRecordPayment(e, selectedCust.id)} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / PhonePe</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow-lg mt-2">
                Submit Payment Receipt
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
