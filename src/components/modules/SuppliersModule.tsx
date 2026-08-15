import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Supplier } from '../../types';
import { 
  Truck, Plus, Search, History, CreditCard, Mail, MapPin, 
  Phone, Edit3, Building2, User, FileText, CheckCircle2, Trash2 
} from 'lucide-react';
import { DeleteConfirmationModal, RelatedDataCleanupItem } from '../common/DeleteConfirmationModal';

interface SuppliersModuleProps {
  activeSubTab?: string;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'directory' | 'ledger' | 'payments' => {
    if (subTab === 'supplier_ledger') return 'ledger';
    if (subTab === 'supplier_payments') return 'payments';
    return 'directory';
  };

  const [tab, setTab] = useState<'directory' | 'ledger' | 'payments'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSupId, setSelectedSupId] = useState<string>('');
  const [supplierDetail, setSupplierDetail] = useState<{ supplier: Supplier; ledger: any[]; unpaidInvoices: any[] } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Safe Cascade Delete State
  const [deleteTarget, setDeleteTarget] = useState<{
    supplier: Supplier;
    relatedData: RelatedDataCleanupItem[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState('');

  // Add Supplier Form
  const initialForm = {
    company_name: '',
    contact_person: '',
    mobile: '',
    email: '',
    address: '',
    city: 'Hubballi',
    state: 'Karnataka',
    pin: '580025',
    gstin: '',
    pan: '',
    payment_terms: '30 Days',
    credit_limit: 500000
  };

  const [form, setForm] = useState(initialForm);

  // Edit Supplier Form
  const [editForm, setEditForm] = useState(initialForm);

  const loadData = async () => {
    try {
      const res = await apiRequest(`/api/suppliers?search=${encodeURIComponent(search)}`);
      const sups = res.suppliers || [];
      setSuppliers(sups);
      if (sups.length > 0 && !selectedSupId) {
        setSelectedSupId(sups[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  useEffect(() => {
    if (selectedSupId && tab === 'ledger') {
      loadSupplierLedger(selectedSupId);
    }
  }, [selectedSupId, tab]);

  const loadSupplierLedger = async (id: string) => {
    try {
      const res = await apiRequest(`/api/suppliers/${id}`);
      setSupplierDetail(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/suppliers', { method: 'POST', body: JSON.stringify(form) });
      setShowAddModal(false);
      setForm(initialForm);
      loadData();
      alert('Supplier registered successfully with complete contact and address details.');
    } catch (err: any) {
      alert(err.message || 'Failed supplier creation.');
    }
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setEditForm({
      company_name: s.company_name || '',
      contact_person: s.contact_person || '',
      mobile: s.mobile || '',
      email: s.email || '',
      address: s.address || '',
      city: s.city || 'Hubballi',
      state: s.state || 'Karnataka',
      pin: s.pin || '580025',
      gstin: s.gstin || '',
      pan: s.pan || '',
      payment_terms: s.payment_terms || '30 Days',
      credit_limit: s.credit_limit !== undefined ? s.credit_limit : 500000
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    try {
      await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setShowEditModal(false);
      setEditingSupplier(null);
      loadData();
      if (selectedSupId === editingSupplier.id) {
        loadSupplierLedger(editingSupplier.id);
      }
      alert('Supplier profile updated successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to update supplier.');
    }
  };

  const handlePaySupplier = async (e: React.FormEvent, targetSupId?: string) => {
    e.preventDefault();
    const supId = targetSupId || selectedSupplier?.id || selectedSupId;
    if (!supId) return;

    try {
      await apiRequest(`/api/suppliers/${supId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentAmount),
          payment_mode: paymentMode,
          reference_number: paymentRef,
          remarks: 'Supplier Invoice Settlement Payment'
        })
      });
      setShowPayModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setSelectedSupplier(null);
      loadData();
      if (selectedSupId) loadSupplierLedger(selectedSupId);
      alert('Payment to supplier recorded.');
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.');
    }
  };

  const handlePromptDeleteSupplier = (s: Supplier) => {
    setDeleteTarget({
      supplier: s,
      relatedData: [
        { label: 'Vendor Ledger History', description: 'Debit/credit journal transactions, balance accruals, and past payment logs' },
        { label: 'Purchase Invoices', description: 'Past purchase bills will have their supplier reference archived to maintain tax records' },
        { label: 'Purchase Orders & Debit Notes', description: 'Open POs and purchase return vouchers associated with this vendor' }
      ]
    });
  };

  const handleExecuteDeleteSupplier = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/suppliers/${deleteTarget.supplier.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      alert('Failed to delete supplier: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>Suppliers & Vendor Directory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manufacturer profiles with email, full billing address, contact points, ledger accounts & payments
          </p>
        </div>

        {/* Sub Nav Buttons */}
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'directory' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Supplier Directory</span>
          </button>

          <button
            onClick={() => setTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'ledger' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Supplier Ledger</span>
          </button>

          <button
            onClick={() => setTab('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'payments' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Vendor Payments</span>
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
                placeholder="Search by company, email, address, mobile, GSTIN..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={() => {
                setForm(initialForm);
                setShowAddModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Supplier</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Company & Code</th>
                  <th className="p-3">Contact Person & Phone</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Address & Location</th>
                  <th className="p-3">GSTIN & PAN</th>
                  <th className="p-3 text-right">Payable Balance</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No suppliers found matching your query.
                    </td>
                  </tr>
                ) : (
                  suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>{s.company_name}</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono pl-5">{s.supplier_code}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1 text-slate-200">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{s.contact_person || 'N/A'}</span>
                        </div>
                        {s.mobile && (
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{s.mobile}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            className="text-cyan-400 hover:underline flex items-center space-x-1 font-mono text-[11px]"
                          >
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span>{s.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Not provided</span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="flex items-start space-x-1">
                          <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5" />
                          <div className="text-[11px] text-slate-300 line-clamp-2">
                            {s.address ? `${s.address}, ` : ''}
                            {s.city || 'Hubballi'}, {s.state || 'Karnataka'} {s.pin ? `- ${s.pin}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="text-slate-300 text-[11px] font-semibold">{s.gstin || 'GST Exempt'}</div>
                        {s.pan && <div className="text-[10px] text-slate-400">PAN: {s.pan}</div>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-bold text-amber-400">₹{(s.current_outstanding || 0).toLocaleString()}</div>
                        {s.credit_limit ? (
                          <div className="text-[10px] text-slate-500">Limit: ₹{s.credit_limit.toLocaleString()}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedSupplier(s);
                              setShowPayModal(true);
                            }}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                            title="Edit Supplier Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSupId(s.id);
                              setTab('ledger');
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                            title="View Supplier Ledger"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handlePromptDeleteSupplier(s)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors"
                            title="Delete Supplier & Cascade Clean Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <label className="text-xs font-semibold text-slate-300 min-w-max">Select Vendor Account:</label>
            <select
              value={selectedSupId}
              onChange={e => setSelectedSupId(e.target.value)}
              className="w-full sm:w-auto flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.company_name} ({s.supplier_code}) - Payable: ₹{s.current_outstanding}
                </option>
              ))}
            </select>
            {supplierDetail && (
              <button
                onClick={() => openEditModal(supplierDetail.supplier)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 border border-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {supplierDetail && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Supplier Information</div>
                  <div className="font-bold text-slate-100 text-sm mt-0.5">{supplierDetail.supplier.company_name}</div>
                  <div className="font-mono font-bold text-emerald-400 text-[11px]">{supplierDetail.supplier.supplier_code}</div>
                  <div className="text-slate-400 mt-1 flex items-center space-x-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{supplierDetail.supplier.contact_person || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Contact & Email</div>
                  <div className="mt-0.5 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-200">
                      <Phone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>{supplierDetail.supplier.mobile || 'No phone registered'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      {supplierDetail.supplier.email ? (
                        <a href={`mailto:${supplierDetail.supplier.email}`} className="text-cyan-400 hover:underline font-mono text-[11px]">
                          {supplierDetail.supplier.email}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No email</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Address & Tax Details</div>
                  <div className="mt-0.5 space-y-1">
                    <div className="flex items-start space-x-1 text-slate-300 text-[11px]">
                      <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span>
                        {supplierDetail.supplier.address ? `${supplierDetail.supplier.address}, ` : ''}
                        {supplierDetail.supplier.city || 'Hubballi'}, {supplierDetail.supplier.state || 'Karnataka'} {supplierDetail.supplier.pin ? `- ${supplierDetail.supplier.pin}` : ''}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-300">
                      GSTIN: <span className="font-semibold text-slate-100">{supplierDetail.supplier.gstin || 'None'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Net Payable Balance</div>
                    <div className="font-bold text-xl text-amber-400 mt-0.5">₹{supplierDetail.supplier.current_outstanding}</div>
                    <div className="text-[10px] text-slate-500">Terms: {supplierDetail.supplier.payment_terms || '30 Days'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplierDetail.supplier);
                      setShowPayModal(true);
                    }}
                    className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1 rounded text-xs transition-colors"
                  >
                    Make Payment
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-200">Supplier Account Ledger Statement</h3>
                  <span className="text-[10px] text-slate-400">Total Transactions: {supplierDetail.ledger.length}</span>
                </div>
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Ref / Invoice No</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Debit (Paid ₹)</th>
                      <th className="p-3 text-right">Credit (Purchased ₹)</th>
                      <th className="p-3 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {supplierDetail.ledger.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-500">No transaction history recorded for this vendor.</td></tr>
                    ) : (
                      supplierDetail.ledger.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-800/40">
                          <td className="p-3 text-slate-300 font-mono text-[11px]">{l.transaction_date}</td>
                          <td className="p-3 font-mono text-emerald-400 font-semibold">{l.reference_no}</td>
                          <td className="p-3 text-slate-200">{l.description}</td>
                          <td className="p-3 text-right font-semibold text-emerald-400">{l.debit > 0 ? `₹${l.debit}` : '-'}</td>
                          <td className="p-3 text-right font-semibold text-rose-400">{l.credit > 0 ? `₹${l.credit}` : '-'}</td>
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

      {/* TAB 3: PAYMENTS */}
      {tab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 md:col-span-1 shadow-lg">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Record Supplier Payment Voucher</span>
            </h3>

            <form onSubmit={e => handlePaySupplier(e)} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Supplier *</label>
                <select
                  value={selectedSupId}
                  onChange={e => setSelectedSupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name} (Payable: ₹{s.current_outstanding})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 25000"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-100 font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ref / UTR No</label>
                  <input
                    type="text"
                    placeholder="Ref No"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg mt-2"
              >
                Execute Vendor Payment
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 md:col-span-2 shadow-lg">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Vendors with Pending Payables</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-2.5">Company Name & Email</th>
                    <th className="p-2.5">Address & GSTIN</th>
                    <th className="p-2.5 text-right">Pending Payable</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {suppliers.filter(s => s.current_outstanding > 0).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-500">
                        No outstanding supplier payables!
                      </td>
                    </tr>
                  ) : (
                    suppliers.filter(s => s.current_outstanding > 0).map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-100">{s.company_name}</div>
                          {s.email && <div className="text-[10px] text-cyan-400 font-mono">{s.email}</div>}
                        </td>
                        <td className="p-2.5 text-slate-400">
                          <div className="text-[11px] text-slate-300">{s.city || 'Hubballi'}, {s.state || 'Karnataka'}</div>
                          <div className="text-[10px] font-mono">{s.gstin || 'None'}</div>
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-400">₹{s.current_outstanding}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedSupplier(s);
                              setSelectedSupId(s.id);
                              setShowPayModal(true);
                            }}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded text-[11px] font-semibold"
                          >
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Register New Supplier</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaveri Seeds Corporation Pvt Ltd"
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Hegde"
                    value={form.contact_person}
                    onChange={e => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={form.mobile}
                    onChange={e => setForm({ ...form, mobile: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. orders@kaveriseeds.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-2 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Premise / Street Address</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Plot No 42, APMC Market Yard, NH4 Highway"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-2 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Hubballi"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Karnataka"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PIN Code</label>
                  <input
                    type="text"
                    placeholder="580025"
                    value={form.pin}
                    onChange={e => setForm({ ...form, pin: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="29AABCB9876E1Z5"
                    value={form.gstin}
                    onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PAN Number</label>
                  <input
                    type="text"
                    placeholder="AABCB9876E"
                    value={form.pan}
                    onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Credit / Payment Terms</label>
                  <select
                    value={form.payment_terms}
                    onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="7 Days">7 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    placeholder="500000"
                    value={form.credit_limit}
                    onChange={e => setForm({ ...form, credit_limit: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg mt-3 transition-colors">
                Register Supplier
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER */}
      {showEditModal && editingSupplier && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Edit Supplier Profile - {editingSupplier.supplier_code}</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.company_name}
                  onChange={e => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editForm.contact_person}
                    onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    value={editForm.mobile}
                    onChange={e => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-2 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Premise / Street Address</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Plot / Street / Area"
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-2 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={editForm.pin}
                    onChange={e => setEditForm({ ...editForm, pin: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={editForm.gstin}
                    onChange={e => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={editForm.pan}
                    onChange={e => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Terms</label>
                  <select
                    value={editForm.payment_terms}
                    onChange={e => setEditForm({ ...editForm, payment_terms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="7 Days">7 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={editForm.credit_limit}
                    onChange={e => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg mt-3 transition-colors">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY SUPPLIER */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Make Payment to {selectedSupplier.company_name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Payable:</span>
                <span className="font-bold text-amber-400">₹{selectedSupplier.current_outstanding}</span>
              </div>
              {selectedSupplier.email && (
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-cyan-400" />
                  <span className="font-mono">{selectedSupplier.email}</span>
                </div>
              )}
            </div>
            <form onSubmit={e => handlePaySupplier(e, selectedSupplier.id)} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow-lg mt-2">
                Execute Supplier Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleExecuteDeleteSupplier}
          title="Delete Supplier Account"
          itemName={deleteTarget.supplier.company_name}
          itemType="SUPPLIER"
          itemCode={deleteTarget.supplier.supplier_code}
          warningMessage={`Deleting supplier "${deleteTarget.supplier.company_name}" will archive outstanding balances and safely clean up transaction ledgers without breaking invoice tax reports.`}
          relatedData={deleteTarget.relatedData}
          requireTypingConfirm={false}
          confirmWord="DELETE"
          isDeleting={isDeleting}
        />
      )}

    </div>
  );
};

