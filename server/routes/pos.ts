import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';
import { calculateGst } from '../utils/gst';

const router = Router();
router.use(authMiddleware);

// Fast Barcode Search & FEFO Batch lookup
router.get('/products', (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';
  const { search, category_id } = req.query;
  const todayStr = new Date().toISOString().split('T')[0];

  let sql = `
    SELECT p.*, c.name as category_name, b.name as brand_name,
           COALESCE((SELECT SUM(current_qty) FROM product_batches WHERE product_id = p.id AND store_id = ? AND current_qty > 0 AND expiry_date >= ?), 0) as stock_qty
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = 1
  `;
  const params: any[] = [storeId, todayStr];

  if (category_id) {
    sql += ` AND (p.category_id = ? OR c.parent_id = ?)`;
    params.push(category_id, category_id);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.sku LIKE ? OR p.crop LIKE ? OR p.composition LIKE ? OR c.name LIKE ? OR b.name LIKE ?)`;
    params.push(s, s, s, s, s, s, s);
  }

  sql += ` ORDER BY p.name ASC`;
  const products = queryAll(sql, params);

  const result = products.map((p: any) => {
    const activeBatches = queryAll(`
      SELECT * FROM product_batches
      WHERE product_id = ? AND store_id = ? AND current_qty > 0 AND expiry_date >= ?
      ORDER BY expiry_date ASC
    `, [p.id, storeId, todayStr]);

    return {
      ...p,
      activeBatches,
      selectedBatch: activeBatches[0] || null
    };
  });

  res.json({ products: result });
});

router.get('/barcode/:barcode', (req: AuthRequest, res: Response) => {
  const { barcode } = req.params;
  const storeId = req.user!.storeId || 'store-main';

  // Find barcode
  const bcRecord = queryOne("SELECT product_id FROM product_barcodes WHERE barcode = ?", [barcode]);
  let productId = bcRecord ? bcRecord.product_id : null;

  if (!productId) {
    // Try SKU or Code
    const prodBySku = queryOne("SELECT id FROM products WHERE sku = ? OR code = ?", [barcode, barcode]);
    if (prodBySku) productId = prodBySku.id;
  }

  if (!productId) {
    return res.status(404).json({ error: `No product found matching barcode or SKU '${barcode}'.` });
  }

  const product = queryOne(`
    SELECT p.*, c.name as category_name, b.name as brand_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.id = ?
  `, [productId]);

  // FEFO Batch selection (First Expiry First Out) - excluding expired batches!
  const todayStr = new Date().toISOString().split('T')[0];
  const activeBatches = queryAll(`
    SELECT * FROM product_batches
    WHERE product_id = ? AND store_id = ? AND current_qty > 0 AND expiry_date >= ?
    ORDER BY expiry_date ASC
  `, [productId, storeId, todayStr]);

  if (activeBatches.length === 0) {
    return res.status(400).json({
      error: `Product '${product.name}' is out of stock or all available batches have EXPIRED.`,
      product
    });
  }

  const bestBatch = activeBatches[0];

  res.json({
    product,
    selectedBatch: bestBatch,
    availableBatches: activeBatches,
    stockQty: activeBatches.reduce((acc: number, b: any) => acc + b.current_qty, 0)
  });
});

// POS Hold Bill
router.post('/hold', (req: AuthRequest, res: Response) => {
  const { customer_id, customer_name, items, notes } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot hold an empty bill.' });
  }

  const id = `held-${Date.now()}`;
  execute(`
    INSERT INTO held_bills (id, store_id, customer_id, customer_name, items_json, notes, held_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, storeId, customer_id || null, customer_name || 'Walk-in Customer', JSON.stringify(items), notes || null, req.user!.username]);

  res.json({ message: 'Bill held successfully.', heldBillId: id });
});

// Get Held Bills
router.get('/held', (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';
  const bills = queryAll("SELECT * FROM held_bills WHERE store_id = ? ORDER BY created_at DESC", [storeId]);
  res.json({ heldBills: bills.map(b => ({ ...b, items: JSON.parse(b.items_json) })) });
});

// Delete Held Bill
router.delete('/held/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  execute("DELETE FROM held_bills WHERE id = ?", [id]);
  res.json({ message: 'Held bill resumed/removed.' });
});

