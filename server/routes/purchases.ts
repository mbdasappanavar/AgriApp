import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';
import { calculateGst } from '../utils/gst';

const router = Router();
router.use(authMiddleware);

// Get purchase invoices
const getPurchaseInvoices = (req: AuthRequest, res: Response) => {
  const { store_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  const invoices = queryAll(`
    SELECT pi.*, s.company_name as supplier_name, s.company_name, s.mobile as supplier_mobile, s.gstin as supplier_gstin,
           s.email as supplier_email, s.address as supplier_address, s.city as supplier_city, s.pin as supplier_pin,
           st.name as store_name
    FROM purchase_invoices pi
    JOIN suppliers s ON pi.supplier_id = s.id
    JOIN stores st ON pi.store_id = st.id
    WHERE pi.store_id = ?
    ORDER BY pi.invoice_date DESC, pi.created_at DESC
  `, [storeId]);

  res.json({ purchases: invoices, invoices });
};

router.get('/', getPurchaseInvoices);
router.get('/invoices', getPurchaseInvoices);

// Get single purchase invoice with items
const getSinglePurchaseInvoice = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const invoice = queryOne(`
    SELECT pi.*, s.company_name as supplier_name, s.company_name, s.mobile as supplier_mobile, s.gstin as supplier_gstin,
           s.state as supplier_state, s.email as supplier_email, s.address as supplier_address, s.city as supplier_city, s.pin as supplier_pin,
           st.name as store_name
    FROM purchase_invoices pi
    JOIN suppliers s ON pi.supplier_id = s.id
    JOIN stores st ON pi.store_id = st.id
    WHERE pi.id = ?
  `, [id]);

  if (!invoice) return res.status(404).json({ error: 'Purchase invoice not found.' });

  const items = queryAll(`
    SELECT pit.*, p.name as product_name, p.code as product_code, p.sku as product_sku, p.unit as product_unit,
           COALESCE(pit.hsn_code, p.hsn_code, '1209') as hsn_code
    FROM purchase_items pit
    JOIN products p ON pit.product_id = p.id
    WHERE pit.purchase_id = ?
  `, [id]);

  res.json({ invoice, items });
};

router.get('/invoices/:id', getSinglePurchaseInvoice);

