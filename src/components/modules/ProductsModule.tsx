import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Product, Category, Brand } from '../../types';
import { Plus, Search, Filter, Edit, Package, ShieldCheck, Tag, Layers, Scale, FileText, Trash2 } from 'lucide-react';
import { DeleteConfirmationModal, RelatedDataCleanupItem } from '../common/DeleteConfirmationModal';

interface ProductsModuleProps {
  activeSubTab?: string;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'products' | 'categories' | 'brands' | 'units' | 'hsn' => {
    if (subTab === 'categories') return 'categories';
    if (subTab === 'brands') return 'brands';
    if (subTab === 'units') return 'units';
    if (subTab === 'hsn') return 'hsn';
    return 'products';
  };

  const [tab, setTab] = useState<'products' | 'categories' | 'brands' | 'units' | 'hsn'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  // Main data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [hsnCodes, setHsnCodes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showAddHsnModal, setShowAddHsnModal] = useState(false);

  // Safe Cascade Deletion State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'product' | 'category' | 'brand' | 'unit';
    id: string;
    name: string;
    code?: string;
    relatedData: RelatedDataCleanupItem[];
    warning: string;
    requireTyping?: boolean;
    endpoint: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [productForm, setProductForm] = useState({
    code: '', sku: '', name: '', product_type: 'Seed', category_id: '', brand_id: '',
    crop: '', pack_size: '1 Kg', unit: 'Kg', purchase_price: 100, mrp: 150, selling_price: 140,
    hsn_code: '1209', gst_rate: 18, barcode: ''
  });

  const [editForm, setEditForm] = useState({
    name: '', code: '', sku: '', product_type: 'Seed', category_id: '', brand_id: '',
    crop: '', pack_size: '1 Kg', unit: 'Kg', purchase_price: 100, mrp: 150, selling_price: 140,
    hsn_code: '1209', gst_rate: 18, barcode: '', is_active: 1
  });

  const hsnAgriPresets = [
    { code: '1209', label: 'Seeds (HSN 1209)', gst: 0 },
    { code: '3101', label: 'Bio / Organic Fertilizer (HSN 3101)', gst: 5 },
    { code: '3102', label: 'Urea / Nitrogenous Fertilizer (HSN 3102)', gst: 5 },
    { code: '3105', label: 'NPK / DAP Complex Fertilizer (HSN 3105)', gst: 5 },
    { code: '3808', label: 'Insecticides / Pesticides / Fungicides (HSN 3808)', gst: 18 },
    { code: '8424', label: 'Agri Sprayers & Equipment (HSN 8424)', gst: 12 },
  ];

  const [catForm, setCatForm] = useState({ name: '', code: '', description: '' });
  const [brandForm, setBrandForm] = useState({ name: '', manufacturer: '', description: '' });
  const [unitForm, setUnitForm] = useState({ name: '', code: '', is_base: false, conversion_factor: 1 });
  const [hsnForm, setHsnForm] = useState({ hsn_code: '1209', description: 'Agricultural Seeds', gst_rate: 0 });