// --- ATOMIC SALES / POS CHECKOUT ---
router.post('/sales', requirePermission('pos:access'), (req: AuthRequest, res: Response) => {
  const {
    customer_id, customer_name, customer_mobile, customer_gstin, items,
    payment_mode, amount_received, is_credit_sale, notes, discount_override,
    credit_note_id, credit_note_amount, due_date, payment_promise_date
  } = req.body;

  const storeId = req.user!.storeId || 'store-main';

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one product item is required for sales billing.' });
  }

  const store = queryOne("SELECT * FROM stores WHERE id = ?", [storeId]);
  const company = queryOne("SELECT * FROM company_settings WHERE id = 1");

  // Customer validation
  let custObj: any = null;
  if (customer_id) {
    custObj = queryOne("SELECT * FROM customers WHERE id = ?", [customer_id]);
  }

  const buyerState = custObj ? (custObj.state || 'Karnataka') : 'Karnataka';
  const isInterstate = (store?.state || 'Karnataka').trim().toLowerCase() !== buyerState.trim().toLowerCase();

  const count = queryOne("SELECT COUNT(*) as c FROM sales_invoices")?.c || 0;
  const prefix = company?.invoice_prefix || 'INV-2627-';
  const invoiceNumber = `${prefix}${(1001 + count).toString()}`;
  const salesId = `sale-${Date.now()}`;
  const todayStr = new Date().toISOString().split('T')[0];

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalDiscount = 0;
  let grandTotal = 0;
  let appliedCreditNoteVal = 0;
  let creditNoteObj: any = null;
  let balanceDueResult = 0;

  transaction(() => {
    const processedItems: any[] = [];

    // Step 1: Validate stock, batch expiry, calculate line items
    for (const item of items) {
      const product = queryOne("SELECT * FROM products WHERE id = ?", [item.product_id]);
      if (!product || !product.is_active) {
        throw new Error(`Product '${item.product_name || item.product_id}' is unavailable or inactive.`);
      }

      const reqQty = Number(item.quantity);
      if (reqQty <= 0) throw new Error(`Invalid quantity for ${product.name}.`);

      // Find FEFO batch
      let batch: any = null;
      if (item.batch_id) {
        batch = queryOne("SELECT * FROM product_batches WHERE id = ?", [item.batch_id]);
      } else {
        // FEFO auto-selection
        batch = queryOne(`
          SELECT * FROM product_batches
          WHERE product_id = ? AND store_id = ? AND current_qty >= ? AND expiry_date >= ?
          ORDER BY expiry_date ASC
        `, [product.id, storeId, reqQty, todayStr]);
      }

      if (!batch) {
        throw new Error(`Insufficient non-expired stock for product '${product.name}'. Required: ${reqQty}`);
      }

      if (batch.current_qty < reqQty) {
        throw new Error(`Insufficient stock in Batch ${batch.batch_number} for '${product.name}'. Available: ${batch.current_qty}, Requested: ${reqQty}`);
      }

      if (batch.expiry_date < todayStr) {
        throw new Error(`Batch ${batch.batch_number} for product '${product.name}' has EXPIRED on ${batch.expiry_date}. Cannot sell expired items.`);
      }

      const unitRate = Number(item.rate) || product.selling_price;
      const lineDisc = Number(item.discount) || 0;
      const lineTaxable = Math.max(0, Number(((reqQty * unitRate) - lineDisc).toFixed(2)));

      const gstRes = calculateGst({
        taxableValue: lineTaxable,
        gstRate: product.gst_rate,
        isInterstate
      });

      totalTaxable += gstRes.taxableValue;
      totalCgst += gstRes.cgstAmount;
      totalSgst += gstRes.sgstAmount;
      totalIgst += gstRes.igstAmount;
      totalDiscount += lineDisc;
      grandTotal += gstRes.totalAmount;

      processedItems.push({
        product,
        batch,
        reqQty,
        unitRate,
        lineDisc,
        gstRes,
        costPrice: batch.purchase_price
      });
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    grandTotal = Number(grandTotal.toFixed(2));

    // Step 2: Validate Credit Note redemption if provided
    if (credit_note_id) {
      if (!custObj) throw new Error("A registered customer is required when using a Credit Note.");
      creditNoteObj = queryOne("SELECT * FROM sales_returns WHERE id = ? AND customer_id = ?", [credit_note_id, custObj.id]);
      if (!creditNoteObj) throw new Error("Selected Credit Note was not found for this customer.");

      const cnStatus = creditNoteObj.credit_note_status || 'Active';
      const cnTotal = creditNoteObj.grand_total || 0;
      const cnUsed = creditNoteObj.used_amount || 0;
      const cnAvail = Math.max(0, cnTotal - cnUsed);

      if (cnStatus === 'Used' || cnAvail <= 0) {
        throw new Error(`Credit Note '${creditNoteObj.credit_note_number || creditNoteObj.return_number}' has already been fully redeemed.`);
      }

      appliedCreditNoteVal = Math.min(grandTotal, Math.min(cnAvail, Number(credit_note_amount) || cnAvail));
      appliedCreditNoteVal = Number(appliedCreditNoteVal.toFixed(2));
    }

    const balanceAfterCN = Math.max(0, Number((grandTotal - appliedCreditNoteVal).toFixed(2)));

    // Step 3: Validate Cash/UPI Payment & Remaining Balance / Udhaar
    const receivedAmt = (amount_received !== undefined && amount_received !== null && amount_received !== '') 
      ? Math.min(balanceAfterCN, Math.max(0, Number(amount_received)))
      : (is_credit_sale ? 0 : balanceAfterCN);
    const balanceDue = Number((balanceAfterCN - receivedAmt).toFixed(2));
    balanceDueResult = balanceDue;
    let isCredit = (is_credit_sale || balanceDue > 0) ? 1 : 0;

    if (balanceDue > 0) {
      if (!custObj) throw new Error("A valid registered customer is required when there is a remaining unpaid balance (Credit / Udhaar Sale).");
      const futureOutstanding = custObj.current_outstanding + balanceDue;
      if (futureOutstanding > custObj.credit_limit) {
        throw new Error(`Credit Limit Exceeded for customer '${custObj.name}'. Limit: ₹${custObj.credit_limit}, Current Outstanding: ₹${custObj.current_outstanding}, New Balance Due: ₹${balanceDue}`);
      }
    }

    const dueDateVal = (due_date || payment_promise_date || null);

    // Step 4: Insert Sales Invoice Header
    execute(`
      INSERT INTO sales_invoices (
        id, invoice_number, store_id, customer_id, customer_name, customer_gstin, customer_mobile,
        invoice_date, invoice_type, status, payment_status, taxable_value, cgst, sgst, igst, total_tax,
        total_discount, grand_total, amount_received, balance_due, payment_mode, credit_note_id, credit_note_amount, notes, due_date, is_credit_sale, created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 'Completed', ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      salesId, invoiceNumber, storeId, custObj ? custObj.id : null,
      custObj ? custObj.name : (customer_name || 'Walk-in Customer'),
      custObj ? custObj.gstin : (customer_gstin || null),
      custObj ? custObj.mobile : (customer_mobile || null),
      todayStr, custObj && custObj.gstin ? 'B2B' : 'B2C',
      balanceDue <= 0 ? 'Paid' : (receivedAmt > 0 || appliedCreditNoteVal > 0 ? 'Partial' : 'Unpaid'),
      totalTaxable, totalCgst, totalSgst, totalIgst, totalTax,
      totalDiscount, grandTotal, receivedAmt, balanceDue,
      payment_mode || 'Cash', creditNoteObj ? creditNoteObj.id : null, appliedCreditNoteVal, notes || null, dueDateVal, isCredit, req.user!.username
    ]);

    // Step 5: Mark Credit Note as Used or Partially Used
    if (creditNoteObj && appliedCreditNoteVal > 0) {
      const newUsedAmt = Number(((creditNoteObj.used_amount || 0) + appliedCreditNoteVal).toFixed(2));
      const isFullyUsed = newUsedAmt >= creditNoteObj.grand_total;
      const newCnStatus = isFullyUsed ? 'Used' : 'Partially Used';

      execute(`
        UPDATE sales_returns
        SET used_amount = ?, credit_note_status = ?, redeemed_in_sales_id = ?, redeemed_at = DATE('now')
        WHERE id = ?
      `, [newUsedAmt, newCnStatus, salesId, creditNoteObj.id]);
    }

    // Step 6: Reduce Batch Stock & Insert Items & Log Movements
    for (const pi of processedItems) {
      execute("UPDATE product_batches SET current_qty = current_qty - ? WHERE id = ?", [pi.reqQty, pi.batch.id]);

      execute(`
        INSERT INTO sales_items (
          id, sales_id, product_id, batch_id, product_name, hsn_code, quantity, unit, rate, discount,
          taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amount, cost_price
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `, [
        `sitem-${Date.now()}-${Math.random()}`, salesId, pi.product.id, pi.batch.id, pi.product.name, pi.product.hsn_code,
        pi.reqQty, pi.product.unit, pi.unitRate, pi.lineDisc, pi.gstRes.taxableValue,
        pi.gstRes.cgstRate, pi.gstRes.cgstAmount, pi.gstRes.sgstRate, pi.gstRes.sgstAmount,
        pi.gstRes.igstRate, pi.gstRes.igstAmount, pi.gstRes.totalAmount, pi.costPrice
      ]);

      execute(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
          quantity, unit, previous_qty, new_qty, user_id, notes
        ) VALUES (?, ?, ?, ?, 'Sale', 'SalesInvoice', ?, ?, ?, ?, ?, ?, ?)
      `, [
        `itx-${Date.now()}-${Math.random()}`, storeId, pi.product.id, pi.batch.id, salesId,
        pi.reqQty, pi.product.unit, pi.batch.current_qty, pi.batch.current_qty - pi.reqQty,
        req.user!.id, `Sale Invoice ${invoiceNumber}`
      ]);

      execute(`
        INSERT INTO gst_transactions (
          id, store_id, transaction_type, reference_no, transaction_date, entity_name, gstin, state,
          is_interstate, hsn_code, taxable_value, cgst, sgst, igst, total_gst
        ) VALUES (?, ?, 'Output', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `gst-${Date.now()}-${Math.random()}`, storeId, invoiceNumber, todayStr,
        custObj ? custObj.name : 'Walk-in Customer', custObj ? custObj.gstin : null, buyerState,
        isInterstate ? 1 : 0, pi.product.hsn_code, pi.gstRes.taxableValue,
        pi.gstRes.cgstAmount, pi.gstRes.sgstAmount, pi.gstRes.igstAmount, pi.gstRes.totalTax
      ]);
    }

    // Step 7: Update Customer Ledger if tracked or credit
    if (custObj) {
      const newOutstanding = Number((custObj.current_outstanding + balanceDue).toFixed(2));
      execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [newOutstanding, custObj.id]);

      const descParts = [`Sales Invoice ${invoiceNumber}`];
      if (appliedCreditNoteVal > 0) descParts.push(`CN Redeemed: ₹${appliedCreditNoteVal}`);
      if (receivedAmt > 0) descParts.push(`Paid (${payment_mode || 'Cash'}): ₹${receivedAmt}`);
      if (balanceDue > 0) descParts.push(`Udhaar Balance: ₹${balanceDue}`);
      if (dueDateVal && balanceDue > 0) descParts.push(`Promise Date: ${dueDateVal}`);

      execute(`
        INSERT INTO customer_transactions (
          id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `ctx-${Date.now()}`, custObj.id, storeId, todayStr, invoiceNumber,
        descParts.join(' | '), grandTotal, appliedCreditNoteVal + receivedAmt, newOutstanding, req.user!.username
      ]);

      if (creditNoteObj && appliedCreditNoteVal > 0) {
        execute(`
          INSERT INTO customer_transactions (
            id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `ctx-cn-${Date.now()}`, custObj.id, storeId, todayStr, creditNoteObj.credit_note_number || creditNoteObj.return_number,
          `Redeemed Credit Note ${creditNoteObj.credit_note_number || creditNoteObj.return_number} against Invoice ${invoiceNumber}`, 0, 0, newOutstanding, req.user!.username
        ]);
      }
    }

    // Step 8: Payment Transaction Record
    if (receivedAmt > 0) {
      execute(`
        INSERT INTO payments (
          id, payment_number, store_id, entity_type, entity_id, payment_date, amount, payment_mode, reference_number, remarks, created_by
        ) VALUES (?, ?, ?, 'Customer', ?, ?, ?, ?, ?, ?, ?)
      `, [
        `pay-${Date.now()}`, `PAY-${Date.now()}`, storeId, custObj ? custObj.id : 'WALK-IN',
        todayStr, receivedAmt, payment_mode || 'Cash', invoiceNumber, `Payment for invoice ${invoiceNumber}`, req.user!.username
      ]);

      if ((payment_mode || 'Cash').toLowerCase() === 'cash') {
        execute(`
          UPDATE cash_registers
          SET cash_sales = cash_sales + ?, expected_closing_cash = expected_closing_cash + ?
          WHERE store_id = ? AND status = 'Open'
        `, [receivedAmt, receivedAmt, storeId]);
      }
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'POS_SALE_COMPLETED', 'SalesInvoice', salesId, null, { invoiceNumber, grandTotal });

  res.status(201).json({
    message: 'Sale completed successfully.',
    invoiceNumber,
    salesId,
    grandTotal,
    creditNoteAmount: appliedCreditNoteVal,
    creditNoteNumber: creditNoteObj ? (creditNoteObj.credit_note_number || creditNoteObj.return_number) : null,
    amountReceived: (amount_received !== undefined && amount_received !== null) ? Number(amount_received) : 0,
    balanceDue: balanceDueResult,
    taxableValue: totalTaxable,
    totalTax: totalCgst + totalSgst + totalIgst,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst
  });
});

export default router;
