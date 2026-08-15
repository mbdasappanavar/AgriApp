import React, { useState, useMemo } from 'react';
import { apiRequest } from '../../../api/client';
import {
  RotateCcw, Plus, Trash2, X, CheckCircle2, Building2,
  Calendar, FileText, ClipboardList, Mail, MapPin
} from 'lucide-react';

interface CreatePurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: any[];
  products: any[];
  purchases: any[];
}

interface ReturnItemRow {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit: string;
  rate: number;
}

export const CreatePurchaseReturnModal: React.FC<CreatePurchaseReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  products,
  purchases
}) => {
  const [supplierId, setSupplierId] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Damaged / Broken Seal');
  const [submitting, setSubmitting] = useState(false);

  const defaultItem: ReturnItemRow = {
    product_id: '',
    quantity: 1,
    unit: 'Kg',
    rate: 100
  };

  const [items, setItems] = useState<ReturnItemRow[]>([defaultItem]);

  const supplierInvoices = useMemo(() => {
    if (!supplierId) return [];
    return purchases.filter(p => p.supplier_id === supplierId);
  }, [purchases, supplierId]);

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
        unit: prod.unit || 'Kg',
        rate: prod.purchase_price || 100
      };
    } else {
      updated[index].product_id = '';
    }
    setItems(updated);
  };

  const calculations = useMemo(() => {
    let taxable = 0;
    items.forEach(it => {
      taxable += (Number(it.quantity) || 0) * (Number(it.rate) || 0);
    });
    const tax = taxable * 0.18;
    const grandTotal = taxable + tax;
    return { taxable, tax, grandTotal };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert('Please select a supplier.');
    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) return alert(`Please select a product for item #${i + 1}`);
      if (!items[i].quantity || items[i].quantity <= 0) return alert(`Please enter valid quantity for item #${i + 1}`);
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        purchase_id: purchaseId || 'manual',
        return_date: returnDate,
        reason,
        items: items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit: it.unit || 'Kg',
          rate: Number(it.rate)
        }))
      };

      const res = await apiRequest('/api/purchases/returns', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(`✅ Purchase Return / Debit Note ${res.returnNumber || ''} created successfully! Total debited: ₹${(res.grandTotal || calculations.grandTotal).toFixed(2)}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase return');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              <span>Record Purchase Return & Issue Debit Note</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Return damaged or excess goods back to the supplier and debit your payable ledger account
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Supplier & Ref */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Select Supplier *</label>
                <select
                  required
                  value={supplierId}
                  onChange={e => {
                    setSupplierId(e.target.value);
                    setPurchaseId('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
                {selectedSupplier && (
                  <div className="text-[10px] text-slate-400 mt-1.5 space-y-0.5 bg-slate-950/60 p-2 rounded border border-slate-800">
                    <div className="flex justify-between">
                      <span>GSTIN: {selectedSupplier.gstin || 'Unregistered'}</span>
                      <span className="text-amber-400 font-semibold">
                        Payable: ₹{(selectedSupplier.current_outstanding || 0).toFixed(2)}
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
                <label className="block text-slate-400 mb-1">Original Purchase Invoice (Optional)</label>
                <select
                  value={purchaseId}
                  onChange={e => setPurchaseId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Not Linked / Direct Return --</option>
                  {supplierInvoices.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.invoice_number} (Bill: {p.supplier_invoice_no}) - {p.invoice_date}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Return Date *</label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Return Reason *</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="Damaged / Broken Seal">Damaged / Broken Seal</option>
                  <option value="Near Expiry / Expired Goods">Near Expiry / Expired Goods</option>
                  <option value="Quality Substandard / Low Germination">Quality Substandard / Low Germination</option>
                  <option value="Excess Quantity Supplied">Excess Quantity Supplied</option>
                  <option value="Wrong Item Dispatched by Vendor">Wrong Item Dispatched by Vendor</option>
                  <option value="Seasonal Price Adjustment">Seasonal Price Adjustment</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-200">Return Items</span>
              <button
                type="button"
                onClick={() => setItems([...items, { ...defaultItem }])}
                className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded text-xs font-bold"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 items-center">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Product</label>
                    <select
                      required
                      value={it.product_id}
                      onChange={e => handleProductSelect(idx, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.brand || 'General'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Return Qty</label>
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
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-bold"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 mb-0.5">Unit Rate (₹)</label>
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
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 font-mono"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300 pt-3"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 flex justify-between items-center">
            <div className="text-xs">
              <span className="text-slate-400 block">Total Debit Note Amount (Inc GST):</span>
              <strong className="text-rose-400 text-base font-mono">₹{calculations.grandTotal.toFixed(2)}</strong>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 px-4 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-lg font-bold"
              >
                {submitting ? 'Posting...' : 'Issue Debit Note & Return Goods'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