// Atomic Purchase Invoice creation
const createPurchaseInvoice = (req: AuthRequest, res: Response) => {
  const {
    supplier_id, supplier_invoice_no, invoice_date, items, notes, supplier_notes,
    cash_discount, supplier_credit_note_status, supplier_credit_note_no,
    supplier_credit_note_date, supplier_credit_note_amount
  } = req.body;

  const storeId = req.user!.storeId || 'store-main';

  if (!supplier_id || !supplier_invoice_no || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, supplier invoice number, and at least one item are required.' });
  }

  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [supplier_id]);
  if (!supplier) return res.status(400).json({ error: 'Supplier not found.' });

  const store = queryOne("SELECT * FROM stores WHERE id = ?", [storeId]);
  const isInterstate = (supplier.state || 'Karnataka').trim().toLowerCase() !== (store?.state || 'Karnataka').trim().toLowerCase();

  const count = queryOne("SELECT COUNT(*) as c FROM purchase_invoices")?.c || 0;
  const invoiceNumber = `PUR-2627-${(1001 + count).toString()}`;
  const purchaseId = `pur-${Date.now()}`;

  const cashDiscountNum = Number(cash_discount) || 0;
  const creditNoteStatus = supplier_credit_note_status || 'none';
  const creditNoteNo = supplier_credit_note_no ? String(supplier_credit_note_no).trim() : null;
  const creditNoteDate = supplier_credit_note_date || null;
  const creditNoteAmountNum = Number(supplier_credit_note_amount) || 0;
  const refNotes = supplier_notes || notes || null;

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let grandTotal = 0;
  let balanceDue = 0;

  transaction(() => {
    // Process items first to calculate total taxes
    const processedItems: any[] = [];

    for (const item of items) {
      const product = queryOne("SELECT * FROM products WHERE id = ?", [item.product_id]);
      if (!product) throw new Error(`Product ID ${item.product_id} not found.`);

      const qty = Number(item.quantity);
      const rate = Number(item.purchase_rate !== undefined ? item.purchase_rate : item.unit_price);
      const sellingPrice = Number(item.selling_price) || (product.selling_price || product.mrp);
      const mrpVal = Number(item.mrp) || product.mrp || sellingPrice;
      const discountPct = Number(item.discount_pct) || 0;
      let discount = Number(item.discount) || 0;
      if (discountPct > 0 && discount === 0) {
        discount = Number(((qty * rate * discountPct) / 100).toFixed(2));
      }
      
      const itemHsn = item.hsn_code ? String(item.hsn_code).trim() : (product.hsn_code || '1209');
      const batchNo = item.batch_number ? String(item.batch_number).trim() : `BAT-${Date.now().toString().slice(-6)}`;
      const mfgDate = item.mfg_date || '2026-01-01';
      const expiryDate = item.expiry_date || '2028-12-31';

      if (qty <= 0 || rate < 0) throw new Error(`Invalid quantity or rate for product ${product.name}`);

      const lineTaxable = Number(Math.max(0, (qty * rate) - discount).toFixed(2));
      const gstRes = calculateGst({
        taxableValue: lineTaxable,
        gstRate: product.gst_rate || 18,
        isInterstate
      });

      totalTaxable += gstRes.taxableValue;
      totalCgst += gstRes.cgstAmount;
      totalSgst += gstRes.sgstAmount;
      totalIgst += gstRes.igstAmount;
      grandTotal += gstRes.totalAmount;

      // 1. Create product batch or update batch stock
      let batchId = `batch-${product.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const existingBatch = queryOne(`
        SELECT id, current_qty FROM product_batches
        WHERE product_id = ? AND batch_number = ? AND store_id = ?
      `, [product.id, batchNo, storeId]);

      if (existingBatch) {
        batchId = existingBatch.id;
        execute(`
          UPDATE product_batches
          SET current_qty = current_qty + ?, purchase_price = ?, mrp = ?
          WHERE id = ?
        `, [qty, rate, mrpVal, batchId]);
      } else {
        execute(`
          INSERT INTO product_batches (
            id, product_id, batch_number, store_id, mfg_date, expiry_date,
            supplier_id, purchase_invoice_no, purchase_price, mrp, initial_qty, current_qty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [batchId, product.id, batchNo, storeId, mfgDate, expiryDate, supplier_id, invoiceNumber, rate, mrpVal, qty, qty]);
      }

      // 2. Inventory transaction
      execute(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
          quantity, unit, user_id, notes
        ) VALUES (?, ?, ?, ?, 'Purchase', 'PurchaseInvoice', ?, ?, ?, ?, ?)
      `, [`itx-${Date.now()}-${Math.random()}`, storeId, product.id, batchId, purchaseId, qty, product.unit, req.user!.id, `Purchase Invoice ${invoiceNumber} (HSN: ${itemHsn})`]);

      // 3. Update product pricing & HSN
      execute(`
        UPDATE products
        SET purchase_price = ?, selling_price = ?, mrp = ?, hsn_code = COALESCE(?, hsn_code)
        WHERE id = ?
      `, [rate, sellingPrice, mrpVal, itemHsn, product.id]);

      processedItems.push({
        productId: product.id,
        batchId,
        batchNo,
        mfgDate,
        expiryDate,
        qty,
        unit: product.unit,
        rate,
        sellingPrice,
        mrp: mrpVal,
        discount,
        discountPct,
        taxable: gstRes.taxableValue,
        cgst: gstRes.cgstAmount,
        sgst: gstRes.sgstAmount,
        igst: gstRes.igstAmount,
        total: gstRes.totalAmount,
        hsn: itemHsn
      });
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    
    // Deduct immediate credit note and cash discounts from balance payable if received
    const immediateDeduction = (creditNoteStatus === 'received' ? creditNoteAmountNum : 0) + cashDiscountNum;
    balanceDue = Math.max(0, grandTotal - immediateDeduction);

    // 4. Create Purchase Invoice header
    execute(`
      INSERT INTO purchase_invoices (
        id, invoice_number, supplier_invoice_no, store_id, supplier_id, invoice_date, status,
        taxable_value, cgst, sgst, igst, total_tax, grand_total, paid_amount, balance_due,
        cash_discount, supplier_credit_note_status, supplier_credit_note_no, supplier_credit_note_date,
        supplier_credit_note_amount, supplier_notes, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'Posted', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      purchaseId, invoiceNumber, supplier_invoice_no, storeId, supplier_id, invoice_date || new Date().toISOString().split('T')[0],
      totalTaxable, totalCgst, totalSgst, totalIgst, totalTax, grandTotal, balanceDue,
      cashDiscountNum, creditNoteStatus, creditNoteNo, creditNoteDate, creditNoteAmountNum,
      refNotes, notes || null, req.user!.username
    ]);

    // 5. Insert Purchase Items with HSN code & selling price
    for (const pi of processedItems) {
      execute(`
        INSERT INTO purchase_items (
          id, purchase_id, product_id, batch_id, batch_number, mfg_date, expiry_date,
          quantity, unit, purchase_rate, selling_price, mrp, discount, discount_pct, hsn_code,
          taxable_value, cgst, sgst, igst, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `pit-${Date.now()}-${Math.random()}`, purchaseId, pi.productId, pi.batchId, pi.batchNo, pi.mfgDate, pi.expiryDate,
        pi.qty, pi.unit, pi.rate, pi.sellingPrice, pi.mrp, pi.discount, pi.discountPct, pi.hsn,
        pi.taxable, pi.cgst, pi.sgst, pi.igst, pi.total
      ]);

      // GST Input Transaction
      execute(`
        INSERT INTO gst_transactions (
          id, store_id, transaction_type, reference_no, transaction_date, entity_name, gstin, state,
          is_interstate, hsn_code, taxable_value, cgst, sgst, igst, total_gst
        ) VALUES (?, ?, 'Input', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `gst-${Date.now()}-${Math.random()}`, storeId, invoiceNumber, invoice_date || new Date().toISOString().split('T')[0], supplier.company_name, supplier.gstin, supplier.state,
        isInterstate ? 1 : 0, pi.hsn, pi.taxable, pi.cgst, pi.sgst, pi.igst, pi.cgst + pi.sgst + pi.igst
      ]);
    }

    // 6. Update Supplier Ledger & Outstanding
    const netSupplierAddition = grandTotal - immediateDeduction;
    const newSupplierOutstanding = (supplier.current_outstanding || 0) + netSupplierAddition;
    execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newSupplierOutstanding, supplier_id]);

    execute(`
      INSERT INTO supplier_transactions (
        id, supplier_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [
      `stx-${Date.now()}`, supplier_id, storeId, invoice_date || new Date().toISOString().split('T')[0], invoiceNumber,
      `Purchase Invoice ${supplier_invoice_no}${immediateDeduction > 0 ? ` (Less Discount/CN: ₹${immediateDeduction})` : ''}`,
      netSupplierAddition, newSupplierOutstanding, req.user!.username
    ]);

    if (creditNoteStatus === 'received' && creditNoteAmountNum > 0) {
      execute(`
        INSERT INTO supplier_transactions (
          id, supplier_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        `stx-cn-${Date.now()}`, supplier_id, storeId, creditNoteDate || invoice_date || new Date().toISOString().split('T')[0],
        creditNoteNo || `CN-${invoiceNumber}`, `Supplier Credit Note for ${supplier_invoice_no}`,
        creditNoteAmountNum, newSupplierOutstanding, req.user!.username
      ]);
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'CREATE_PURCHASE_INVOICE', 'PurchaseInvoice', purchaseId, null, { invoiceNumber, grandTotal, itemsCount: items.length });
  res.status(201).json({ message: 'Purchase invoice recorded with HSN codes, multiple products & inventory updated.', invoiceNumber, purchaseId, grandTotal, balanceDue });
};