  const loadData = async () => {
    try {
      setLoading(true);
      let url = '/api/products?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (selectedType) url += `product_type=${encodeURIComponent(selectedType)}&`;

      const [pRes, cRes, bRes, uRes, hRes] = await Promise.all([
        apiRequest(url),
        apiRequest('/api/products/masters/categories'),
        apiRequest('/api/products/masters/brands'),
        apiRequest('/api/products/masters/units'),
        apiRequest('/api/products/masters/hsn')
      ]);

      setProducts(pRes.products || []);
      setCategories(cRes.categories || []);
      setBrands(bRes.brands || []);
      setUnits(uRes.units || []);
      setHsnCodes(hRes.hsnCodes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedType]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/products', { method: 'POST', body: JSON.stringify(productForm) });
      setShowAddProductModal(false);
      setProductForm({
        code: '', sku: '', name: '', product_type: 'Seed', category_id: '', brand_id: '',
        crop: '', pack_size: '1 Kg', unit: 'Kg', purchase_price: 100, mrp: 150, selling_price: 140,
        hsn_code: '1209', gst_rate: 18, barcode: ''
      });
      loadData();
      alert('Product created successfully with HSN code.');
    } catch (err: any) {
      alert(err.message || 'Failed to create product.');
    }
  };

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setEditForm({
      name: p.name || '',
      code: p.code || '',
      sku: p.sku || '',
      product_type: p.product_type || 'Seed',
      category_id: p.category_id || '',
      brand_id: p.brand_id || '',
      crop: p.crop || '',
      pack_size: p.pack_size || '1 Kg',
      unit: p.unit || 'Kg',
      purchase_price: p.purchase_price || 0,
      mrp: p.mrp || 0,
      selling_price: p.selling_price || 0,
      hsn_code: p.hsn_code || '1209',
      gst_rate: p.gst_rate ?? 18,
      barcode: p.primary_barcode || '',
      is_active: p.is_active ?? 1
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await apiRequest(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setShowEditProductModal(false);
      setEditingProduct(null);
      loadData();
      alert('Product and HSN details updated successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to update product.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/products/masters/categories', { method: 'POST', body: JSON.stringify(catForm) });
      setShowAddCatModal(false);
      setCatForm({ name: '', code: '', description: '' });
      loadData();
      alert('Category added successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to create category.');
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/products/masters/brands', { method: 'POST', body: JSON.stringify(brandForm) });
      setShowAddBrandModal(false);
      setBrandForm({ name: '', manufacturer: '', description: '' });
      loadData();
      alert('Brand registered successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to create brand.');
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/products/masters/units', { method: 'POST', body: JSON.stringify(unitForm) });
      setShowAddUnitModal(false);
      setUnitForm({ name: '', code: '', is_base: false, conversion_factor: 1 });
      loadData();
      alert('Unit of measurement created.');
    } catch (err: any) {
      alert(err.message || 'Failed to create unit.');
    }
  };

  const handleCreateHsn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/products/masters/hsn', { method: 'POST', body: JSON.stringify(hsnForm) });
      setShowAddHsnModal(false);
      loadData();
      alert('HSN GST rule saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to save HSN rule.');
    }
  };

  const handlePromptDeleteProduct = (p: Product) => {
    setDeleteTarget({
      type: 'product',
      id: p.id,
      name: p.name,
      code: p.code || p.sku,
      endpoint: `/api/products/${p.id}`,
      requireTyping: true,
      warning: `Deleting this product will permanently wipe its master record and sanitize all correlated inventory batches, barcode assignments, stock transfers, and price tracking history.`,
      relatedData: [
        { label: 'Inventory Batches', description: 'All stored physical batches and warehouse lots in stock', count: 'All Batches' },
        { label: 'Barcode Mapping', description: 'Primary and secondary EAN/UPC barcode numbers assigned to this item', count: p.primary_barcode ? '1+ Assigned' : 'Cleaned' },
        { label: 'Inventory Movement Logs', description: 'Audit trail records of inward and outward stock movements' },
        { label: 'Purchase & POS Items', description: 'Associated historical order lines and held bill items' },
      ]
    });
  };

  const handlePromptDeleteCategory = (c: Category) => {
    const affectedCount = products.filter(p => p.category_id === c.id).length;
    setDeleteTarget({
      type: 'category',
      id: c.id,
      name: c.name,
      code: c.code,
      endpoint: `/api/products/masters/categories/${c.id}`,
      warning: `Deleting category "${c.name}" will safely unlink it from all associated products and remove category hierarchies.`,
      relatedData: [
        { label: 'Assigned Products', description: 'Products currently tagged with this category will have their category reference cleanly reset to unassigned', count: `${affectedCount} Products` },
        { label: 'Sub-Categories', description: 'Any child subcategories mapped to this category ID' }
      ]
    });
  };

  const handlePromptDeleteBrand = (b: Brand) => {
    const affectedCount = products.filter(p => p.brand_id === b.id).length;
    setDeleteTarget({
      type: 'brand',
      id: b.id,
      name: b.name,
      endpoint: `/api/products/masters/brands/${b.id}`,
      warning: `Deleting brand "${b.name}" will safely unlink brand metadata from associated catalog items.`,
      relatedData: [
        { label: 'Assigned Catalog Products', description: 'Products with this manufacturer tag will be unlinked', count: `${affectedCount} Products` },
        { label: 'Brand Discounts', description: 'Brand-level margin and discount rules' }
      ]
    });
  };

  const handlePromptDeleteUnit = (u: any) => {
    setDeleteTarget({
      type: 'unit',
      id: u.id,
      name: `${u.name} (${u.code})`,
      code: u.code,
      endpoint: `/api/products/masters/units/${u.id}`,
      warning: `Deleting unit "${u.name}" will remove unit conversion multipliers.`,
      relatedData: [
        { label: 'UOM Mapping', description: 'Unit conversion matrices and secondary scale factors' }
      ]
    });
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiRequest(deleteTarget.endpoint, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Unknown server error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header & Sub-Nav Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>Products & Masters Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Agri inputs master catalog, categories, brand manufacturers, measurement units & HSN GST rules
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'products' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Catalog</span>
          </button>

          <button
            onClick={() => setTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'categories' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setTab('brands')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'brands' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Brands ({brands.length})</span>
          </button>

          <button
            onClick={() => setTab('units')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'units' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Units & Conversions</span>
          </button>

          <button
            onClick={() => setTab('hsn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'hsn' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>HSN & GST Rules</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product name, SKU, code, barcode, crop..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Product Types</option>
              <option value="Seed">Seeds</option>
              <option value="Fertilizer">Fertilizers</option>
              <option value="Insecticide">Insecticides</option>
              <option value="Fungicide">Fungicides</option>
              <option value="Herbicide">Herbicides</option>
              <option value="Equipment">Equipment</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>

            <button
              onClick={() => setShowAddProductModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Product Name & Crop</th>
                  <th className="p-3">Category / Brand</th>
                  <th className="p-3">SKU / Barcode</th>
                  <th className="p-3">HSN Code & GST</th>
                  <th className="p-3 text-right">Purchase Price</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading catalog...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-slate-400">Crop: {p.crop || 'All'} | Pack: {p.pack_size}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-emerald-400 font-medium">{p.category_name}</div>
                        <div className="text-[10px] text-slate-400">{p.brand_name || 'Generic'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-slate-300">{p.sku}</div>
                        <div className="text-[10px] text-slate-400 font-mono">BC: {p.primary_barcode}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            HSN: {p.hsn_code}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{p.gst_rate}% GST Rate</div>
                      </td>
                      <td className="p-3 text-right font-medium text-slate-300">₹{p.purchase_price}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">₹{p.selling_price}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          (p.current_stock || 0) <= p.reorder_level
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {p.current_stock || 0} {p.unit}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2 py-1 rounded text-[11px] font-semibold border border-slate-700 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePromptDeleteProduct(p)}
                            className="p-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition border border-slate-700 hover:border-rose-500/30"
                            title="Delete Product & Clean Related Data"
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

      {/* TAB 2: CATEGORIES */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Agricultural Input Categories</span>
            <button
              onClick={() => setShowAddCatModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Category Name</th>
                  <th className="p-3">Category Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Product Count</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {categories.map(c => {
                  const pCount = products.filter(p => p.category_id === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-100 flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{c.name}</span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400">{c.code}</td>
                      <td className="p-3 text-slate-400">{c.description || 'Standard Agri Category'}</td>
                      <td className="p-3 text-right font-bold text-slate-200">{pCount} Products</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handlePromptDeleteCategory(c)}
                          className="p-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition border border-slate-700 hover:border-rose-500/30"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BRANDS */}
      {tab === 'brands' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Registered Agri Brands & Manufacturers</span>
            <button
              onClick={() => setShowAddBrandModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Register Brand</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Brand Name</th>
                  <th className="p-3">Manufacturer Company</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Associated Products</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {brands.map(b => {
                  const pCount = products.filter(p => p.brand_id === b.id).length;
                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-100 flex items-center space-x-2">
                        <Tag className="w-3.5 h-3.5 text-teal-400" />
                        <span>{b.name}</span>
                      </td>
                      <td className="p-3 text-emerald-400 font-semibold">{b.manufacturer || b.name}</td>
                      <td className="p-3 text-slate-400">{b.description || 'Certified Seed / Agro Brand'}</td>
                      <td className="p-3 text-right font-bold text-slate-200">{pCount} Items</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handlePromptDeleteBrand(b)}
                          className="p-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition border border-slate-700 hover:border-rose-500/30"
                          title="Delete Brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: UNITS */}
      {tab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Units of Measurement (UOM) & Multipliers</span>
            <button
              onClick={() => setShowAddUnitModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Unit</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Unit Code</th>
                  <th className="p-3">Unit Name</th>
                  <th className="p-3">Base Unit Type</th>
                  <th className="p-3">Standard Multiplier</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {units.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-emerald-400">{u.code}</td>
                    <td className="p-3 font-semibold text-slate-100">{u.name}</td>
                    <td className="p-3">
                      {u.is_base ? (
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-bold">
                          Base Unit
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Secondary Unit</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-300">1 {u.code} = {u.is_base ? '1 Base' : 'Custom Ratio'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handlePromptDeleteUnit(u)}
                        className="p-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition border border-slate-700 hover:border-rose-500/30"
                        title="Delete Unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: HSN & GST */}
      {tab === 'hsn' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">HSN Codes & GST Tax Rate Configuration</span>
            <button
              onClick={() => setShowAddHsnModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Configure HSN Code</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-md">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">GST Rate (%)</th>
                  <th className="p-3 text-right">CGST (%)</th>
                  <th className="p-3 text-right">SGST (%)</th>
                  <th className="p-3 text-right">IGST (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {hsnCodes.map((h: any) => (
                  <tr key={h.id || h.hsn_code} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-amber-400">{h.hsn_code}</td>
                    <td className="p-3 text-slate-200 font-medium">{h.description || 'Agricultural Product'}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{h.gst_rate}%</td>
                    <td className="p-3 text-right text-slate-400">{h.cgst}%</td>
                    <td className="p-3 text-right text-slate-400">{h.sgst}%</td>
                    <td className="p-3 text-right text-slate-300 font-semibold">{h.igst}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Add New Agricultural Product</h3>
                <p className="text-[11px] text-slate-400">Configure product specifications, pricing, and HSN tax code</p>
              </div>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Product Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRD-SEED-99"
                    value={productForm.code}
                    onChange={e => setProductForm({ ...productForm, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SEED-PAD-99"
                    value={productForm.sku}
                    onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Full Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paddy Hybrid Seed - Kaveri Sampurna"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Category *</label>
                  <select
                    required
                    value={productForm.category_id}
                    onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Brand</label>
                  <select
                    value={productForm.brand_id}
                    onChange={e => setProductForm({ ...productForm, brand_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="">Generic / Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Product Type</label>
                  <select
                    value={productForm.product_type}
                    onChange={e => setProductForm({ ...productForm, product_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="Seed">Seed</option>
                    <option value="Fertilizer">Fertilizer</option>
                    <option value="Insecticide">Insecticide</option>
                    <option value="Fungicide">Fungicide</option>
                    <option value="Herbicide">Herbicide</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>

              {/* HSN Code & GST Selection */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-amber-400 font-bold text-[11px]">HSN Code & GST Rate *</label>
                  <span className="text-[10px] text-slate-400">Included in tax invoice data (not printed on customer receipt)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">HSN Code (4-8 digits)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1209, 3101, 3808"
                      value={productForm.hsn_code}
                      onChange={e => setProductForm({ ...productForm, hsn_code: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">GST Rate (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="28"
                      value={productForm.gst_rate}
                      onChange={e => setProductForm({ ...productForm, gst_rate: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold text-emerald-400"
                    />
                  </div>
                </div>

                {/* Quick HSN Preset Buttons */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-medium">Quick HSN Presets for Agri Products:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {hsnAgriPresets.map(preset => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, hsn_code: preset.code, gst_rate: preset.gst })}
                        className={`px-2 py-1 rounded text-[10px] border transition font-medium ${
                          productForm.hsn_code === preset.code
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-850 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Target Crop</label>
                  <input
                    type="text"
                    placeholder="e.g. Paddy, Cotton, Chilli"
                    value={productForm.crop}
                    onChange={e => setProductForm({ ...productForm, crop: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Pack Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Kg, 500 ml, 50 Kg"
                    value={productForm.pack_size}
                    onChange={e => setProductForm({ ...productForm, pack_size: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Unit of Measure</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Grams">Grams (Gms)</option>
                    <option value="Litre">Litre (Ltr)</option>
                    <option value="Ml">Millilitre (Ml)</option>
                    <option value="Packets">Packets (Pkt)</option>
                    <option value="Bags">Bags (Bag)</option>
                    <option value="Pcs">Pieces (Pcs)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.purchase_price}
                    onChange={e => setProductForm({ ...productForm, purchase_price: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={productForm.mrp}
                    onChange={e => setProductForm({ ...productForm, mrp: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.selling_price}
                    onChange={e => setProductForm({ ...productForm, selling_price: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT */}
      {showEditProductModal && editingProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Edit Product & HSN Tax Details</h3>
                <p className="text-[11px] text-slate-400">Update HSN code, pricing, and tax classification</p>
              </div>
              <button onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Product Code</label>
                  <input
                    type="text"
                    disabled
                    value={editForm.code}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">SKU Code</label>
                  <input
                    type="text"
                    disabled
                    value={editForm.sku}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Full Product Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Category *</label>
                  <select
                    required
                    value={editForm.category_id}
                    onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Brand</label>
                  <select
                    value={editForm.brand_id}
                    onChange={e => setEditForm({ ...editForm, brand_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="">Generic / Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Product Type</label>
                  <select
                    value={editForm.product_type}
                    onChange={e => setEditForm({ ...editForm, product_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="Seed">Seed</option>
                    <option value="Fertilizer">Fertilizer</option>
                    <option value="Insecticide">Insecticide</option>
                    <option value="Fungicide">Fungicide</option>
                    <option value="Herbicide">Herbicide</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>

              {/* HSN Code & GST Selection */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-amber-400 font-bold text-[11px]">HSN Code & GST Rate *</label>
                  <span className="text-[10px] text-slate-400">Included in sale invoice database; excluded from customer receipt copy</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">HSN Code (4-8 digits)</label>
                    <input
                      type="text"
                      required
                      value={editForm.hsn_code}
                      onChange={e => setEditForm({ ...editForm, hsn_code: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">GST Rate (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="28"
                      value={editForm.gst_rate}
                      onChange={e => setEditForm({ ...editForm, gst_rate: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold text-emerald-400"
                    />
                  </div>
                </div>

                {/* Quick HSN Preset Buttons */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-medium">Quick HSN Presets:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {hsnAgriPresets.map(preset => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, hsn_code: preset.code, gst_rate: preset.gst })}
                        className={`px-2 py-1 rounded text-[10px] border transition font-medium ${
                          editForm.hsn_code === preset.code
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-850 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Target Crop</label>
                  <input
                    type="text"
                    value={editForm.crop}
                    onChange={e => setEditForm({ ...editForm, crop: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Pack Size</label>
                  <input
                    type="text"
                    value={editForm.pack_size}
                    onChange={e => setEditForm({ ...editForm, pack_size: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Unit of Measure</label>
                  <select
                    value={editForm.unit}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  >
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Grams">Grams (Gms)</option>
                    <option value="Litre">Litre (Ltr)</option>
                    <option value="Ml">Millilitre (Ml)</option>
                    <option value="Packets">Packets (Pkt)</option>
                    <option value="Bags">Bags (Bag)</option>
                    <option value="Pcs">Pieces (Pcs)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    value={editForm.purchase_price}
                    onChange={e => setEditForm({ ...editForm, purchase_price: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={editForm.mrp}
                    onChange={e => setEditForm({ ...editForm, mrp: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={editForm.selling_price}
                    onChange={e => setEditForm({ ...editForm, selling_price: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Add Product Category</h3>
              <button onClick={() => setShowAddCatModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bio-Pesticides"
                  value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAT-BIO"
                  value={catForm.code}
                  onChange={e => setCatForm({ ...catForm, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Botanical & Microbial Pest Control"
                  value={catForm.description}
                  onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow">
                Save Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BRAND */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Register Brand / Manufacturer</h3>
              <button onClick={() => setShowAddBrandModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateBrand} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Syngenta"
                  value={brandForm.name}
                  onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Manufacturer Company</label>
                <input
                  type="text"
                  placeholder="e.g. Syngenta India Ltd"
                  value={brandForm.manufacturer}
                  onChange={e => setBrandForm({ ...brandForm, manufacturer: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Global Agri Tech Manufacturer"
                  value={brandForm.description}
                  onChange={e => setBrandForm({ ...brandForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow">
                Save Brand
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD UNIT */}
      {showAddUnitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Add Unit of Measurement</h3>
              <button onClick={() => setShowAddUnitModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateUnit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Unit Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QNTL"
                  value={unitForm.code}
                  onChange={e => setUnitForm({ ...unitForm, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Unit Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quintal"
                  value={unitForm.name}
                  onChange={e => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Multiplier to Base Unit (Kg/Litre)</label>
                <input
                  type="number"
                  placeholder="e.g. 100 for Quintal"
                  value={unitForm.conversion_factor}
                  onChange={e => setUnitForm({ ...unitForm, conversion_factor: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-bold"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow">
                Save Unit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD HSN */}
      {showAddHsnModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Configure HSN Code & GST</h3>
              <button onClick={() => setShowAddHsnModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateHsn} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">HSN Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3808"
                  value={hsnForm.hsn_code}
                  onChange={e => setHsnForm({ ...hsnForm, hsn_code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Insecticides, Fungicides & Herbicides"
                  value={hsnForm.description}
                  onChange={e => setHsnForm({ ...hsnForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">GST Tax Rate (%)</label>
                <select
                  value={hsnForm.gst_rate}
                  onChange={e => setHsnForm({ ...hsnForm, gst_rate: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                >
                  <option value={0}>0% (Exempt Seeds)</option>
                  <option value={5}>5% (Fertilizers)</option>
                  <option value={12}>12% (Agri Equipment)</option>
                  <option value={18}>18% (Pesticides & Chemicals)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow">
                Save HSN Rule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog with Cascading Cleanup Details */}
      {deleteTarget && (
        <DeleteConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleExecuteDelete}
          title={`Delete ${deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1)}`}
          itemName={deleteTarget.name}
          itemType={deleteTarget.type.toUpperCase()}
          itemCode={deleteTarget.code}
          warningMessage={deleteTarget.warning}
          relatedData={deleteTarget.relatedData}
          requireTypingConfirm={deleteTarget.requireTyping}
          confirmWord="DELETE"
          isDeleting={isDeleting}
        />
      )}

    </div>
  );
};
