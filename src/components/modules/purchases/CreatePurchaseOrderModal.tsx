import React, { useState, useMemo, useEffect } from 'react';
import { apiRequest } from '../../../api/client';
import {
  FileText, Plus, Trash2, X, CheckCircle2, Building2,
  Calendar, IndianRupee, Tag, ClipboardList, ShieldAlert,
  Mail, MapPin
} from 'lucide-react';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: any[];
  products: any[];
  initialSupplierId?: string;
  initialItems?: Array<{
    product_id: string;
    product_name?: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    rate?: number;
    discount?: number;
    tax_rate?: number;
  }>;
}

interface PoItemRow {
  product_id: string;
  product_name?: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  tax_rate: number;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  products,
  initialSupplierId,
  initialItems
}) => {
  const [supplierId, setSupplierId] = useState(initialSupplierId || '');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDelivery, setExpectedDelivery] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [status, setStatus] = useState<'Ordered' | 'Draft'>('Ordered');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const defaultItem: PoItemRow = {
    product_id: '',
    hsn_code: '1209',
    quantity: 10,
    unit: 'Kg',
    rate: 100,
    discount: 0,
    tax_rate: 18
  };

  const [items, setItems] = useState<PoItemRow[]>([defaultItem]);

  // Sync initial props when opening
  useEffect(() => {
    if (isOpen) {
      if (initialSupplierId) {
        setSupplierId(initialSupplierId);
      }
      if (initialItems && initialItems.length > 0) {
        setItems(initialItems.map(it => ({
          product_id: it.product_id || '',
          product_name: it.product_name || '',
          hsn_code: it.hsn_code || '1209',
          quantity: it.quantity || 10,
          unit: it.unit || 'Kg',
          rate: it.rate || 100,
          discount: it.discount || 0,
          tax_rate: it.tax_rate !== undefined ? it.tax_rate : 18
        })));
      } else if (!initialSupplierId) {
        setSupplierId('');
        setItems([{ ...defaultItem }]);
      }
    }
  }, [isOpen, initialSupplierId, initialItems]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === supplierId);
  }, [suppliers, supplierId]);

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
        rate: prod.purchase_price || 100,
        tax_rate: prod.gst_rate !== undefined ? prod.gst_rate : 18
      };
    } else {
      updated[index].product_id = '';
    }
    setItems(updated);
  };

  const handleAddItemRow = () => {
    setItems([...items, { ...defaultItem }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) {
      alert('At least one item is required in the Purchase Order.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalQty = 0;

    items.forEach(it => {
      const q = Number(it.quantity) || 0;
      const r = Number(it.rate) || 0;
      const d = Number(it.discount) || 0;
      const lineTaxable = Math.max(0, (q * r) - d);
      const taxRate = Number(it.tax_rate ?? 18);
      const taxAmt = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + taxAmt;

      subtotal += q * r;
      totalDiscount += d;
      totalTax += taxAmt;
      grandTotal += lineTotal;
      totalQty += q;
    });

    return {
      subtotal,
      totalDiscount,
      taxableAmount: subtotal - totalDiscount,
      totalTax,
      grandTotal,
      totalQty
    };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert('Please select a supplier.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) {
        alert(`Please select a product for line #${i + 1}`);
        return;
      }
      if (!items[i].quantity || items[i].quantity <= 0) {
        alert(`Please enter a valid quantity for line #${i + 1}`);
        return;
      }
      if (items[i].rate < 0) {
        alert(`Please enter a valid rate for line #${i + 1}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        po_date: poDate,
        expected_delivery: expectedDelivery,
        payment_terms: paymentTerms,
        status,
        notes: notes.trim() || null,
        items: items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit: it.unit || 'Kg',
          rate: Number(it.rate),
          discount: Number(it.discount) || 0,
          tax_rate: Number(it.tax_rate) || 18,
          hsn_code: it.hsn_code.trim() || '1209'
        }))
      };

      const res = await apiRequest('/api/purchases/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(`✅ Purchase Order ${res.poNumber || ''} created successfully! Total: ₹${(res.totalAmount || calculations.grandTotal).toFixed(2)}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create Purchase Order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-5xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>Create Purchase Order (PO)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Draft or dispatch formal purchase orders to suppliers with HSN codes, product rates, and delivery schedules
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* SECTION 1: SUPPLIER & PO HEADER */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>1. Supplier & Order Schedule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Select Supplier *</label>
                <select
                  required
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Supplier --</option>
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
                        Balance: ₹{(selectedSupplier.current_outstanding || 0).toFixed(2)}
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
                <label className="block text-slate-400 mb-1">PO Date *</label>
                <input
                  type="date"
                  required
                  value={poDate}
                  onChange={e => setPoDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={e => setExpectedDelivery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">Payment / Credit Terms</label>
                <select
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Net 30">Net 30 Days (Standard)</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="COD / On Delivery">Cash on Delivery (COD)</option>
                  <option value="Advance / Immediate">100% Advance Payment</option>
                  <option value="Season Settlement">Seasonal Harvest Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Initial Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('Ordered')}
                    className={`py-2 px-3 rounded-lg border text-center font-semibold transition ${
                      status === 'Ordered'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    🚀 Ordered / Dispatched
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('Draft')}
                    className={`py-2 px-3 rounded-lg border text-center font-semibold transition ${
                      status === 'Draft'
                        ? 'bg-slate-700 border-slate-500 text-slate-100'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    📝 Save as Draft
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ITEMS TABLE */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                <span>2. Products to Order ({items.length} item{items.length > 1 ? 's' : ''})</span>
              </div>

              <button
                type="button"
                onClick={handleAddItemRow}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Product</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => {
                const rowQty = Number(it.quantity) || 0;
                const rowRate = Number(it.rate) || 0;
                const rowDisc = Number(it.discount) || 0;
                const rowTaxable = Math.max(0, (rowQty * rowRate) - rowDisc);
                const rowTax = (rowTaxable * (Number(it.tax_rate) || 18)) / 100;
                const rowTotal = rowTaxable + rowTax;

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
                          {it.product_name ? it.product_name : `Product Line #${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-[11px] text-slate-400 font-mono">
                          Est. Total: <strong className="text-emerald-400 font-bold">₹{rowTotal.toFixed(2)}</strong> (Inc GST)
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                            title="Remove this line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Product & HSN */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-3">
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
                    </div>

                    {/* Quantity, Rate, Discount, Tax */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Order Quantity *</label>
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
                            {it.unit || 'Kg'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-emerald-400 font-bold mb-0.5">
                          Target Rate / Price (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={it.rate}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].rate = Number(e.target.value);
                            setItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-emerald-500/40 rounded p-1.5 text-slate-100 font-bold font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-amber-400 font-bold mb-0.5">
                          Agreed Discount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.discount || ''}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].discount = Number(e.target.value);
                            setItems(updated);
                          }}
                          placeholder="₹ discount"
                          className="w-full bg-slate-800 border border-amber-500/40 rounded p-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-cyan-400 font-bold mb-0.5">
                          GST Tax Rate (%)
                        </label>
                        <select
                          value={it.tax_rate}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].tax_rate = Number(e.target.value);
                            setItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-cyan-500/40 rounded p-1.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
                        >
                          <option value="0">0% (Nil / Exempt)</option>
                          <option value="5">5% GST</option>
                          <option value="12">12% GST</option>
                          <option value="18">18% GST (Standard)</option>
                          <option value="28">28% GST</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: INSTRUCTIONS & NOTES */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-slate-300 font-semibold">
              Delivery Instructions, Special Batch Requests & Vendor Terms
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Please supply fresh 2026 mfg batches with minimum 2 years expiry. Delivery at main warehouse gate..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* SECTION 4: FINANCIAL SUMMARY & ACTIONS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Order Subtotal:</span>
                <strong className="text-slate-200 font-mono">₹{calculations.subtotal.toFixed(2)}</strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Agreed Trade Discount:</span>
                <strong className="text-amber-400 font-mono">₹{calculations.totalDiscount.toFixed(2)}</strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Estimated GST:</span>
                <strong className="text-cyan-400 font-mono">₹{calculations.totalTax.toFixed(2)}</strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Grand PO Value:</span>
                <strong className="text-emerald-400 font-mono font-bold text-sm">
                  ₹{calculations.grandTotal.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-2 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Creating PO...' : `Generate Purchase Order (${items.length} Items)`}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
