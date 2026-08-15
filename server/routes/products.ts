import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Get products list with filters, stock levels, and primary barcode
router.get('/', (req: AuthRequest, res: Response) => {
  const { category_id, search, product_type, store_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let sql = `
    SELECT p.*, c.name as category_name, b.name as brand_name,
           pb.barcode as primary_barcode,
           COALESCE((SELECT SUM(current_qty) FROM product_batches WHERE product_id = p.id AND store_id = ? AND is_active = 1), 0) as current_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN product_barcodes pb ON p.id = pb.product_id AND pb.is_primary = 1
    WHERE 1=1
  `;
  const params: any[] = [storeId];

  if (category_id) {
    sql += ` AND (p.category_id = ? OR c.parent_id = ?)`;
    params.push(category_id, category_id);
  }

  if (product_type) {
    sql += ` AND p.product_type = ?`;
    params.push(product_type);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.sku LIKE ? OR pb.barcode LIKE ? OR p.crop LIKE ? OR p.composition LIKE ?)`;
    params.push(s, s, s, s, s, s);
  }

  sql += ` ORDER BY p.name ASC`;
  const products = queryAll(sql, params);
  res.json({ products });
});

// Get single product with full details, barcodes, and active batches
router.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const storeId = req.user!.storeId || 'store-main';

  const product = queryOne(`
    SELECT p.*, c.name as category_name, b.name as brand_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.id = ?
  `, [id]);

  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const barcodes = queryAll("SELECT * FROM product_barcodes WHERE product_id = ?", [id]);
  const batches = queryAll(`
    SELECT b.*, s.company_name as supplier_name
    FROM product_batches b
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.product_id = ? AND b.store_id = ? AND b.current_qty > 0
    ORDER BY b.expiry_date ASC
  `, [id, storeId]);

  res.json({ product, barcodes, batches });
});

// Create product
router.post('/', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const {
    code, sku, name, short_name, description, category_id, subcategory_id, brand_id, manufacturer,
    product_type, crop, suitable_crops, application, composition, formulation, pack_size, unit,
    storage_instructions, usage_instructions, license_no,
    purchase_price, mrp, selling_price, wholesale_price, dealer_price, min_selling_price, discount_pct,
    hsn_code, gst_rate, min_stock, reorder_level, reorder_qty, max_stock, opening_stock, requires_batch, barcode
  } = req.body;

  if (!name || !code || !sku || !category_id) {
    return res.status(400).json({ error: 'Product name, product code, SKU, and category are required.' });
  }

  // Check unique SKU and Code
  const existingSku = queryOne("SELECT id FROM products WHERE sku = ? OR code = ?", [sku, code]);
  if (existingSku) {
    return res.status(400).json({ error: 'Product SKU or Code already exists.' });
  }

  const pid = `prod-${Date.now()}`;
  const barcodeVal = barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  const gst = Number(gst_rate) || 18;
  const buyPrice = Number(purchase_price) || 0;
  const mrpVal = Number(mrp) || 0;
  const sellPrice = Number(selling_price) || mrpVal;

  transaction(() => {
    execute(`
      INSERT INTO products (
        id, code, sku, name, short_name, description, category_id, subcategory_id, brand_id, manufacturer,
        product_type, crop, suitable_crops, application, composition, formulation, pack_size, unit,
        storage_instructions, usage_instructions, license_no,
        purchase_price, avg_purchase_price, mrp, selling_price, wholesale_price, dealer_price, min_selling_price, discount_pct,
        hsn_code, gst_rate, cgst, sgst, igst, min_stock, reorder_level, reorder_qty, max_stock, opening_stock, requires_batch
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      pid, code, sku, name, short_name || null, description || null, category_id, subcategory_id || null, brand_id || null, manufacturer || null,
      product_type || 'Seed', crop || null, suitable_crops || null, application || null, composition || null, formulation || null, pack_size || '1 Kg', unit || 'Kg',
      storage_instructions || null, usage_instructions || null, license_no || null,
      buyPrice, buyPrice, mrpVal, sellPrice, wholesale_price || sellPrice, dealer_price || sellPrice, min_selling_price || buyPrice, discount_pct || 0,
      hsn_code || '1209', gst, gst/2, gst/2, gst, min_stock || 10, reorder_level || 15, reorder_qty || 50, max_stock || 500, opening_stock || 0, requires_batch ? 1 : 0
    ]);

    // Primary barcode
    execute("INSERT INTO product_barcodes (id, product_id, barcode, is_primary) VALUES (?, ?, ?, 1)", [`bc-${pid}`, pid, barcodeVal]);

    // Create initial opening batch if opening stock > 0
    const openStock = Number(opening_stock) || 0;
    if (openStock > 0) {
      execute(`
        INSERT INTO product_batches (
          id, product_id, batch_number, store_id, mfg_date, expiry_date, purchase_price, mrp, initial_qty, current_qty
        ) VALUES (
          ?, ?, 'OPENING-BATCH', 'store-main', '2026-01-01', '2028-12-31', ?, ?, ?, ?
        )
      `, [`batch-${pid}-OPEN`, pid, buyPrice, mrpVal, openStock, openStock]);
    }
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CREATE_PRODUCT', 'Product', pid, null, { name, sku, code });
  res.status(201).json({ message: 'Product created successfully.', productId: pid, barcode: barcodeVal });
});