router.post('/', createPurchaseInvoice);
router.post('/invoices', createPurchaseInvoice);

// Update Supplier Credit Note details for an existing invoice (when received later)
router.patch('/invoices/:id/credit-note', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { supplier_credit_note_status, supplier_credit_note_no, supplier_credit_note_date, supplier_credit_note_amount, supplier_notes } = req.body;

  const invoice = queryOne("SELECT * FROM purchase_invoices WHERE id = ?", [id]);
  if (!invoice) return res.status(404).json({ error: 'Purchase invoice not found.' });

  const creditAmt = Number(supplier_credit_note_amount) || 0;

  transaction(() => {
    execute(`
      UPDATE purchase_invoices
      SET supplier_credit_note_status = ?,
          supplier_credit_note_no = ?,
          supplier_credit_note_date = ?,
          supplier_credit_note_amount = ?,
          supplier_notes = COALESCE(?, supplier_notes),
          balance_due = MAX(0, balance_due - ?)
      WHERE id = ?
    `, [
      supplier_credit_note_status || 'received',
      supplier_credit_note_no || null,
      supplier_credit_note_date || new Date().toISOString().split('T')[0],
      creditAmt,
      supplier_notes || null,
      supplier_credit_note_status === 'received' ? creditAmt : 0,
      id
    ]);

    if (supplier_credit_note_status === 'received' && creditAmt > 0) {
      const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [invoice.supplier_id]);
      if (supplier) {
        const newBalance = Math.max(0, supplier.current_outstanding - creditAmt);
        execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newBalance, supplier.id]);

        execute(`
          INSERT INTO supplier_transactions (
            id, supplier_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `, [
          `stx-cn-${Date.now()}`, supplier.id, invoice.store_id,
          supplier_credit_note_date || new Date().toISOString().split('T')[0],
          supplier_credit_note_no || `CN-${invoice.invoice_number}`,
          `Credit Note applied to ${invoice.supplier_invoice_no} (${supplier_notes || 'Supplier discount note'})`,
          creditAmt, newBalance, req.user!.username
        ]);
      }
    }
  });

  res.json({ message: 'Supplier credit note and reference notes updated successfully.' });
});

