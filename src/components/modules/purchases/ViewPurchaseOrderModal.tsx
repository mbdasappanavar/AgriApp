import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../api/client';
import {
  FileText, X, Printer, ArrowRight, Building2, Calendar,
  CheckCircle2, Clock, AlertCircle, ShoppingBag, Mail, MapPin
} from 'lucide-react';

interface ViewPurchaseOrderModalProps {
  po: any | null;
  onClose: () => void;
  onConvertToInvoice: (po: any, items: any[]) => void;
  onStatusUpdated: () => void;
}

export const ViewPurchaseOrderModal: React.FC<ViewPurchaseOrderModalProps> = ({
  po,
  onClose,
  onConvertToInvoice,
  onStatusUpdated
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!po) return;
    setStatus(po.status || 'Ordered');
    setLoading(true);
    apiRequest(`/api/purchases/orders/${po.id}`)
      .then(res => {
        setItems(res.items || []);
      })
      .catch(err => {
        console.error(err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [po]);

  if (!po) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await apiRequest(`/api/purchases/orders/${po.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setStatus(newStatus);
      onStatusUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100 font-mono">
                Purchase Order: {po.po_number}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                status === 'Completed' || status === 'Received'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : status === 'Cancelled'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issued to {po.company_name || po.supplier_name} on {po.po_date}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Print Purchase Order"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PO</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vendor & Delivery Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Supplier Details:</span>
            <strong className="text-slate-100 block text-sm">{po.company_name || po.supplier_name}</strong>
            <div className="text-slate-400">GSTIN: <span className="text-slate-200 font-mono">{po.supplier_gstin || 'N/A'}</span></div>
            {po.supplier_mobile && <div className="text-slate-400">Mobile: <span className="text-slate-200 font-mono">{po.supplier_mobile}</span></div>}
            {po.supplier_email && (
              <div className="text-cyan-400 flex items-center space-x-1">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{po.supplier_email}</span>
              </div>
            )}
            {(po.supplier_address || po.supplier_city) && (
              <div className="text-slate-400 flex items-start space-x-1">
                <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="truncate text-[11px] leading-tight">
                  {po.supplier_address ? `${po.supplier_address}, ` : ''}
                  {po.supplier_city || 'Hubballi'}, {po.supplier_state || 'Karnataka'} {po.supplier_pin ? `- ${po.supplier_pin}` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Schedule & Payment:</span>
            <div className="text-slate-400">PO Date: <strong className="text-slate-200">{po.po_date}</strong></div>
            <div className="text-slate-400">Expected Delivery: <strong className="text-emerald-400">{po.expected_delivery || 'Not specified'}</strong></div>
            <div className="text-slate-400">Payment Terms: <span className="text-cyan-400 font-medium">{po.payment_terms || 'Net 30'}</span></div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">PO Valuation:</span>
            <div className="text-slate-400">Subtotal: <strong className="text-slate-200 font-mono">₹{(po.subtotal || 0).toFixed(2)}</strong></div>
            <div className="text-slate-400">Estimated GST: <strong className="text-cyan-400 font-mono">₹{(po.tax_amount || 0).toFixed(2)}</strong></div>
            <div className="text-slate-400">Grand Total: <strong className="text-emerald-400 font-mono text-sm">₹{(po.total_amount || 0).toFixed(2)}</strong></div>
          </div>
        </div>

        {/* Delivery & Vendor Notes */}
        {po.notes && (
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[10px] block font-bold uppercase">Delivery & Terms Notes:</span>
            <p className="text-slate-200 mt-0.5 italic">{po.notes}</p>
          </div>
        )}

        {/* Ordered Products Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-200">Products Ordered ({items.length} lines):</span>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5">HSN Code</th>
                  <th className="p-2.5 text-right">Order Qty</th>
                  <th className="p-2.5 text-right">Target Rate (₹)</th>
                  <th className="p-2.5 text-right">Discount</th>
                  <th className="p-2.5 text-right">GST Rate</th>
                  <th className="p-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-500">Loading order items...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-500">No items found for this order.</td></tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-2.5 text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-slate-100">
                        {it.product_name || `Product #${it.product_id}`}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                          {it.hsn_code || '1209'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-100">
                        {it.quantity} {it.unit || 'Kg'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-200">
                        ₹{(it.rate || 0).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-400">
                        ₹{(it.discount || 0).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-cyan-400">
                        {it.tax_rate || 18}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                        ₹{(it.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions: Status Transition & Convert to Invoice */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-semibold">Change Status:</span>
            <select
              value={status}
              onChange={e => handleUpdateStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="Draft">Draft</option>
              <option value="Ordered">Ordered / Dispatched</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Completed">Completed / Inwarded</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold"
            >
              Close
            </button>

            <button
              onClick={() => {
                onClose();
                onConvertToInvoice(po, items);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-1.5 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Inward Stock / Convert to Purchase Invoice</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
