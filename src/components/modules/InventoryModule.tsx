import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import {
  Package, AlertTriangle, ArrowRightLeft, Sliders, Search, Filter, RefreshCw,
  TrendingDown, TrendingUp, ShieldAlert, History, Store, CheckCircle2, FileText
} from 'lucide-react';

interface InventoryModuleProps {
  activeSubTab?: string;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'levels' | 'expiry' | 'adjust' | 'transfer' | 'movements' => {
    if (subTab === 'batch_expiry') return 'expiry';
    if (subTab === 'stock_adjustments') return 'adjust';
    if (subTab === 'stock_transfers') return 'transfer';
    if (subTab === 'stock_movements') return 'movements';
    return 'levels';
  };

  const [tab, setTab] = useState<'levels' | 'expiry' | 'adjust' | 'transfer' | 'movements'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  // Data States
  const [batches, setBatches] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Thresholds
  const [searchQuery, setSearchQuery] = useState('');
  const [expiryDays, setExpiryDays] = useState(90);
  const [movementFilter, setMovementFilter] = useState('');

  // Adjustment form
  const [adjForm, setAdjForm] = useState({ product_id: '', batch_id: '', physical_qty: 0, reason: 'Damage', remarks: '' });
  const [selectedBatchSystemQty, setSelectedBatchSystemQty] = useState<number | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    from_store_id: 'store-main',
    to_store_id: '',
    product_id: '',
    batch_id: '',
    quantity: 1,
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);

      const [bRes, pRes, aRes, tRes, mRes, sRes] = await Promise.all([
        apiRequest(`/api/inventory/batches?days=${expiryDays}`),
        apiRequest('/api/products'),
        apiRequest('/api/inventory/adjustments'),
        apiRequest('/api/inventory/transfers'),
        apiRequest('/api/inventory/movements'),
        apiRequest('/api/stores')
      ]);

      setBatches(bRes.allBatches || []);
      setExpiring(bRes.expiringSoon || []);
      setProducts(pRes.products || []);
      setAdjustments(aRes.adjustments || []);
      setTransfers(tRes.transfers || []);
      setMovements(mRes.movements || []);
      setStores(sRes.stores || []);

      if (sRes.stores && sRes.stores.length > 1 && !transferForm.to_store_id) {
        setTransferForm(prev => ({
          ...prev,
          from_store_id: sRes.stores[0].id,
          to_store_id: sRes.stores[1]?.id || sRes.stores[0].id
        }));
      }
    } catch (e) {
      console.error('Failed loading inventory data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [expiryDays]);

  // Submit Stock Adjustment
  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.product_id || !adjForm.batch_id) return alert('Product and batch selection are required');
    try {
      await apiRequest('/api/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify(adjForm)
      });
      alert('Stock adjustment submitted successfully!');
      setAdjForm({ product_id: '', batch_id: '', physical_qty: 0, reason: 'Damage', remarks: '' });
      setSelectedBatchSystemQty(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit adjustment.');
    }
  };

  // Submit Inter-Store Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_store_id || !transferForm.to_store_id || transferForm.from_store_id === transferForm.to_store_id) {
      return alert('Select different source and destination store branches.');
    }
    if (!transferForm.product_id || !transferForm.batch_id || transferForm.quantity <= 0) {
      return alert('Valid product, batch, and transfer quantity are required.');
    }

    try {
      await apiRequest('/api/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          from_store_id: transferForm.from_store_id,
          to_store_id: transferForm.to_store_id,
          notes: transferForm.notes,
          items: [{
            product_id: transferForm.product_id,
            batch_id: transferForm.batch_id,
            quantity: Number(transferForm.quantity)
          }]
        })
      });
      alert('Stock transfer dispatched successfully!');
      setTransferForm(prev => ({ ...prev, product_id: '', batch_id: '', quantity: 1, notes: '' }));
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch transfer.');
    }
  };

  // Filtered Batches
  const filteredBatches = batches.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.product_name && b.product_name.toLowerCase().includes(q)) ||
      (b.product_code && b.product_code.toLowerCase().includes(q)) ||
      (b.hsn_code && b.hsn_code.toLowerCase().includes(q)) ||
      (b.batch_number && b.batch_number.toLowerCase().includes(q))
    );
  });

  // Filtered Movements
  const filteredMovements = movements.filter(m => {
    const matchesSearch = !searchQuery.trim() || (
      (m.product_name && m.product_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.product_code && m.product_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.hsn_code && m.hsn_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.batch_number && m.batch_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.movement_type && m.movement_type.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const matchesFilter = !movementFilter || m.movement_type === movementFilter;
    return matchesSearch && matchesFilter;
  });

  // Calculate summary stats
  const totalStockItems = batches.reduce((acc, b) => acc + (b.current_qty || 0), 0);
  const totalStockValuation = batches.reduce((acc, b) => acc + ((b.current_qty || 0) * (b.purchase_price || 0)), 0);
  const totalExpiredValuation = expiring.reduce((acc, b) => acc + ((b.current_qty || 0) * (b.purchase_price || 0)), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>Inventory & Stock Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            FEFO batch tracking, expiry watch, inter-store transfers, stock audit adjustments, & inventory movement log
          </p>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('levels')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'levels' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Current Stock Levels</span>
          </button>

          <button
            onClick={() => setTab('expiry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'expiry' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Batch Expiry Watch ({expiring.length})</span>
          </button>

          <button
            onClick={() => setTab('adjust')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'adjust' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Stock Adjustments</span>
          </button>

          <button
            onClick={() => setTab('movements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'movements' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Movement Ledger</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CURRENT STOCK LEVELS */}
      {tab === 'levels' && (
        <div className="space-y-4">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">Active Batches</div>
              <div className="text-xl font-bold text-slate-100 mt-0.5">{batches.length} Batches</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">Total Physical Quantity</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{totalStockItems.toLocaleString()} Units</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">Total Inventory Valuation</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">₹{totalStockValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">Near Expiry (&lt; {expiryDays} Days)</div>
              <div className="text-xl font-bold text-amber-400 mt-0.5">{expiring.length} Batches</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search product name, code, or batch..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Stock Data</span>
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Product Name & Code</th>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Mfg Date</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3 text-right">MRP (₹)</th>
                  <th className="p-3 text-right">Purchase Price (₹)</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3 text-right">Batch Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500 text-xs">
                      No stock batches found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(b => {
                    const batchVal = (b.current_qty || 0) * (b.purchase_price || 0);
                    return (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-100">{b.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{b.product_code || ''}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                            {b.hsn_code || '1209'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">{b.batch_number}</td>
                        <td className="p-3 text-slate-400">{b.mfg_date || 'N/A'}</td>
                        <td className="p-3">
                          <span className="font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
                            {b.expiry_date}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">₹{b.mrp}</td>
                        <td className="p-3 text-right text-slate-400">₹{b.purchase_price}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          {b.current_qty} {b.unit || 'Units'}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-200">
                          ₹{batchVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BATCH EXPIRY WATCH */}
      {tab === 'expiry' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-semibold">Expiry Watch Horizon:</span>
              {[30, 60, 90, 180].map(days => (
                <button
                  key={days}
                  onClick={() => setExpiryDays(days)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    expiryDays === days
                      ? 'bg-amber-600 border-amber-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Within {days} Days
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-amber-400">
              Total Valuation at Risk: <span className="font-bold text-white">₹{totalExpiredValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Expiring Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Supplier Source</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3 text-right">Purchase Price (₹)</th>
                  <th className="p-3 text-right">Value at Risk (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {expiring.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      Great news! No batches are expiring within {expiryDays} days.
                    </td>
                  </tr>
                ) : (
                  expiring.map(b => {
                    const val = (b.current_qty || 0) * (b.purchase_price || 0);
                    return (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-slate-100">{b.product_name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                            {b.hsn_code || '1209'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-amber-400 font-semibold">{b.batch_number}</td>
                        <td className="p-3">
                          <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 text-[10px]">
                            {b.expiry_date}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{b.supplier_name || 'Direct Procurement'}</td>
                        <td className="p-3 text-right font-bold text-amber-300">{b.current_qty} {b.unit || 'Units'}</td>
                        <td className="p-3 text-right text-slate-400">₹{b.purchase_price}</td>
                        <td className="p-3 text-right font-bold text-rose-300">
                          ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setTab('adjust');
                              setAdjForm({
                                product_id: b.product_id,
                                batch_id: b.id,
                                physical_qty: 0,
                                reason: 'Expiry',
                                remarks: `Batch ${b.batch_number} expired on ${b.expiry_date}`
                              });
                            }}
                            className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded text-[10px] font-semibold border border-rose-500/30"
                          >
                            Adjust / Liquidate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK ADJUSTMENTS */}
      {tab === 'adjust' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Adjustment Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-md h-fit">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Record Stock Adjustment</span>
            </h3>

            <form onSubmit={handleAdjust} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select Product *</label>
                <select
                  required
                  value={adjForm.product_id}
                  onChange={e => {
                    const pid = e.target.value;
                    const firstBatch = batches.find(b => b.product_id === pid);
                    setAdjForm({ ...adjForm, product_id: pid, batch_id: firstBatch?.id || '' });
                    setSelectedBatchSystemQty(firstBatch ? firstBatch.current_qty : null);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code}) [HSN: {p.hsn_code || '1209'}]</option>)}
                </select>
              </div>

              {adjForm.product_id && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Select Batch *</label>
                  <select
                    required
                    value={adjForm.batch_id}
                    onChange={e => {
                      const bid = e.target.value;
                      const b = batches.find(x => x.id === bid);
                      setAdjForm({ ...adjForm, batch_id: bid });
                      setSelectedBatchSystemQty(b ? b.current_qty : null);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.filter(b => b.product_id === adjForm.product_id).map(b => (
                      <option key={b.id} value={b.id}>{b.batch_number} (System Qty: {b.current_qty})</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBatchSystemQty !== null && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] flex justify-between">
                  <span className="text-slate-400">Recorded System Quantity:</span>
                  <span className="font-bold text-emerald-400 font-mono">{selectedBatchSystemQty} Units</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Physical Count On Hand *</label>
                <input
                  type="number"
                  required
                  value={adjForm.physical_qty}
                  onChange={e => setAdjForm({ ...adjForm, physical_qty: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {selectedBatchSystemQty !== null && (
                <div className="text-[11px] flex justify-between px-1">
                  <span className="text-slate-400">Quantity Difference:</span>
                  <span className={`font-bold font-mono ${adjForm.physical_qty - selectedBatchSystemQty < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {adjForm.physical_qty - selectedBatchSystemQty > 0 ? '+' : ''}{adjForm.physical_qty - selectedBatchSystemQty} Units
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Adjustment Reason *</label>
                <select
                  value={adjForm.reason}
                  onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Damage">Damage / Spillage</option>
                  <option value="Expiry">Product Expiry</option>
                  <option value="Loss">Loss / Theft</option>
                  <option value="Found">Audit Correction (Found Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Remarks / Audit Note</label>
                <textarea
                  rows={2}
                  placeholder="Details of physical count mismatch..."
                  value={adjForm.remarks}
                  onChange={e => setAdjForm({ ...adjForm, remarks: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-all shadow"
              >
                Save Adjustment & Update Batch
              </button>
            </form>
          </div>

          {/* Adjustments History Table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Adjustment Audit History ({adjustments.length})</span>
              </span>
              <button onClick={loadData} className="text-slate-400 hover:text-white text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-3">Adj Number & Date</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">HSN Code</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3 text-right">Sys Qty vs Phys</th>
                    <th className="p-3 text-right">Diff</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                        No stock adjustments logged yet.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono">
                          <div className="text-emerald-400 font-bold">{a.adjustment_number}</div>
                          <div className="text-[10px] text-slate-500">{new Date(a.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-100">{a.product_name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                            {a.hsn_code || '1209'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-300">{a.batch_number || '-'}</td>
                        <td className="p-3 text-right font-mono">
                          <span className="text-slate-400">{a.system_qty}</span> → <strong className="text-slate-100">{a.physical_qty}</strong>
                        </td>
                        <td className="p-3 text-right font-bold font-mono">
                          <span className={a.difference < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {a.difference > 0 ? '+' : ''}{a.difference}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
                            {a.reason}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">@{a.approved_by || a.created_by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTER-STORE TRANSFERS */}
      {tab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Transfer Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-md h-fit">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>Dispatch Inter-Store Transfer</span>
            </h3>

            <form onSubmit={handleTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Source Store Branch *</label>
                <select
                  required
                  value={transferForm.from_store_id}
                  onChange={e => setTransferForm({ ...transferForm, from_store_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Destination Store Branch *</label>
                <select
                  required
                  value={transferForm.to_store_id}
                  onChange={e => setTransferForm({ ...transferForm, to_store_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Destination Branch --</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select Product *</label>
                <select
                  required
                  value={transferForm.product_id}
                  onChange={e => {
                    const pid = e.target.value;
                    const firstBatch = batches.find(b => b.product_id === pid);
                    setTransferForm({ ...transferForm, product_id: pid, batch_id: firstBatch?.id || '' });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code || ''}) [HSN: {p.hsn_code || '1209'}]</option>)}
                </select>
              </div>

              {transferForm.product_id && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Select Batch *</label>
                  <select
                    required
                    value={transferForm.batch_id}
                    onChange={e => setTransferForm({ ...transferForm, batch_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.filter(b => b.product_id === transferForm.product_id).map(b => (
                      <option key={b.id} value={b.id}>{b.batch_number} (Avail: {b.current_qty})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Transfer Quantity *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={transferForm.quantity}
                  onChange={e => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Transfer Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent stock rebalancing for Hubballi branch"
                  value={transferForm.notes}
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-all shadow"
              >
                Dispatch Stock Transfer
              </button>
            </form>
          </div>

          {/* Transfers History Table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>Inter-Store Transfers History ({transfers.length})</span>
              </span>
              <button onClick={loadData} className="text-slate-400 hover:text-white text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-3">Transfer # & Date</th>
                    <th className="p-3">From Branch</th>
                    <th className="p-3">To Branch</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dispatched By</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 text-xs">
                        No inter-store transfers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transfers.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono">
                          <div className="text-emerald-400 font-bold">{t.transfer_number}</div>
                          <div className="text-[10px] text-slate-500">{new Date(t.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">{t.from_store_name}</td>
                        <td className="p-3 font-semibold text-emerald-300">{t.to_store_name}</td>
                        <td className="p-3">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-bold">
                            {t.status || 'Dispatched'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">@{t.created_by}</td>
                        <td className="p-3 text-slate-400">{t.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: INVENTORY MOVEMENT LEDGER */}
      {tab === 'movements' && (
        <div className="space-y-4">
          
          {/* Movement Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter product or batch..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={movementFilter}
                onChange={e => setMovementFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Movement Types</option>
                <option value="Purchase">Purchase (Stock In)</option>
                <option value="Sale">POS Sale (Stock Out)</option>
                <option value="Adjustment">Stock Adjustment</option>
                <option value="TransferOut">Transfer Out</option>
                <option value="TransferIn">Transfer In</option>
                <option value="Expiry">Expiry Write-off</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Showing <strong className="text-emerald-400">{filteredMovements.length}</strong> movements
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Product Name & Code</th>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Qty Change</th>
                  <th className="p-3 text-right">Stock (Prev → New)</th>
                  <th className="p-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                      No inventory movements recorded matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(m => {
                    const isPositive = ['Purchase', 'TransferIn', 'Found', 'Adjustment'].includes(m.movement_type);
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-100">{m.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{m.product_code || ''}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold text-[10px]">
                            {m.hsn_code || '1209'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">{m.batch_number || '-'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              m.movement_type === 'Purchase'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : m.movement_type === 'Sale'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : m.movement_type === 'Expiry' || m.movement_type === 'Damage'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : '-'}{m.quantity} {m.unit || 'Units'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-300">
                          {m.previous_qty !== undefined ? `${m.previous_qty} → ${m.new_qty}` : '-'}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] max-w-xs truncate">
                          {m.notes || m.reference_type || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