// Update product
router.put('/:id', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    name, short_name, description, category_id, brand_id, manufacturer,
    product_type, crop, pack_size, unit, purchase_price, mrp, selling_price,
    hsn_code, gst_rate, min_stock, reorder_level, is_active
  } = req.body;

  const product = queryOne("SELECT * FROM products WHERE id = ?", [id]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const gst = Number(gst_rate) || 18;
  execute(`
    UPDATE products
    SET name = ?, short_name = ?, description = ?, category_id = ?, brand_id = ?, manufacturer = ?,
        product_type = ?, crop = ?, pack_size = ?, unit = ?,
        purchase_price = ?, mrp = ?, selling_price = ?, hsn_code = ?, gst_rate = ?, cgst = ?, sgst = ?, igst = ?,
        min_stock = ?, reorder_level = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    name, short_name || null, description || null, category_id, brand_id || null, manufacturer || null,
    product_type || 'Seed', crop || null, pack_size || '1 Kg', unit || 'Kg',
    Number(purchase_price) || 0, Number(mrp) || 0, Number(selling_price) || 0, hsn_code || '1209',
    gst, gst/2, gst/2, gst, Number(min_stock) || 10, Number(reorder_level) || 15, is_active ? 1 : 0, id
  ]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'UPDATE_PRODUCT', 'Product', id, product, { name, selling_price });
  res.json({ message: 'Product updated successfully.' });
});

// Delete product with atomic cascading cleanup
router.delete('/:id', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const product = queryOne("SELECT * FROM products WHERE id = ?", [id]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  transaction(() => {
    // 1. Delete associated barcodes
    execute("DELETE FROM product_barcodes WHERE product_id = ?", [id]);
    // 2. Delete inventory movement records and adjustments
    execute("DELETE FROM inventory_transactions WHERE product_id = ?", [id]);
    execute("DELETE FROM stock_adjustments WHERE product_id = ?", [id]);
    execute("DELETE FROM held_bill_items WHERE product_id = ?", [id]);
    // 3. Delete order & invoice line items
    execute("DELETE FROM purchase_order_items WHERE product_id = ?", [id]);
    execute("DELETE FROM purchase_items WHERE product_id = ?", [id]);
    execute("DELETE FROM purchase_return_items WHERE product_id = ?", [id]);
    execute("DELETE FROM sales_items WHERE product_id = ?", [id]);
    execute("DELETE FROM sale_return_items WHERE product_id = ?", [id]);
    // 4. Delete batches
    execute("DELETE FROM product_batches WHERE product_id = ?", [id]);
    // 5. Delete product record
    execute("DELETE FROM products WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_PRODUCT', 'Product', id, product, null);
  res.json({ message: `Product "${product.name}" and all associated barcodes, batch inventory, and transactions have been successfully removed.` });
});

// Master data endpoints
router.get('/masters/categories', (req: AuthRequest, res: Response) => {
  const categories = queryAll("SELECT * FROM categories ORDER BY name");
  res.json({ categories });
});

router.post('/masters/categories', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { name, code, parent_id, description } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Category name and code required.' });
  const id = `cat-${Date.now()}`;
  execute("INSERT INTO categories (id, name, code, parent_id, description) VALUES (?, ?, ?, ?, ?)", [id, name, code, parent_id || null, description || null]);
  res.json({ message: 'Category created successfully.', id });
});

router.delete('/masters/categories/:id', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const category = queryOne("SELECT * FROM categories WHERE id = ?", [id]);
  if (!category) return res.status(404).json({ error: 'Category not found.' });

  transaction(() => {
    execute("UPDATE categories SET parent_id = NULL WHERE parent_id = ?", [id]);
    const fallbackCategory = queryOne("SELECT id FROM categories WHERE id != ? LIMIT 1", [id]);
    if (fallbackCategory) {
      execute("UPDATE products SET category_id = ? WHERE category_id = ?", [fallbackCategory.id, id]);
    }
    execute("DELETE FROM categories WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_CATEGORY', 'Category', id, category, null);
  res.json({ message: `Category "${category.name}" deleted and related items safely reassigned.` });
});

router.get('/masters/brands', (req: AuthRequest, res: Response) => {
  const brands = queryAll("SELECT * FROM brands ORDER BY name");
  res.json({ brands });
});

router.post('/masters/brands', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { name, manufacturer, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Brand name is required.' });
  const id = `brand-${Date.now()}`;
  execute("INSERT INTO brands (id, name, manufacturer, description) VALUES (?, ?, ?, ?)", [id, name, manufacturer || null, description || null]);
  res.json({ message: 'Brand created successfully.', id });
});

router.delete('/masters/brands/:id', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const brand = queryOne("SELECT * FROM brands WHERE id = ?", [id]);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  transaction(() => {
    execute("UPDATE products SET brand_id = NULL WHERE brand_id = ?", [id]);
    execute("DELETE FROM brands WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_BRAND', 'Brand', id, brand, null);
  res.json({ message: `Brand "${brand.name}" deleted and unlinked from products.` });
});

router.get('/masters/units', (req: AuthRequest, res: Response) => {
  const units = queryAll("SELECT * FROM units ORDER BY name");
  const conversions = queryAll("SELECT * FROM unit_conversions");
  res.json({ units, conversions });
});

router.post('/masters/units', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { name, code, is_base, conversion_factor } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Unit name and code required.' });
  const id = `unit-${Date.now()}`;
  execute("INSERT INTO units (id, code, name, is_base) VALUES (?, ?, ?, ?)", [id, code, name, is_base ? 1 : 0]);
  
  if (conversion_factor && Number(conversion_factor) > 0) {
    execute("INSERT INTO unit_conversions (id, from_unit, to_unit, multiplier) VALUES (?, ?, 'Kg', ?)", [`uc-${Date.now()}`, code, Number(conversion_factor)]);
  }
  res.json({ message: 'Unit created successfully.', id });
});

router.delete('/masters/units/:id', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const unit = queryOne("SELECT * FROM units WHERE id = ?", [id]);
  if (!unit) return res.status(404).json({ error: 'Unit not found.' });

  transaction(() => {
    execute("DELETE FROM unit_conversions WHERE from_unit = ? OR to_unit = ?", [unit.code, unit.code]);
    execute("DELETE FROM units WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_UNIT', 'Unit', id, unit, null);
  res.json({ message: `Unit "${unit.name}" and conversions deleted.` });
});

router.get('/masters/hsn', (req: AuthRequest, res: Response) => {
  const hsnCodes = queryAll("SELECT * FROM hsn_codes ORDER BY hsn_code");
  res.json({ hsnCodes });
});

router.post('/masters/hsn', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { hsn_code, description, gst_rate } = req.body;
  if (!hsn_code) return res.status(400).json({ error: 'HSN code is required.' });
  const rate = Number(gst_rate) || 18;
  const existing = queryOne("SELECT id FROM hsn_codes WHERE hsn_code = ?", [hsn_code]);
  if (existing) {
    execute("UPDATE hsn_codes SET gst_rate = ?, cgst = ?, sgst = ?, igst = ?, description = ? WHERE hsn_code = ?", [rate, rate/2, rate/2, rate, description || null, hsn_code]);
  } else {
    const id = `hsn-${Date.now()}`;
    execute("INSERT INTO hsn_codes (id, hsn_code, description, gst_rate, cgst, sgst, igst) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, hsn_code, description || null, rate, rate/2, rate/2, rate]);
  }
  res.json({ message: 'HSN & GST Configuration updated successfully.' });
});

export default router;
