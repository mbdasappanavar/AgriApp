import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../api/client';
import {
  ShoppingBag, Plus, FileText, RotateCcw, Search, Eye, Trash2,
  Calendar, CheckCircle2, AlertCircle, Tag, IndianRupee,
  Building2, Hash, Percent, RefreshCw, X, Sparkles,
  ClipboardList, ArrowRight, Truck, CheckCheck, Clock,
  Mail, MapPin
} from 'lucide-react';
import { CreatePurchaseOrderModal } from './purchases/CreatePurchaseOrderModal';
import { ViewPurchaseOrderModal } from './purchases/ViewPurchaseOrderModal';
import { CreatePurchaseReturnModal } from './purchases/CreatePurchaseReturnModal';

interface PurchasesModuleProps {
  activeSubTab?: string;
}

interface PurchaseItemInput {
  product_id: string;
  product_name?: string;
  hsn_code: string;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  quantity: number;
  unit: string;
  unit_price: number;
  selling_price: number;
  mrp: number;
  discount_pct: number;
  discount: number;
}

export const PurchasesModule: React.FC<PurchasesModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'invoices' | 'orders' | 'returns' => {
    if (subTab === 'purchase_orders') return 'orders';
    if (subTab === 'purchase_returns') return 'returns';
    return 'invoices';
  };

  const [tab, setTab] = useState<'invoices' | 'orders' | 'returns'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [viewPoModal, setViewPoModal] = useState<any | null>(null);
  const [showAddReturnModal, setShowAddReturnModal] = useState(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<any | null>(null);
  const [viewInvoiceItems, setViewInvoiceItems] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Credit note update modal for existing invoices
  const [creditNoteModalInvoice, setCreditNoteModalInvoice] = useState<any | null>(null);
  const [cnUpdateStatus, setCnUpdateStatus] = useState<'received' | 'promised_pending'>('received');
  const [cnUpdateNumber, setCnUpdateNumber] = useState('');
  const [cnUpdateDate, setCnUpdateDate] = useState(new Date().toISOString().split('T')[0]);
  const [cnUpdateAmount, setCnUpdateAmount] = useState<number>(0);
  const [cnUpdateNotes, setCnUpdateNotes] = useState('');

  // Purchase Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashDiscount, setCashDiscount] = useState<number>(0);
  
  // Supplier Credit Note in Entry Form
  const [creditNoteMode, setCreditNoteMode] = useState<'none' | 'received' | 'promised'>('none');
  const [creditNoteNo, setCreditNoteNo] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0);
  const [supplierNotes, setSupplierNotes] = useState('');

  // Multiple Product Rows
  const defaultItem: PurchaseItemInput = {
    product_id: '',
    hsn_code: '1209',
    batch_number: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
    mfg_date: '2026-01-01',
    expiry_date: '2028-12-31',
    quantity: 10,
    unit: 'Kg',
    unit_price: 100,
    selling_price: 140,
    mrp: 150,
    discount_pct: 0,
    discount: 0
  };

  const [items, setItems] = useState<PurchaseItemInput[]>([defaultItem]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/purchases');
      setPurchases(res.purchases || []);

      const poRes = await apiRequest('/api/purchases/orders');
      setPurchaseOrders(poRes.orders || []);

      const retRes = await apiRequest('/api/purchases/returns');
      setPurchaseReturns(retRes.returns || []);

      const supRes = await apiRequest('/api/suppliers');
      setSuppliers(supRes.suppliers || []);

      const prodRes = await apiRequest('/api/products');
      setProducts(prodRes.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to convert PO directly to Inward Purchase Invoice
  const handleConvertPoToInvoice = async (po: any, poItems?: any[]) => {
    let orderItems = poItems;
    if (!orderItems || orderItems.length === 0) {
      try {
        const res = await apiRequest(`/api/purchases/orders/${po.id}`);
        orderItems = res.items || [];
      } catch (e) {
        orderItems = [];
      }
    }

    setSupplierId(po.supplier_id);
    setSupplierInvNo(`INV-INW-${po.po_number.replace('PO-', '')}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setSupplierNotes(`Inwarded against Purchase Order ${po.po_number}. Expected terms: ${po.payment_terms || 'Net 30'}`);

    if (orderItems && orderItems.length > 0) {
      setItems(orderItems.map((oi: any) => {
        const prod = products.find(p => p.id === oi.product_id);
        const rate = Number(oi.rate) || 100;
        return {
          product_id: oi.product_id,
          product_name: oi.product_name || prod?.name,
          hsn_code: oi.hsn_code || prod?.hsn_code || '1209',
          batch_number: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
          mfg_date: '2026-01-01',
          expiry_date: '2028-12-31',
          quantity: oi.quantity || 10,
          unit: oi.unit || prod?.unit || 'Kg',
          unit_price: rate,
          selling_price: prod?.selling_price || prod?.mrp || Math.round(rate * 1.3),
          mrp: prod?.mrp || Math.round(rate * 1.4),
          discount_pct: 0,
          discount: oi.discount || 0
        };
      }));
    }

    setShowAddModal(true);
  };

  // Helper to get selected supplier details
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === supplierId);
  }, [suppliers, supplierId]);

  // Handle product change in row
  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    const updated = [...items];
    if (prod) {
      updated[index] = {
        ...updated[index],
        product_id: prod.id,
        product_name: prod.name,
        hsn_code: prod.hsn_code || '1209',
        unit: prod.unit || 'Kg',
        unit_price: prod.purchase_price || 100,
        selling_price: prod.selling_price || prod.mrp || 140,
        mrp: prod.mrp || 150
      };
    } else {
      updated[index].product_id = '';
    }
    setItems(updated);
  };

  // Add another product row
  const handleAddProductRow = () => {
    const newBatchNo = `BAT-${Math.floor(100000 + Math.random() * 900000)}`;
    setItems([
      ...items,
      {
        ...defaultItem,
        batch_number: newBatchNo
      }
    ]);
  };

  // Remove a product row
  const handleRemoveProductRow = (index: number) => {
    if (items.length <= 1) {
      alert('At least one product item is required in the purchase invoice.');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Quick HSN presets
  const applyHsnPreset = (index: number, hsn: string) => {
    const updated = [...items];
    updated[index].hsn_code = hsn;
    setItems(updated);
  };

  // Calculate live summary for form
  const formCalculations = useMemo(() => {
    let grossTotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let estimatedGst = 0;
    let totalQty = 0;

    items.forEach(it => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.unit_price) || 0;
      let disc = Number(it.discount) || 0;
      if (it.discount_pct > 0 && disc === 0) {
        disc = (qty * rate * it.discount_pct) / 100;
      }
      const lineGross = qty * rate;
      const lineTaxable = Math.max(0, lineGross - disc);
      
      grossTotal += lineGross;
      totalDiscount += disc;
      totalTaxable += lineTaxable;
      estimatedGst += lineTaxable * 0.18; // approx 18%
      totalQty += qty;
    });

    const invoiceGrandTotal = totalTaxable + estimatedGst;
    const immediateDeduction = (creditNoteMode === 'received' ? Number(creditNoteAmount) || 0 : 0) + (Number(cashDiscount) || 0);
    const netBalanceDue = Math.max(0, invoiceGrandTotal - immediateDeduction);

    return {
      grossTotal,
      totalDiscount,
      totalTaxable,
      estimatedGst,
      invoiceGrandTotal,
      immediateDeduction,
      netBalanceDue,
      totalQty
    };
  }, [items, cashDiscount, creditNoteMode, creditNoteAmount]);

  // Handle submit purchase invoice
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert('Please select a supplier.');
    if (!supplierInvNo.trim()) return alert('Please enter the supplier invoice / bill number.');
    
    // Check products
    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) {
        return alert(`Please select a product for row #${i + 1}`);
      }
      if (!items[i].quantity || items[i].quantity <= 0) {
        return alert(`Please enter a valid quantity for item #${i + 1}`);
      }
      if (items[i].unit_price < 0) {
        return alert(`Please enter a valid unit purchase price for item #${i + 1}`);
      }
    }

    try {
      const payload = {
        supplier_id: supplierId,
        supplier_invoice_no: supplierInvNo.trim(),
        invoice_date: invoiceDate,
        cash_discount: Number(cashDiscount) || 0,
        supplier_credit_note_status: creditNoteMode === 'none' ? 'none' : creditNoteMode === 'received' ? 'received' : 'promised_pending',
        supplier_credit_note_no: creditNoteMode !== 'none' ? creditNoteNo : null,
        supplier_credit_note_date: creditNoteMode !== 'none' ? creditNoteDate : null,
        supplier_credit_note_amount: creditNoteMode !== 'none' ? (Number(creditNoteAmount) || 0) : 0,
        supplier_notes: supplierNotes.trim() || null,
        items: items.map(it => ({
          product_id: it.product_id,
          hsn_code: it.hsn_code.trim() || '1209',
          batch_number: it.batch_number.trim() || `BAT-${Date.now().toString().slice(-6)}`,
          mfg_date: it.mfg_date,
          expiry_date: it.expiry_date,
          quantity: Number(it.quantity),
          unit: it.unit || 'Kg',
          unit_price: Number(it.unit_price),
          selling_price: Number(it.selling_price) || Number(it.mrp) || Number(it.unit_price),
          mrp: Number(it.mrp) || Number(it.selling_price) || Number(it.unit_price),
          discount: Number(it.discount) || 0,
          discount_pct: Number(it.discount_pct) || 0
        }))
      };

      const res = await apiRequest('/api/purchases', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(`✅ Purchase Invoice ${res.invoiceNumber || ''} recorded successfully! Inventory stock & batch pricing updated.`);
      setShowAddModal(false);
      
      // Reset form
      setSupplierId('');
      setSupplierInvNo('');
      setCashDiscount(0);
      setCreditNoteMode('none');
      setCreditNoteNo('');
      setCreditNoteAmount(0);
      setSupplierNotes('');
      setItems([{ ...defaultItem, batch_number: `BAT-${Math.floor(100000 + Math.random() * 900000)}` }]);
      
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase invoice');
    }
  };

  // Open invoice details
  const handleViewInvoiceDetails = async (invoice: any) => {
    setViewInvoiceModal(invoice);
    setLoadingDetails(true);
    try {
      const res = await apiRequest(`/api/purchases/invoices/${invoice.id}`);
      setViewInvoiceItems(res.items || []);
    } catch (err: any) {
      console.error(err);
      setViewInvoiceItems([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open credit note update modal
  const handleOpenCreditNoteModal = (invoice: any) => {
    setCreditNoteModalInvoice(invoice);
    setCnUpdateStatus(invoice.supplier_credit_note_status === 'promised_pending' ? 'received' : 'received');
    setCnUpdateNumber(invoice.supplier_credit_note_no || '');
    setCnUpdateDate(invoice.supplier_credit_note_date || new Date().toISOString().split('T')[0]);
    setCnUpdateAmount(invoice.supplier_credit_note_amount || 0);
    setCnUpdateNotes(invoice.supplier_notes || '');
  };

  // Submit credit note update
  const handleSaveCreditNoteUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditNoteModalInvoice) return;

    try {
      await apiRequest(`/api/purchases/invoices/${creditNoteModalInvoice.id}/credit-note`, {
        method: 'PATCH',
        body: JSON.stringify({
          supplier_credit_note_status: cnUpdateStatus,
          supplier_credit_note_no: cnUpdateNumber.trim() || null,
          supplier_credit_note_date: cnUpdateDate,
          supplier_credit_note_amount: Number(cnUpdateAmount) || 0,
          supplier_notes: cnUpdateNotes.trim() || null
        })
      });

      alert('✅ Supplier Credit Note and reference notes updated successfully.');
      setCreditNoteModalInvoice(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update credit note');
    }
  };

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.toLowerCase();
    return purchases.filter(p =>
      (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
      (p.supplier_invoice_no && p.supplier_invoice_no.toLowerCase().includes(q)) ||
      (p.company_name && p.company_name.toLowerCase().includes(q)) ||
      (p.supplier_credit_note_no && p.supplier_credit_note_no.toLowerCase().includes(q)) ||
      (p.supplier_notes && p.supplier_notes.toLowerCase().includes(q))
    );
  }, [purchases, searchQuery]);

  // Filtered Purchase Orders
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchesStatus = poStatusFilter === 'All' || po.status === poStatusFilter;
      if (!matchesStatus) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (po.po_number && po.po_number.toLowerCase().includes(q)) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(q)) ||
        (po.company_name && po.company_name.toLowerCase().includes(q)) ||
        (po.notes && po.notes.toLowerCase().includes(q))
      );
    });
  }, [purchaseOrders, poStatusFilter, searchQuery]);

  // Filtered Purchase Returns
  const filteredPurchaseReturns = useMemo(() => {
    if (!searchQuery.trim()) return purchaseReturns;
    const q = searchQuery.toLowerCase();
    return purchaseReturns.filter(pr =>
      (pr.return_number && pr.return_number.toLowerCase().includes(q)) ||
      (pr.purchase_invoice_number && pr.purchase_invoice_number.toLowerCase().includes(q)) ||
      (pr.supplier_name && pr.supplier_name.toLowerCase().includes(q)) ||
      (pr.company_name && pr.company_name.toLowerCase().includes(q)) ||
      (pr.reason && pr.reason.toLowerCase().includes(q))
    );
  }, [purchaseReturns, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header & Sub Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <span>Procurement & Purchase Inward</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Stock inward, multi-product purchase invoices, HSN codes, supplier discounts, credit notes, and retail price setup
          </p>
        </div>

        {/* Sub Nav Buttons */}
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'invoices' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Purchase Invoices</span>
          </button>

          <button
            onClick={() => setTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'orders' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Purchase Orders</span>
          </button>

          <button
            onClick={() => setTab('returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'returns' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Purchase Returns / DN</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PURCHASE INVOICES */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          
          {/* Top Bar: Search, Stats & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Inv #, Supplier Bill #, Supplier Name, Credit Note #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                title="Refresh List"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>Record Purchase Invoice</span>
              </button>
            </div>
          </div>

          {/* Quick Summary Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Total Inward Invoices</span>
              <span className="text-lg font-bold text-slate-100 font-mono">{purchases.length}</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Total Inward Value</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                ₹{purchases.reduce((acc, p) => acc + (p.grand_total || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Supplier Credit Notes</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                ₹{purchases.reduce((acc, p) => acc + (p.supplier_credit_note_amount || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Cash Discounts Received</span>
              <span className="text-lg font-bold text-cyan-400 font-mono">
                ₹{purchases.reduce((acc, p) => acc + (p.cash_discount || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Purchase Inv #</th>
                  <th className="p-3">Supplier Bill #</th>
                  <th className="p-3">Supplier Name & GSTIN</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3 text-right">Taxable Value</th>
                  <th className="p-3 text-right">Total GST</th>
                  <th className="p-3">Credit Note / Discount & Notes</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      {loading ? 'Loading purchase records...' : 'No purchase invoices found.'}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-emerald-400 font-mono">
                        {p.invoice_number}
                      </td>
                      <td className="p-3 text-slate-200 font-mono font-semibold">
                        {p.supplier_invoice_no}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{p.company_name || p.supplier_name}</div>
                        {p.supplier_gstin && (
                          <div className="text-[10px] text-slate-400 font-mono">GSTIN: {p.supplier_gstin}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{p.invoice_date}</td>
                      <td className="p-3 text-right font-medium text-slate-300">
                        ₹{(p.taxable_value || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        ₹{(p.total_tax || 0).toFixed(2)}
                      </td>
                      <td className="p-3 max-w-[200px]">
                        {p.supplier_credit_note_status === 'received' && (
                          <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <Tag className="w-3 h-3" />
                            <span>CN: ₹{p.supplier_credit_note_amount} ({p.supplier_credit_note_no || 'Recvd'})</span>
                          </div>
                        )}
                        {p.supplier_credit_note_status === 'promised_pending' && (
                          <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" />
                            <span>CN Promised: ₹{p.supplier_credit_note_amount || 0} (Pending)</span>
                          </div>
                        )}
                        {p.cash_discount > 0 && (
                          <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                            Cash Disc: ₹{p.cash_discount}
                          </div>
                        )}
                        {p.supplier_notes && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={p.supplier_notes}>
                            📝 {p.supplier_notes}
                          </div>
                        )}
                        {p.supplier_credit_note_status === 'none' && !p.cash_discount && !p.supplier_notes && (
                          <span className="text-slate-500 text-[10px]">Standard</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-100 font-mono">
                        ₹{(p.grand_total || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleViewInvoiceDetails(p)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded transition"
                            title="View Invoice & Items Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenCreditNoteModal(p)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition"
                            title="Manage / Update Supplier Credit Note & Notes"
                          >
                            <Tag className="w-3.5 h-3.5" />
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

      {/* TAB 2: PURCHASE ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-300">Supplier Purchase Orders (PO)</span>
              <div className="flex items-center space-x-1">
                {['All', 'Ordered', 'Draft', 'Completed', 'Cancelled'].map(st => (
                  <button
                    key={st}
                    onClick={() => setPoStatusFilter(st)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                      poStatusFilter === st
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowAddPoModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Supplier & GSTIN</th>
                  <th className="p-3">PO Date & Delivery</th>
                  <th className="p-3 text-center">Items</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">Estimated GST</th>
                  <th className="p-3 text-right">PO Total Value</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPurchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      <div className="space-y-2">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                        <p>No purchase orders found matching your search.</p>
                        <button
                          onClick={() => setShowAddPoModal(true)}
                          className="text-emerald-400 font-semibold hover:underline text-xs"
                        >
                          + Create your first Purchase Order
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPurchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <button
                          onClick={() => setViewPoModal(po)}
                          className="font-mono font-bold text-emerald-400 hover:underline flex items-center space-x-1"
                        >
                          <span>{po.po_number}</span>
                        </button>
                        {po.payment_terms && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{po.payment_terms}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{po.company_name || po.supplier_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          GSTIN: {po.supplier_gstin || 'Unregistered'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-300">{po.po_date}</div>
                        {po.expected_delivery ? (
                          <div className="text-[10px] text-emerald-400">Due: {po.expected_delivery}</div>
                        ) : (
                          <div className="text-[10px] text-slate-500">Standard delivery</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
                          {po.items_count || 1} lines
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        ₹{(po.subtotal || po.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-400">
                        ₹{(po.tax_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                        ₹{(po.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          po.status === 'Completed' || po.status === 'Received'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : po.status === 'Cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : po.status === 'Draft'
                            ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {po.status || 'Ordered'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setViewPoModal(po)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded transition"
                            title="View PO Details & Print"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleConvertPoToInvoice(po)}
                            className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded transition flex items-center space-x-1"
                            title="Convert to Inward Purchase Invoice / Receive Stock"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold hidden lg:inline">Inward</span>
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

      {/* TAB 3: PURCHASE RETURNS */}
      {tab === 'returns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Purchase Returns & Supplier Debit Notes</span>
            <button
              onClick={() => setShowAddReturnModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Purchase Return</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Debit Note #</th>
                  <th className="p-3">Original Purchase Inv #</th>
                  <th className="p-3">Supplier & GSTIN</th>
                  <th className="p-3">Return Date</th>
                  <th className="p-3 text-right">Taxable Value</th>
                  <th className="p-3 text-right">Total GST</th>
                  <th className="p-3 text-right">Debit Note Total</th>
                  <th className="p-3 text-center">Reason</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPurchaseReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      <div className="space-y-2">
                        <RotateCcw className="w-8 h-8 text-slate-600 mx-auto" />
                        <p>No purchase returns / debit notes recorded yet.</p>
                        <button
                          onClick={() => setShowAddReturnModal(true)}
                          className="text-rose-400 font-semibold hover:underline text-xs"
                        >
                          + Record your first Purchase Return
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPurchaseReturns.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-rose-400">{pr.return_number}</td>
                      <td className="p-3 font-mono text-slate-300">
                        {pr.purchase_invoice_number || (pr.purchase_id !== 'manual' ? pr.purchase_id : 'Direct Return')}
                        {pr.supplier_invoice_no && <div className="text-[10px] text-slate-400">Bill: {pr.supplier_invoice_no}</div>}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{pr.company_name || pr.supplier_name}</div>
                        {pr.supplier_gstin && <div className="text-[10px] text-slate-400 font-mono">GSTIN: {pr.supplier_gstin}</div>}
                      </td>
                      <td className="p-3 text-slate-300">{pr.return_date}</td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        ₹{(pr.taxable_value || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-400">
                        ₹{(pr.total_tax || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-400 text-sm">
                        ₹{(pr.grand_total || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center text-slate-300 text-[11px]">
                        {pr.reason || 'Damaged / Vendor Return'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {pr.status || 'Posted'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD MULTI-PRODUCT PURCHASE INVOICE */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-5xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <span>Stock Inward & Purchase Invoice Entry</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record inward shipment with HSN codes, multiple items, supplier trade discounts, cash discounts, and credit notes
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-5 text-xs">
              
              {/* SECTION 1: SUPPLIER & INVOICE DETAILS */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>1. Supplier & Invoice Header</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Select Supplier *</label>
                    <select
                      required
                      value={supplierId}
                      onChange={e => setSupplierId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.company_name} ({s.city || s.state || 'Karnataka'})
                        </option>
                      ))}
                    </select>
                    {selectedSupplier && (
                      <div className="text-[10px] text-slate-400 mt-1.5 space-y-0.5 bg-slate-950/60 p-2 rounded border border-slate-800">
                        <div className="flex justify-between">
                          <span>GSTIN: {selectedSupplier.gstin || 'Unregistered'}</span>
                          <span className="text-amber-400 font-semibold">
                            Due: ₹{(selectedSupplier.current_outstanding || 0).toFixed(2)}
                          </span>
                        </div>
                        {selectedSupplier.email && (
                          <div className="flex items-center space-x-1 text-cyan-400">
                            <Mail className="w-2.5 h-2.5" />
                            <span className="font-mono">{selectedSupplier.email}</span>
                          </div>
                        )}
                        {(selectedSupplier.address || selectedSupplier.city) && (
                          <div className="flex items-center space-x-1 text-slate-300">
                            <MapPin className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />
                            <span className="truncate">
                              {selectedSupplier.address ? `${selectedSupplier.address}, ` : ''}
                              {selectedSupplier.city || 'Hubballi'}, {selectedSupplier.state || 'Karnataka'} {selectedSupplier.pin ? `- ${selectedSupplier.pin}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Supplier Bill / Invoice No *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. INV-BAY-2026-981"
                      value={supplierInvNo}
                      onChange={e => setSupplierInvNo(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Invoice Date *</label>
                    <input
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: MULTIPLE PRODUCTS ITEM TABLE */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                    <span>2. Purchase Items & Pricing Setup ({items.length} product{items.length > 1 ? 's' : ''})</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Product</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const rowQty = Number(it.quantity) || 0;
                    const rowRate = Number(it.unit_price) || 0;
                    let rowDisc = Number(it.discount) || 0;
                    if (it.discount_pct > 0 && rowDisc === 0) {
                      rowDisc = (rowQty * rowRate * it.discount_pct) / 100;
                    }
                    const rowTaxable = Math.max(0, (rowQty * rowRate) - rowDisc);

                    return (
                      <div
                        key={idx}
                        className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-3 relative group hover:border-slate-700 transition"
                      >
                        {/* Row Header */}
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-200">
                              {it.product_name ? it.product_name : `Item #${idx + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="text-[11px] text-slate-400 font-mono">
                              Taxable: <strong className="text-emerald-400 font-bold">₹{rowTaxable.toFixed(2)}</strong>
                            </div>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductRow(idx)}
                                className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                                title="Remove this product row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Product Selection & HSN */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 mb-0.5">Select Product *</label>
                            <select
                              required
                              value={it.product_id}
                              onChange={e => handleProductSelect(idx, e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                            >
                              <option value="">-- Choose Product from Catalog --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.brand || 'General'}) - Pack: {p.pack_size || p.unit} [HSN: {p.hsn_code || '1209'}]
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">HSN Code *</label>
                            <div className="flex space-x-1">
                              <input
                                type="text"
                                required
                                value={it.hsn_code}
                                onChange={e => {
                                  const updated = [...items];
                                  updated[idx].hsn_code = e.target.value;
                                  setItems(updated);
                                }}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            {/* HSN quick presets */}
                            <div className="flex space-x-1 mt-1 text-[9px]">
                              <button type="button" onClick={() => applyHsnPreset(idx, '1209')} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400">1209 (Seed)</button>
                              <button type="button" onClick={() => applyHsnPreset(idx, '3105')} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400">3105 (Fert)</button>
                              <button type="button" onClick={() => applyHsnPreset(idx, '3808')} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400">3808 (Pest)</button>
                              <button type="button" onClick={() => applyHsnPreset(idx, '8424')} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400">8424 (Equip)</button>
                            </div>
                          </div>
                        </div>

                        {/* Batch & Dates */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Batch Number *</label>
                            <input
                              type="text"
                              required
                              value={it.batch_number}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].batch_number = e.target.value;
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Quantity *</label>
                            <div className="flex space-x-1">
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                value={it.quantity}
                                onChange={e => {
                                  const updated = [...items];
                                  updated[idx].quantity = Number(e.target.value);
                                  setItems(updated);
                                }}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                              />
                              <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-400 text-[10px] flex items-center">
                                {it.unit || 'Unit'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Mfg Date</label>
                            <input
                              type="date"
                              value={it.mfg_date}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].mfg_date = e.target.value;
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Expiry Date *</label>
                            <input
                              type="date"
                              required
                              value={it.expiry_date}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].expiry_date = e.target.value;
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Pricing: Unit Price, Selling Price (Price to be Sold), MRP, Supplier Discount */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                          <div>
                            <label className="block text-[10px] text-emerald-400 font-bold mb-0.5">
                              Unit Cost / Purchase Price (₹) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={it.unit_price}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].unit_price = Number(e.target.value);
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-emerald-500/40 rounded p-1.5 text-slate-100 font-bold font-mono focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[9px] text-slate-500 block mt-0.5">What you paid vendor</span>
                          </div>

                          <div>
                            <label className="block text-[10px] text-cyan-400 font-bold mb-0.5">
                              Price to be Sold (₹) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={it.selling_price}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].selling_price = Number(e.target.value);
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-cyan-500/40 rounded p-1.5 text-slate-100 font-bold font-mono focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-[9px] text-slate-500 block mt-0.5">Retail customer price</span>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-300 font-bold mb-0.5">
                              MRP on Pack (₹) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={it.mrp}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].mrp = Number(e.target.value);
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[9px] text-slate-500 block mt-0.5">Printed max retail price</span>
                          </div>

                          <div>
                            <label className="block text-[10px] text-amber-400 font-bold mb-0.5">
                              Supplier Line Discount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="₹ discount"
                              value={it.discount || ''}
                              onChange={e => {
                                const updated = [...items];
                                updated[idx].discount = Number(e.target.value);
                                setItems(updated);
                              }}
                              className="w-full bg-slate-800 border border-amber-500/40 rounded p-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[9px] text-slate-500 block mt-0.5">Vendor trade discount</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: SUPPLIER CASH DISCOUNT, CREDIT NOTE & REFERENCE NOTES */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>3. Supplier Cash Discount, Credit Note Arrangement & Reference Notes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Column: Cash Discount & Credit Note Mode */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">
                        Instant Cash Discount on Bill (₹)
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="e.g. 1500"
                          value={cashDiscount || ''}
                          onChange={e => setCashDiscount(Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Direct upfront cash discount given by supplier on invoice total
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">
                        Supplier Credit Note Status
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCreditNoteMode('none')}
                          className={`p-2 rounded-lg border text-center transition ${
                            creditNoteMode === 'none'
                              ? 'bg-slate-800 border-slate-600 text-slate-100 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px]">No Credit Note</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCreditNoteMode('received')}
                          className={`p-2 rounded-lg border text-center transition ${
                            creditNoteMode === 'received'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px] text-emerald-400">Available Now</div>
                          <div className="text-[9px] text-emerald-300/80">CN Received</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCreditNoteMode('promised')}
                          className={`p-2 rounded-lg border text-center transition ${
                            creditNoteMode === 'promised'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px] text-amber-400">Promised Later</div>
                          <div className="text-[9px] text-amber-300/80">Pending Follow-up</div>
                        </button>
                      </div>
                    </div>

                    {/* If Credit Note is available now or promised */}
                    {creditNoteMode !== 'none' && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold text-slate-200 flex items-center justify-between">
                          <span>{creditNoteMode === 'received' ? 'Received Credit Note Details' : 'Promised Credit Note Target'}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            creditNoteMode === 'received' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {creditNoteMode === 'received' ? 'Deducted From Balance' : 'Tracked in Ledger Notes'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Credit Note #</label>
                            <input
                              type="text"
                              placeholder="e.g. CN-BAY-441"
                              value={creditNoteNo}
                              onChange={e => setCreditNoteNo(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Credit Note Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="e.g. 2500"
                              value={creditNoteAmount || ''}
                              onChange={e => setCreditNoteAmount(Number(e.target.value))}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Reference & Follow-up Notes */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Internal Invoice Reference & Supplier Follow-up Notes
                    </label>
                    <textarea
                      rows={5}
                      placeholder="e.g. Supplier Mr. Patil agreed for 4% special cash discount credit note of ₹3,200 next month once payment is cleared within 15 days..."
                      value={supplierNotes}
                      onChange={e => setSupplierNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      💡 Notes are saved with this invoice for your future audit, payment settlement, and ledger review.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: INVOICE FINANCIAL SUMMARY & SUBMISSION */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Gross Goods Total:</span>
                    <strong className="text-slate-200 font-mono">₹{formCalculations.grossTotal.toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Supplier Line Discounts:</span>
                    <strong className="text-amber-400 font-mono">₹{formCalculations.totalDiscount.toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Invoice Grand Total (Inc GST):</span>
                    <strong className="text-emerald-400 font-mono font-bold text-sm">
                      ₹{formCalculations.invoiceGrandTotal.toFixed(2)}
                    </strong>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Net Payable to Supplier:</span>
                    <strong className="text-cyan-400 font-mono font-bold text-sm">
                      ₹{formCalculations.netBalanceDue.toFixed(2)}
                    </strong>
                    {formCalculations.immediateDeduction > 0 && (
                      <span className="text-[9px] text-emerald-400 block mt-0.5">
                        (Less ₹{formCalculations.immediateDeduction.toFixed(2)} CN/Cash Disc)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-2 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Inward Stock ({items.length} Products)</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW PURCHASE INVOICE & MULTI-PRODUCT ITEMS DETAILS */}
      {/* ========================================================================= */}
      {viewInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>Purchase Invoice Details: {viewInvoiceModal.invoice_number}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supplier Bill #{viewInvoiceModal.supplier_invoice_no} • {viewInvoiceModal.invoice_date}
                </p>
              </div>
              <button
                onClick={() => setViewInvoiceModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Supplier & Header Info Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Supplier Company:</span>
                <strong className="text-slate-100">{viewInvoiceModal.company_name || viewInvoiceModal.supplier_name}</strong>
                {viewInvoiceModal.supplier_gstin && (
                  <div className="text-[10px] text-slate-400 font-mono">GSTIN: {viewInvoiceModal.supplier_gstin}</div>
                )}
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">Invoice Date & Status:</span>
                <strong className="text-slate-200 font-mono">{viewInvoiceModal.invoice_date}</strong>
                <div className="text-[10px] text-emerald-400 font-bold">{viewInvoiceModal.status || 'Posted'}</div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">Taxable & GST:</span>
                <strong className="text-slate-200 font-mono">₹{(viewInvoiceModal.taxable_value || 0).toFixed(2)}</strong>
                <div className="text-[10px] text-slate-400 font-mono">GST: ₹{(viewInvoiceModal.total_tax || 0).toFixed(2)}</div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">Grand Total:</span>
                <strong className="text-emerald-400 font-mono font-bold text-sm">
                  ₹{(viewInvoiceModal.grand_total || 0).toFixed(2)}
                </strong>
                {viewInvoiceModal.balance_due !== undefined && (
                  <div className="text-[10px] text-cyan-400 font-mono">
                    Balance Due: ₹{(viewInvoiceModal.balance_due || 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Supplier Credit Note & Notes Highlight */}
            {(viewInvoiceModal.supplier_credit_note_status !== 'none' || viewInvoiceModal.cash_discount > 0 || viewInvoiceModal.supplier_notes) && (
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-amber-400 flex items-center space-x-1">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Supplier Discount & Credit Note Arrangement</span>
                  </span>

                  <button
                    onClick={() => {
                      setViewInvoiceModal(null);
                      handleOpenCreditNoteModal(viewInvoiceModal);
                    }}
                    className="text-[11px] text-emerald-400 hover:underline font-bold"
                  >
                    Edit / Update Credit Note
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Credit Note Status:</span>
                    <strong className={viewInvoiceModal.supplier_credit_note_status === 'received' ? 'text-emerald-400' : 'text-amber-400'}>
                      {viewInvoiceModal.supplier_credit_note_status === 'received' ? 'Received & Adjusted' : 'Promised / Pending'}
                    </strong>
                    {viewInvoiceModal.supplier_credit_note_no && (
                      <div className="text-slate-300 font-mono text-[10px]">CN #{viewInvoiceModal.supplier_credit_note_no}</div>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block">Credit Note Amount:</span>
                    <strong className="text-amber-300 font-mono font-bold">
                      ₹{(viewInvoiceModal.supplier_credit_note_amount || 0).toFixed(2)}
                    </strong>
                    {viewInvoiceModal.cash_discount > 0 && (
                      <div className="text-cyan-400 text-[10px] font-mono">Cash Disc: ₹{viewInvoiceModal.cash_discount}</div>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block">Reference Notes:</span>
                    <span className="text-slate-200 italic">{viewInvoiceModal.supplier_notes || 'No special notes'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-200">Purchased Products Breakdown (with HSN & Selling Prices):</span>
              
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">HSN Code</th>
                      <th className="p-2.5">Batch # & Expiry</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Cost (₹)</th>
                      <th className="p-2.5 text-right">Price to be Sold (₹)</th>
                      <th className="p-2.5 text-right">MRP (₹)</th>
                      <th className="p-2.5 text-right">Supplier Disc</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingDetails ? (
                      <tr><td colSpan={9} className="p-4 text-center text-slate-500">Loading item breakdown...</td></tr>
                    ) : viewInvoiceItems.length === 0 ? (
                      <tr><td colSpan={9} className="p-4 text-center text-slate-500">No items found for this invoice.</td></tr>
                    ) : (
                      viewInvoiceItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-2.5 font-semibold text-slate-100">
                            {it.product_name || `Product #${it.product_id}`}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                              {it.hsn_code || '1209'}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            <div className="text-slate-200">{it.batch_number || 'N/A'}</div>
                            <div className="text-slate-400 text-[10px]">Exp: {it.expiry_date || 'N/A'}</div>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-200">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                            ₹{(it.purchase_rate || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-cyan-400">
                            ₹{(it.selling_price || it.mrp || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-400">
                            ₹{(it.mrp || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-400">
                            ₹{(it.discount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-100">
                            ₹{(it.total_amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewInvoiceModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded-lg text-xs font-semibold"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANAGE / UPDATE SUPPLIER CREDIT NOTE FOR EXISTING INVOICE */}
      {/* ========================================================================= */}
      {creditNoteModalInvoice && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>Update Supplier Credit Note & Notes</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  For Inv #{creditNoteModalInvoice.invoice_number} ({creditNoteModalInvoice.company_name})
                </p>
              </div>
              <button onClick={() => setCreditNoteModalInvoice(null)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleSaveCreditNoteUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Credit Note Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCnUpdateStatus('received')}
                    className={`p-2 rounded border text-center ${
                      cnUpdateStatus === 'received' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Received & Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setCnUpdateStatus('promised_pending')}
                    className={`p-2 rounded border text-center ${
                      cnUpdateStatus === 'promised_pending' ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Promised / Pending
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Credit Note Number</label>
                <input
                  type="text"
                  placeholder="e.g. CN-BAY-9021"
                  value={cnUpdateNumber}
                  onChange={e => setCnUpdateNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Credit Note Date</label>
                  <input
                    type="date"
                    value={cnUpdateDate}
                    onChange={e => setCnUpdateDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Credit Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={cnUpdateAmount || ''}
                    onChange={e => setCnUpdateAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Reference & Follow-up Notes</label>
                <textarea
                  rows={3}
                  placeholder="Note conversation, promises or conditions..."
                  value={cnUpdateNotes}
                  onChange={e => setCnUpdateNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreditNoteModalInvoice(null)}
                  className="bg-slate-800 px-3 py-1.5 rounded text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded font-bold"
                >
                  Update Credit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE PURCHASE ORDER */}
      {/* ========================================================================= */}
      <CreatePurchaseOrderModal
        isOpen={showAddPoModal}
        onClose={() => setShowAddPoModal(false)}
        onSuccess={() => {
          loadData();
        }}
        suppliers={suppliers}
        products={products}
      />

      {/* ========================================================================= */}
      {/* MODAL: VIEW PURCHASE ORDER */}
      {/* ========================================================================= */}
      <ViewPurchaseOrderModal
        po={viewPoModal}
        onClose={() => setViewPoModal(null)}
        onConvertToInvoice={(po, items) => {
          handleConvertPoToInvoice(po, items);
        }}
        onStatusUpdated={() => {
          loadData();
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: RECORD PURCHASE RETURN / DEBIT NOTE */}
      {/* ========================================================================= */}
      <CreatePurchaseReturnModal
        isOpen={showAddReturnModal}
        onClose={() => setShowAddReturnModal(false)}
        onSuccess={() => {
          loadData();
        }}
        suppliers={suppliers}
        products={products}
        purchases={purchases}
      />

    </div>
  );
};
