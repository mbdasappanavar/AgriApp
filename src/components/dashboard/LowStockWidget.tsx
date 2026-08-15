import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../api/client';
import {
  AlertTriangle, Package, ShoppingCart, RefreshCw, Search,
  Filter, CheckCircle2, ChevronRight, Phone, Mail, Building2,
  TrendingDown, Plus, Minus, ArrowUpRight, IndianRupee, ShieldAlert,
  Tag, Layers, Sparkles
} from 'lucide-react';
import { CreatePurchaseOrderModal } from '../modules/purchases/CreatePurchaseOrderModal';

interface LowStockItem {
  id: string;
  code: string;
  sku: string;
  name: string;
  pack_size: string;
  unit: string;
  hsn_code: string;
  gst_rate: number;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  min_stock: number;
  reorder_level: number;
  reorder_qty: number;
  max_stock: number;
  product_type: string;
  crop?: string;
  category_id: string;
  category_name: string;
  brand_name: string;
  current_stock: number;
  supplier_id?: string;
  supplier_name?: string;
  supplier_mobile?: string;
  supplier_email?: string;
  supplier_address?: string;
  supplier_city?: string;
  shortage_qty: number;
  suggested_reorder_qty: number;
  est_reorder_cost: number;
  urgency: 'OUT_OF_STOCK' | 'BELOW_MINIMUM' | 'NEAR_REORDER' | 'NORMAL';
}

interface LowStockSummary {
  outOfStockCount: number;
  belowMinCount: number;
  nearReorderCount: number;
  totalLowStockCount: number;
  totalAlertsCount: number;
  totalEstReorderCost: number;
}