// ==========================================
// PURCHASE ORDERS (PO)
// ==========================================

// Get all purchase orders
router.get('/orders', (req: AuthRequest, res: Response) => {
  const { store_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  const orders = queryAll(`
    SELECT po.*, s.company_name as supplier_name, s.company_name, s.mobile as supplier_mobile, s.gstin as supplier_gstin,
           s.email as supplier_email, s.address as supplier_address, s.city as supplier_city, s.pin as supplier_pin,
           (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as items_count
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.store_id = ?
    ORDER BY po.po_date DESC, po.created_at DESC
  `, [storeId]);

  res.json({ orders });
});

// Get single purchase order with items
router.get('/orders/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const order = queryOne(`
    SELECT po.*, s.company_name as supplier_name, s.company_name, s.mobile as supplier_mobile, s.gstin as supplier_gstin,
           s.state as supplier_state, s.email as supplier_email, s.address as supplier_address, s.city as supplier_city, s.pin as supplier_pin,
           st.name as store_name
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN stores st ON po.store_id = st.id
    WHERE po.id = ?
  `, [id]);

  if (!order) return res.status(404).json({ error: 'Purchase order not found.' });

  const items = queryAll(`
    SELECT poi.*, p.name as product_name, p.code as product_code, p.unit as default_unit,
           COALESCE(poi.hsn_code, p.hsn_code, '1209') as hsn_code
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.po_id = ?
  `, [id]);

  res.json({ order, items });
});

// Create new purchase order
router.post('/orders', (req: AuthRequest, res: Response) => {
  const {
    supplier_id, po_date, expected_delivery, items, notes, payment_terms, status
  } = req.body;

  const storeId = req.user!.storeId || 'store-main';

  if (!supplier_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier and at least one item are required to create a Purchase Order.' });
  }

  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [supplier_id]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

  const poId = `po-${Date.now()}`;
  const countRow = queryOne("SELECT COUNT(*) as count FROM purchase_orders");
  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

  let subtotal = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const processedItems = items.map((it: any) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate ?? it.unit_price) || 0;
    const disc = Number(it.discount) || 0;
    const lineSubtotal = Math.max(0, (qty * rate) - disc);
    const taxRate = Number(it.tax_rate ?? 18);
    const taxAmt = (lineSubtotal * taxRate) / 100;
    const lineTotal = lineSubtotal + taxAmt;

    subtotal += lineSubtotal;
    totalTax += taxAmt;
    grandTotal += lineTotal;

    return {
      productId: it.product_id,
      quantity: qty,
      unit: it.unit || 'Kg',
      rate,
      discount: disc,
      taxRate,
      taxAmount: taxAmt,
      taxableAmount: lineSubtotal,
      total: lineTotal,
      hsnCode: it.hsn_code || '1209'
    };
  });

  transaction(() => {
    execute(`
      INSERT INTO purchase_orders (
        id, po_number, store_id, supplier_id, po_date, expected_delivery, status,
        subtotal, tax_amount, total_amount, payment_terms, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      poId, poNumber, storeId, supplier_id,
      po_date || new Date().toISOString().split('T')[0],
      expected_delivery || null,
      status || 'Ordered',
      subtotal, totalTax, grandTotal,
      payment_terms || 'Net 30',
      notes || null,
      req.user!.username
    ]);

    for (const item of processedItems) {
      execute(`
        INSERT INTO purchase_order_items (
          id, po_id, product_id, quantity, unit, rate, discount, tax_rate, taxable_amount, tax_amount, total, hsn_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `poi-${Date.now()}-${Math.random()}`, poId, item.productId, item.quantity, item.unit,
        item.rate, item.discount, item.taxRate, item.taxableAmount, item.taxAmount, item.total, item.hsnCode
      ]);
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'CREATE_PURCHASE_ORDER', 'PurchaseOrder', poId, null, { poNumber, grandTotal, itemsCount: items.length });
  res.status(201).json({ message: 'Purchase Order created successfully.', poId, poNumber, totalAmount: grandTotal });
});

// Update Purchase Order Status
router.patch('/orders/:id/status', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const po = queryOne("SELECT * FROM purchase_orders WHERE id = ?", [id]);
  if (!po) return res.status(404).json({ error: 'Purchase order not found.' });

    execute("UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ?", [status, notes || null, id]);
    res.json({ message: `Purchase order status updated to ${status}.` });
  });
  
  // Delete Purchase Order
  router.delete('/orders/:id', (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const po = queryOne("SELECT * FROM purchase_orders WHERE id = ?", [id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found.' });

    transaction(() => {
      execute("DELETE FROM purchase_order_items WHERE po_id = ?", [id]);
      execute("DELETE FROM purchase_orders WHERE id = ?", [id]);
    });

    logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_PURCHASE_ORDER', 'PurchaseOrder', id, po, null);
    res.json({ message: `Purchase Order #${po.po_number} and all its line items have been deleted.` });
  });

// ==========================================
// PURCHASE RETURNS / DEBIT NOTES
// ==========================================

// Get all purchase returns
router.get('/returns', (req: AuthRequest, res: Response) => {
  const { store_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  const returns = queryAll(`
    SELECT pr.*, s.company_name as supplier_name, s.company_name, s.mobile as supplier_mobile, s.gstin as supplier_gstin,
           pi.invoice_number as purchase_invoice_number, pi.supplier_invoice_no
    FROM purchase_returns pr
    JOIN suppliers s ON pr.supplier_id = s.id
    LEFT JOIN purchase_invoices pi ON pr.purchase_id = pi.id
    WHERE pr.store_id = ?
    ORDER BY pr.return_date DESC, pr.created_at DESC
  `, [storeId]);

  res.json({ returns });
});

// Create Purchase Return / Debit Note
router.post('/returns', (req: AuthRequest, res: Response) => {
  const {
    supplier_id, purchase_id, return_date, reason, items
  } = req.body;

  const storeId = req.user!.storeId || 'store-main';

  if (!supplier_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier and at least one return item are required.' });
  }

  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [supplier_id]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

  const returnId = `pr-${Date.now()}`;
  const countRow = queryOne("SELECT COUNT(*) as count FROM purchase_returns");
  const year = new Date().getFullYear();
  const returnNumber = `DN-${year}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

  let totalTaxable = 0;
  let totalTax = 0;
  let grandTotal = 0;

  transaction(() => {
    const processedItems = items.map((it: any) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const taxable = qty * rate;
      const tax = taxable * 0.18;
      const total = taxable + tax;

      totalTaxable += taxable;
      totalTax += tax;
      grandTotal += total;

      // Adjust inventory / batch downwards
      if (it.batch_id) {
        execute("UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ?", [qty, it.batch_id]);
      }
      if (it.product_id) {
        execute("UPDATE products SET current_stock = MAX(0, current_stock - ?) WHERE id = ?", [qty, it.product_id]);
      }

      return {
        productId: it.product_id,
        batchId: it.batch_id || null,
        qty,
        unit: it.unit || 'Kg',
        rate,
        total,
        taxable,
        cgst: tax / 2,
        sgst: tax / 2
      };
    });

    execute(`
      INSERT INTO purchase_returns (
        id, return_number, purchase_id, supplier_id, store_id, return_date, reason,
        taxable_value, total_tax, grand_total, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Posted', ?)
    `, [
      returnId, returnNumber, purchase_id || 'manual', supplier_id, storeId,
      return_date || new Date().toISOString().split('T')[0],
      reason || 'Damaged / Return to Vendor',
      totalTaxable, totalTax, grandTotal, req.user!.username
    ]);

    for (const pi of processedItems) {
      execute(`
        INSERT INTO purchase_return_items (
          id, return_id, product_id, batch_id, quantity, unit, rate, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `pri-${Date.now()}-${Math.random()}`, returnId, pi.productId, pi.batchId, pi.qty, pi.unit, pi.rate, pi.total
      ]);
    }

    // Debit the supplier ledger
    const newOutstanding = Math.max(0, (supplier.current_outstanding || 0) - grandTotal);
    execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newOutstanding, supplier_id]);

    execute(`
      INSERT INTO supplier_transactions (
        id, supplier_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      `stx-dn-${Date.now()}`, supplier_id, storeId, return_date || new Date().toISOString().split('T')[0],
      returnNumber, `Purchase Return / Debit Note: ${reason || 'Return to vendor'}`,
      grandTotal, newOutstanding, req.user!.username
    ]);
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'CREATE_PURCHASE_RETURN', 'PurchaseReturn', returnId, null, { returnNumber, grandTotal });
  res.status(201).json({ message: 'Purchase return recorded & supplier account debited.', returnNumber, returnId, grandTotal });
});

// Delete Purchase Return / Debit Note
router.delete('/returns/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ret = queryOne("SELECT * FROM purchase_returns WHERE id = ?", [id]);
  if (!ret) return res.status(404).json({ error: 'Purchase return record not found.' });

  transaction(() => {
    // 1. Restore product batches / inventory
    const items = queryAll("SELECT * FROM purchase_return_items WHERE return_id = ?", [id]);
    for (const item of items) {
      if (item.batch_id) {
        execute("UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?", [item.quantity, item.batch_id]);
      }
    }

    // 2. Revert supplier balance debit
    if (ret.supplier_id && ret.grand_total > 0) {
      const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [ret.supplier_id]);
      if (supplier) {
        const newBal = (supplier.current_outstanding || 0) + ret.grand_total;
        execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newBal, supplier.id]);
      }
    }

    // 3. Delete ledger transactions & return items
    execute("DELETE FROM supplier_transactions WHERE reference_no = ?", [ret.return_number]);
    execute("DELETE FROM purchase_return_items WHERE return_id = ?", [id]);
    execute("DELETE FROM purchase_returns WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_PURCHASE_RETURN', 'PurchaseReturn', id, ret, null);
  res.json({ message: `Purchase Return #${ret.return_number} removed, supplier balance restored, and batch quantities updated.` });
});