export const LowStockWidget: React.FC = () => {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [summary, setSummary] = useState<LowStockSummary>({
    outOfStockCount: 0,
    belowMinCount: 0,
    nearReorderCount: 0,
    totalLowStockCount: 0,
    totalAlertsCount: 0,
    totalEstReorderCost: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'below_min' | 'out_of_stock' | 'near_reorder'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

  // Custom reorder quantities state (editable per item)
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Multi-select for bulk PO
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Purchase Order Modal State
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poInitialSupplierId, setPoInitialSupplierId] = useState<string | undefined>(undefined);
  const [poInitialItems, setPoInitialItems] = useState<any[]>([]);

  // Master data for PO modal
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const fetchLowStockData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [res, supRes, prodRes] = await Promise.all([
        apiRequest('/api/inventory/low-stock'),
        apiRequest('/api/suppliers').catch(() => ({ suppliers: [] })),
        apiRequest('/api/products').catch(() => ({ products: [] }))
      ]);

      if (res && Array.isArray(res.items)) {
        setItems(res.items);
        if (res.summary) {
          setSummary(res.summary);
        }

        // Initialize custom reorder quantities
        const initialQtyMap: Record<string, number> = {};
        res.items.forEach((item: LowStockItem) => {
          initialQtyMap[item.id] = item.suggested_reorder_qty || Math.max(item.min_stock * 2 - item.current_stock, 10);
        });
        setCustomQuantities(initialQtyMap);
      }

      if (supRes && Array.isArray(supRes.suppliers)) {
        setSuppliers(supRes.suppliers);
      }
      if (prodRes && Array.isArray(prodRes.products)) {
        setAllProducts(prodRes.products);
      }
    } catch (err: any) {
      console.error('Failed to load low stock inventory:', err);
      setError(err.message || 'Failed to fetch low stock alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStockData();
  }, []);

  // Filter Categories & Suppliers for Dropdowns
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.category_name) set.add(it.category_name);
    });
    return Array.from(set).sort();
  }, [items]);

  const suppliersList = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(it => {
      if (it.supplier_id && it.supplier_name) {
        map.set(it.supplier_id, it.supplier_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filter tab
      if (filterType === 'out_of_stock' && item.urgency !== 'OUT_OF_STOCK') return false;
      if (filterType === 'below_min' && item.urgency !== 'OUT_OF_STOCK' && item.urgency !== 'BELOW_MINIMUM') return false;
      if (filterType === 'near_reorder' && item.urgency !== 'NEAR_REORDER') return false;

      // Category filter
      if (selectedCategory !== 'ALL' && item.category_name !== selectedCategory) return false;

      // Supplier filter
      if (selectedSupplier !== 'ALL' && item.supplier_id !== selectedSupplier) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (item.sku && item.sku.toLowerCase().includes(q)) ||
          (item.brand_name && item.brand_name.toLowerCase().includes(q)) ||
          (item.category_name && item.category_name.toLowerCase().includes(q)) ||
          (item.supplier_name && item.supplier_name.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [items, filterType, selectedCategory, selectedSupplier, searchQuery]);

  // Handle reorder quantity adjustments
  const handleQtyChange = (itemId: string, delta: number) => {
    setCustomQuantities(prev => {
      const current = prev[itemId] || 10;
      const updated = Math.max(1, current + delta);
      return { ...prev, [itemId]: updated };
    });
  };

  const handleQtyInput = (itemId: string, val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1) {
      setCustomQuantities(prev => ({ ...prev, [itemId]: num }));
    }
  };

  // Toggle selection for bulk PO
  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(it => it.id)));
    }
  };

  // 1-Click Proactive Reorder for Single Item
  const handleSingleReorder = (item: LowStockItem) => {
    const orderQty = customQuantities[item.id] || item.suggested_reorder_qty || 10;
    const initialItem = {
      product_id: item.id,
      product_name: item.name,
      hsn_code: item.hsn_code || '1209',
      quantity: orderQty,
      unit: item.unit || 'Kg',
      rate: item.purchase_price || 100,
      discount: 0,
      tax_rate: item.gst_rate !== undefined ? item.gst_rate : 18
    };

    setPoInitialSupplierId(item.supplier_id || '');
    setPoInitialItems([initialItem]);
    setIsPoModalOpen(true);
  };

  // Bulk Reorder for Selected Items
  const handleBulkReorder = () => {
    const selectedList = items.filter(it => selectedItemIds.has(it.id));
    if (selectedList.length === 0) return;

    // Detect if single supplier or diverse
    const primarySupplier = selectedList.find(it => it.supplier_id)?.supplier_id || '';

    const poItems = selectedList.map(it => {
      const orderQty = customQuantities[it.id] || it.suggested_reorder_qty || 10;
      return {
        product_id: it.id,
        product_name: it.name,
        hsn_code: it.hsn_code || '1209',
        quantity: orderQty,
        unit: it.unit || 'Kg',
        rate: it.purchase_price || 100,
        discount: 0,
        tax_rate: it.gst_rate !== undefined ? it.gst_rate : 18
      };
    });

    setPoInitialSupplierId(primarySupplier);
    setPoInitialItems(poItems);
    setIsPoModalOpen(true);
  };

  // Calculate selected total cost
  const selectedCost = useMemo(() => {
    return items
      .filter(it => selectedItemIds.has(it.id))
      .reduce((sum, it) => {
        const qty = customQuantities[it.id] || it.suggested_reorder_qty || 10;
        return sum + (qty * (it.purchase_price || 0));
      }, 0);
  }, [items, selectedItemIds, customQuantities]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
      {/* Widget Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-100">
                  Low Stock & Proactive Reorder Alerts
                </h2>
                {summary.totalLowStockCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full animate-pulse">
                    {summary.totalLowStockCount} Below Minimum
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Items falling below defined minimum stock thresholds. Generate supplier purchase orders directly with 1-click.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Button & Refresh */}
        <div className="flex items-center space-x-2">
          {selectedItemIds.size > 0 && (
            <button
              onClick={handleBulkReorder}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Bulk Reorder ({selectedItemIds.size}) • ₹{selectedCost.toLocaleString()}</span>
            </button>
          )}
          <button
            onClick={fetchLowStockData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Stock Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-rose-900/30 p-3 rounded-xl">
          <div className="text-[11px] text-rose-400 flex items-center justify-between font-medium">
            <span>Out of Stock (0 Qty)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {summary.outOfStockCount} <span className="text-xs text-slate-400 font-normal">items</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Critical depletion</div>
        </div>

        <div className="bg-slate-950/60 border border-amber-900/30 p-3 rounded-xl">
          <div className="text-[11px] text-amber-400 flex items-center justify-between font-medium">
            <span>Below Minimum Stock</span>
            <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {summary.belowMinCount} <span className="text-xs text-slate-400 font-normal">items</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Under safety reserve</div>
        </div>

        <div className="bg-slate-950/60 border border-yellow-900/30 p-3 rounded-xl">
          <div className="text-[11px] text-yellow-400 flex items-center justify-between font-medium">
            <span>Near Reorder Level</span>
            <Package className="w-3.5 h-3.5 text-yellow-500" />
          </div>
          <div className="text-xl font-bold text-yellow-400 mt-1">
            {summary.nearReorderCount} <span className="text-xs text-slate-400 font-normal">items</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Approaching threshold</div>
        </div>

        <div className="bg-slate-950/60 border border-emerald-900/30 p-3 rounded-xl">
          <div className="text-[11px] text-emerald-400 flex items-center justify-between font-medium">
            <span>Est. Reorder Capital</span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            ₹{summary.totalEstReorderCost.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">To restore safe stock</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs">
        {/* Urgency Tabs */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-800 text-slate-100 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Alerts ({summary.totalAlertsCount})
          </button>
          <button
            onClick={() => setFilterType('below_min')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              filterType === 'below_min'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Below Min ({summary.totalLowStockCount})
          </button>
          <button
            onClick={() => setFilterType('out_of_stock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              filterType === 'out_of_stock'
                ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Out of Stock ({summary.outOfStockCount})
          </button>
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {categoriesList.length > 0 && (
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Filter by Product Category"
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1.5 rounded-xl text-xs focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {suppliersList.length > 0 && (
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              aria-label="Filter by Preferred Supplier"
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1.5 rounded-xl text-xs focus:border-emerald-500 focus:outline-none max-w-[160px] truncate"
            >
              <option value="ALL">All Suppliers</option>
              {suppliersList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search low stock item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-8 pr-3 py-1.5 rounded-xl text-xs focus:border-emerald-500 focus:outline-none placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Items Table / List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <div className="animate-spin w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs">Analyzing store stock levels & minimum thresholds...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-10 text-center space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/60 p-6">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Stock Levels are Healthy</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'ALL' || selectedSupplier !== 'ALL' || filterType !== 'all'
                ? 'No items match your filter criteria.'
                : 'All agri products currently meet or exceed their defined minimum safety stock levels.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Product & Details</th>
                  <th className="p-3">Category & Brand</th>
                  <th className="p-3">Stock vs Min Level</th>
                  <th className="p-3">Preferred Supplier</th>
                  <th className="p-3 text-center">Reorder Qty</th>
                  <th className="p-3 text-right">Est. Cost</th>
                  <th className="p-3 text-right">Proactive Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredItems.map(item => {
                  const orderQty = customQuantities[item.id] || item.suggested_reorder_qty || 10;
                  const lineCost = orderQty * (item.purchase_price || 0);
                  const isSelected = selectedItemIds.has(item.id);

                  // Calculate stock percentage vs min_stock for gauge
                  const stockPct = item.min_stock > 0
                    ? Math.min(100, Math.round((item.current_stock / item.min_stock) * 100))
                    : 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition group ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Product Name & SKU */}
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                            <span>{item.name}</span>
                            {item.urgency === 'OUT_OF_STOCK' && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-bold">
                                0 Stock
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-2 font-mono">
                            <span>{item.code}</span>
                            {item.sku && <span>• {item.sku}</span>}
                            {item.pack_size && <span className="text-slate-400">({item.pack_size})</span>}
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="text-slate-300 font-medium truncate max-w-[130px]">
                            {item.category_name || 'General'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {item.brand_name || item.product_type || 'Agri'}
                          </div>
                        </div>
                      </td>

                      {/* Stock vs Min Level Progress */}
                      <td className="p-3">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className={`font-bold font-mono ${
                              item.current_stock === 0
                                ? 'text-rose-400'
                                : item.current_stock <= item.min_stock
                                ? 'text-amber-400'
                                : 'text-yellow-400'
                            }`}>
                              {item.current_stock} {item.unit}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              Min: <strong className="text-slate-200">{item.min_stock}</strong> {item.unit}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.current_stock === 0
                                  ? 'w-0'
                                  : stockPct < 40
                                  ? 'bg-rose-500'
                                  : stockPct < 80
                                  ? 'bg-amber-500'
                                  : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.max(4, stockPct)}%` }}
                            />
                          </div>

                          {/* Deficit Badge */}
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-rose-400 font-medium">
                              Deficit: -{item.shortage_qty} {item.unit}
                            </span>
                            <span className="text-slate-400 font-mono">
                              Reorder: {item.reorder_level}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Preferred Supplier */}
                      <td className="p-3">
                        {item.supplier_name ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 truncate max-w-[140px]" title={item.supplier_name}>
                              {item.supplier_name}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                              {item.supplier_mobile && (
                                <a
                                  href={`tel:${item.supplier_mobile}`}
                                  className="text-emerald-400 hover:underline flex items-center space-x-0.5"
                                  title={`Call ${item.supplier_mobile}`}
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{item.supplier_mobile}</span>
                                </a>
                              )}
                              {item.supplier_city && (
                                <span className="text-slate-400">• {item.supplier_city}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Reorder Qty Input / Stepper */}
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.id, -5)}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                            title="Decrease by 5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={orderQty}
                            onChange={e => handleQtyInput(item.id, e.target.value)}
                            className="w-12 text-center bg-transparent text-slate-100 font-mono font-bold text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.id, 5)}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                            title="Increase by 5"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          Rate: ₹{item.purchase_price}
                        </div>
                      </td>

                      {/* Est. Cost */}
                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-slate-100">
                          ₹{lineCost.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          +{item.gst_rate || 0}% GST
                        </div>
                      </td>

                      {/* Proactive Reorder Action */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSingleReorder(item)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Reorder Now</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Bulk Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center space-x-2">
              <span>Showing <strong>{filteredItems.length}</strong> low-stock items</span>
              {selectedItemIds.size > 0 && (
                <span className="text-emerald-400 font-semibold">
                  • {selectedItemIds.size} items selected (₹{selectedCost.toLocaleString()})
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {selectedItemIds.size > 0 ? (
                <button
                  type="button"
                  onClick={handleBulkReorder}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Create Consolidated Purchase Order</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    // Pre-select all visible and trigger bulk
                    setSelectedItemIds(new Set(filteredItems.map(it => it.id)));
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-[11px]"
                >
                  Select All for Bulk PO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Create Purchase Order Modal */}
      <CreatePurchaseOrderModal
        isOpen={isPoModalOpen}
        onClose={() => {
          setIsPoModalOpen(false);
          setPoInitialItems([]);
          setPoInitialSupplierId(undefined);
        }}
        onSuccess={() => {
          fetchLowStockData();
        }}
        suppliers={suppliers}
        products={allProducts}
        initialSupplierId={poInitialSupplierId}
        initialItems={poInitialItems}
      />
    </div>
  );
};