// Delete Purchase Invoice with full inventory and ledger cleanup
const deletePurchaseInvoiceHandler = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const invoice = queryOne("SELECT * FROM purchase_invoices WHERE id = ?", [id]);
  if (!invoice) return res.status(404).json({ error: 'Purchase invoice not found.' });

  transaction(() => {
    // 1. Deduct stock that was added by this purchase invoice
    const items = queryAll("SELECT * FROM purchase_items WHERE purchase_id = ?", [id]);
    for (const item of items) {
      if (item.batch_id) {
        execute("UPDATE product_batches SET current_qty = MAX(0, current_qty - ?) WHERE id = ?", [item.quantity, item.batch_id]);
      }
    }

    // 2. Revert supplier outstanding balance
    if (invoice.balance_due > 0 && invoice.supplier_id) {
      const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [invoice.supplier_id]);
      if (supplier) {
        const newBal = Math.max(0, supplier.current_outstanding - invoice.balance_due);
        execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newBal, supplier.id]);
      }
    }

    // 3. Delete supplier ledger transaction, payment receipts, and movement records
    execute("DELETE FROM supplier_transactions WHERE reference_no = ?", [invoice.invoice_number]);
    execute("DELETE FROM payments WHERE entity_type = 'Supplier' AND reference_number = ?", [invoice.invoice_number]);
    execute("DELETE FROM inventory_transactions WHERE reference_id = ?", [id]);

    // 4. Delete purchase items & invoice
    execute("DELETE FROM purchase_items WHERE purchase_id = ?", [id]);
    execute("DELETE FROM purchase_invoices WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_PURCHASE_INVOICE', 'PurchaseInvoice', id, invoice, null);
  res.json({ message: `Purchase Invoice #${invoice.invoice_number} deleted, stock deducted, and supplier ledger adjusted.` });
};

router.delete('/invoices/:id', requirePermission('purchases:manage'), deletePurchaseInvoiceHandler);
router.delete('/:id', requirePermission('purchases:manage'), deletePurchaseInvoiceHandler);

// Fallback for getting single purchase invoice by ID
router.get('/:id', getSinglePurchaseInvoice);

export default router;

