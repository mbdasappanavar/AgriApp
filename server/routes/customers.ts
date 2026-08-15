import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// --- CUSTOMERS ---

// List customers
router.get('/customers', (req: AuthRequest, res: Response) => {
  const { search } = req.query;
  let sql = "SELECT * FROM customers WHERE 1=1";
  const params: any[] = [];

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    sql += " AND (name LIKE ? OR mobile LIKE ? OR village LIKE ? OR customer_code LIKE ?)";
    params.push(s, s, s, s);
  }

  sql += " ORDER BY name ASC";
  const customers = queryAll(sql, params);
  res.json({ customers });
});

// Get single customer with ledger, credit notes & outstanding bills
router.get('/customers/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const customer = queryOne("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const ledger = queryAll("SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY transaction_date DESC, created_at DESC", [id]);
  const unpaidInvoices = queryAll(`
    SELECT * FROM sales_invoices
    WHERE customer_id = ? AND balance_due > 0 AND status != 'Cancelled'
    ORDER BY invoice_date ASC
  `, [id]);

  const creditNotes = queryAll(`
    SELECT sr.*,
           si.invoice_number as original_invoice_number,
           rsi.invoice_number as redeemed_invoice_number,
           rsi.invoice_date as redeemed_invoice_date
    FROM sales_returns sr
    LEFT JOIN sales_invoices si ON sr.sales_id = si.id
    LEFT JOIN sales_invoices rsi ON sr.redeemed_in_sales_id = rsi.id
    WHERE sr.customer_id = ? AND (sr.return_type = 'Credit Note' OR sr.credit_note_number IS NOT NULL)
    ORDER BY sr.created_at DESC
  `, [id]);

  res.json({ customer, ledger, unpaidInvoices, creditNotes });
});

// Get customer's active credit notes for checkout selection
router.get('/customers/:id/credit-notes', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const creditNotes = queryAll(`
    SELECT sr.*,
           si.invoice_number as original_invoice_number,
           rsi.invoice_number as redeemed_invoice_number
    FROM sales_returns sr
    LEFT JOIN sales_invoices si ON sr.sales_id = si.id
    LEFT JOIN sales_invoices rsi ON sr.redeemed_in_sales_id = rsi.id
    WHERE sr.customer_id = ? AND (sr.return_type = 'Credit Note' OR sr.credit_note_number IS NOT NULL)
    ORDER BY sr.created_at DESC
  `, [id]);

  const activeCreditNotes = creditNotes.filter((cn: any) => {
    const total = cn.grand_total || 0;
    const used = cn.used_amount || 0;
    const status = cn.credit_note_status || 'Active';
    return (status === 'Active' || status === 'Partially Used') && (total - used > 0);
  });

  res.json({ creditNotes, activeCreditNotes });
});

// Create customer
router.post('/customers', requirePermission('customers:manage'), (req: AuthRequest, res: Response) => {
  const { name, mobile, email, address, village, taluk, district, state, pin, gstin, pan, customer_type, credit_limit, farm_village, crop, land_area_acres, preferred_products } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  const count = queryOne("SELECT COUNT(*) as c FROM customers")?.c || 0;
  const customerCode = `CUST-${(1001 + count).toString()}`;
  const id = `cust-${Date.now()}`;

  execute(`
    INSERT INTO customers (
      id, customer_code, name, mobile, email, address, village, taluk, district, state, pin, gstin, pan,
      customer_type, credit_limit, current_outstanding, farm_village, crop, land_area_acres, preferred_products
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 0, ?, ?, ?, ?
    )
  `, [
    id, customerCode, name, mobile || null, email || null, address || null, village || null, taluk || 'Hubballi', district || 'Dharwad', state || 'Karnataka', pin || '580025', gstin || null, pan || null,
    customer_type || 'Retail', Number(credit_limit) || 25000, village || null, crop || null, Number(land_area_acres) || 0, preferred_products || null
  ]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CREATE_CUSTOMER', 'Customer', id, null, { name, customerCode });
  res.status(201).json({ message: 'Customer created successfully.', customerId: id, customerCode });
});

// Record customer payment
router.post('/customers/:id/payments', requirePermission('customers:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, payment_mode, reference_number, remarks } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  const customer = queryOne("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const payAmt = Number(amount);
  if (isNaN(payAmt) || payAmt <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required.' });
  }

  const paymentNumber = `RCPT-${Date.now()}`;
  const paymentId = `pay-${Date.now()}`;

  transaction(() => {
    // 1. Record payment
    execute(`
      INSERT INTO payments (id, payment_number, store_id, entity_type, entity_id, payment_date, amount, payment_mode, reference_number, remarks, created_by)
      VALUES (?, ?, ?, 'Customer', ?, DATE('now'), ?, ?, ?, ?, ?)
    `, [paymentId, paymentNumber, storeId, id, payAmt, payment_mode || 'Cash', reference_number || null, remarks || 'Customer collection', req.user!.username]);

    // 2. Update customer outstanding
    const newOutstanding = Math.max(0, customer.current_outstanding - payAmt);
    execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [newOutstanding, id]);

    // 3. Customer ledger entry
    execute(`
      INSERT INTO customer_transactions (id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by)
      VALUES (?, ?, ?, DATE('now'), ?, ?, 0, ?, ?, ?)
    `, [`ctx-${Date.now()}`, id, storeId, paymentNumber, `Payment Receipt - ${payment_mode || 'Cash'}`, payAmt, newOutstanding, req.user!.username]);

    // 4. Update cash register if cash payment
    if ((payment_mode || 'Cash').toLowerCase() === 'cash') {
      execute(`
        UPDATE cash_registers
        SET customer_cash_payments = customer_cash_payments + ?,
            expected_closing_cash = expected_closing_cash + ?
        WHERE store_id = ? AND status = 'Open'
      `, [payAmt, payAmt, storeId]);
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'CUSTOMER_PAYMENT', 'Customer', id, null, { amount: payAmt, paymentNumber });
  res.json({ message: 'Customer payment recorded successfully.', paymentNumber });
});

// Delete customer with complete cascading cleanup of ledger and transactions
const deleteCustomerHandler = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const customer = queryOne("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  transaction(() => {
    // 1. Delete customer transactions/ledger
    execute("DELETE FROM customer_transactions WHERE customer_id = ?", [id]);
    // 2. Delete payment receipts
    execute("DELETE FROM payments WHERE entity_type = 'Customer' AND entity_id = ?", [id]);
    // 3. Delete loyalty transactions
    execute("DELETE FROM customer_loyalty_transactions WHERE customer_id = ?", [id]);
    // 4. Delete held bills for this customer
    const heldBills = queryAll("SELECT id FROM held_bills WHERE customer_id = ?", [id]);
    for (const hb of heldBills) {
      execute("DELETE FROM held_bill_items WHERE held_bill_id = ?", [hb.id]);
    }
    execute("DELETE FROM held_bills WHERE customer_id = ?", [id]);
    // 5. Unlink customer from historic sales invoices to preserve audit trail
    execute("UPDATE sales_invoices SET customer_id = NULL, customer_name = ? WHERE customer_id = ?", [`${customer.name} (Archived)`, id]);
    // 6. Delete customer record
    execute("DELETE FROM customers WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_CUSTOMER', 'Customer', id, customer, null);
  res.json({ message: `Customer "${customer.name}" and all associated ledger records, payment receipts, and balance history have been deleted.` });
};

router.delete('/customers/:id', requirePermission('customers:manage'), deleteCustomerHandler);
router.delete('/:id', requirePermission('customers:manage'), deleteCustomerHandler);

// --- SUPPLIERS ---

// List suppliers
router.get('/suppliers', (req: AuthRequest, res: Response) => {
  const { search } = req.query;
  let sql = "SELECT * FROM suppliers WHERE 1=1";
  const params: any[] = [];

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    sql += " AND (company_name LIKE ? OR contact_person LIKE ? OR mobile LIKE ? OR email LIKE ? OR address LIKE ? OR city LIKE ? OR gstin LIKE ?)";
    params.push(s, s, s, s, s, s, s);
  }

  sql += " ORDER BY company_name ASC";
  const suppliers = queryAll(sql, params);
  res.json({ suppliers });
});

// Get supplier details & ledger
router.get('/suppliers/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

  const ledger = queryAll("SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY transaction_date DESC, created_at DESC", [id]);
  const unpaidInvoices = queryAll(`
    SELECT * FROM purchase_invoices
    WHERE supplier_id = ? AND balance_due > 0
    ORDER BY invoice_date ASC
  `, [id]);

  res.json({ supplier, ledger, unpaidInvoices });
});

// Create supplier
router.post('/suppliers', requirePermission('suppliers:manage'), (req: AuthRequest, res: Response) => {
  const { company_name, contact_person, mobile, email, address, city, state, pin, gstin, pan, payment_terms, credit_limit } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Supplier company name is required.' });

  const count = queryOne("SELECT COUNT(*) as c FROM suppliers")?.c || 0;
  const supplierCode = `SUP-${(1001 + count).toString()}`;
  const id = `sup-${Date.now()}`;

  execute(`
    INSERT INTO suppliers (
      id, supplier_code, company_name, contact_person, mobile, email, address, city, state, pin, gstin, pan,
      payment_terms, credit_limit, current_outstanding, opening_balance
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 0, 0
    )
  `, [
    id, supplierCode, company_name, contact_person || null, mobile || null, email || null, address || null, city || 'Hubballi', state || 'Karnataka', pin || '580025', gstin || null, pan || null,
    payment_terms || '30 Days', Number(credit_limit) || 500000
  ]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CREATE_SUPPLIER', 'Supplier', id, null, { company_name, email, address });
  res.status(201).json({ message: 'Supplier created successfully.', supplierId: id });
});

// Update supplier details
router.put('/suppliers/:id', requirePermission('suppliers:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { company_name, contact_person, mobile, email, address, city, state, pin, gstin, pan, payment_terms, credit_limit } = req.body;

  const existing = queryOne("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!existing) return res.status(404).json({ error: 'Supplier not found.' });

  if (!company_name) return res.status(400).json({ error: 'Supplier company name is required.' });

  execute(`
    UPDATE suppliers
    SET company_name = ?,
        contact_person = ?,
        mobile = ?,
        email = ?,
        address = ?,
        city = ?,
        state = ?,
        pin = ?,
        gstin = ?,
        pan = ?,
        payment_terms = ?,
        credit_limit = ?
    WHERE id = ?
  `, [
    company_name,
    contact_person || null,
    mobile || null,
    email || null,
    address || null,
    city || existing.city || 'Hubballi',
    state || existing.state || 'Karnataka',
    pin || existing.pin || '580025',
    gstin || null,
    pan || null,
    payment_terms || existing.payment_terms || '30 Days',
    credit_limit !== undefined ? Number(credit_limit) : existing.credit_limit,
    id
  ]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'UPDATE_SUPPLIER', 'Supplier', id, existing, { company_name, email, address, mobile });
  res.json({ message: 'Supplier details updated successfully.' });
});

// Record supplier payment
router.post('/suppliers/:id/payments', requirePermission('suppliers:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, payment_mode, reference_number, remarks } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

  const payAmt = Number(amount);
  if (isNaN(payAmt) || payAmt <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required.' });
  }

  const paymentNumber = `SPAY-${Date.now()}`;
  const paymentId = `spay-${Date.now()}`;

  transaction(() => {
    // 1. Record payment
    execute(`
      INSERT INTO payments (id, payment_number, store_id, entity_type, entity_id, payment_date, amount, payment_mode, reference_number, remarks, created_by)
      VALUES (?, ?, ?, 'Supplier', ?, DATE('now'), ?, ?, ?, ?, ?)
    `, [paymentId, paymentNumber, storeId, id, payAmt, payment_mode || 'Bank Transfer', reference_number || null, remarks || 'Supplier payment', req.user!.username]);

    // 2. Update supplier outstanding
    const newOutstanding = Math.max(0, supplier.current_outstanding - payAmt);
    execute("UPDATE suppliers SET current_outstanding = ? WHERE id = ?", [newOutstanding, id]);

    // 3. Supplier ledger entry
    execute(`
      INSERT INTO supplier_transactions (id, supplier_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by)
      VALUES (?, ?, ?, DATE('now'), ?, ?, ?, 0, ?, ?)
    `, [`stx-${Date.now()}`, id, storeId, paymentNumber, `Payment to Supplier - ${payment_mode || 'Bank Transfer'}`, payAmt, newOutstanding, req.user!.username]);

    // 4. Update cash register if cash
    if ((payment_mode || '').toLowerCase() === 'cash') {
      execute(`
        UPDATE cash_registers
        SET supplier_cash_payments = supplier_cash_payments + ?,
            expected_closing_cash = expected_closing_cash - ?
        WHERE store_id = ? AND status = 'Open'
      `, [payAmt, payAmt, storeId]);
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'SUPPLIER_PAYMENT', 'Supplier', id, null, { amount: payAmt, paymentNumber });
  res.json({ message: 'Supplier payment recorded successfully.', paymentNumber });
});

// Delete supplier with complete cascading cleanup
router.delete('/suppliers/:id', requirePermission('suppliers:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const supplier = queryOne("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  transaction(() => {
    // 1. Delete supplier transactions and payments
    execute("DELETE FROM supplier_transactions WHERE supplier_id = ?", [id]);
    execute("DELETE FROM payments WHERE entity_type = 'Supplier' AND entity_id = ?", [id]);

    // 2. Delete purchase orders and items
    const pos = queryAll("SELECT id FROM purchase_orders WHERE supplier_id = ?", [id]);
    for (const po of pos) {
      execute("DELETE FROM purchase_order_items WHERE po_id = ?", [po.id]);
    }
    execute("DELETE FROM purchase_orders WHERE supplier_id = ?", [id]);

    // 3. Delete purchase returns and items
    const prs = queryAll("SELECT id FROM purchase_returns WHERE supplier_id = ?", [id]);
    for (const pr of prs) {
      execute("DELETE FROM purchase_return_items WHERE return_id = ?", [pr.id]);
    }
    execute("DELETE FROM purchase_returns WHERE supplier_id = ?", [id]);

    // 4. Delete purchase invoices and items
    const pis = queryAll("SELECT id FROM purchase_invoices WHERE supplier_id = ?", [id]);
    for (const pi of pis) {
      execute("DELETE FROM purchase_items WHERE purchase_id = ?", [pi.id]);
    }
    execute("DELETE FROM purchase_invoices WHERE supplier_id = ?", [id]);

    // 5. Unlink supplier from existing batches
    execute("UPDATE product_batches SET supplier_id = NULL WHERE supplier_id = ?", [id]);

    // 6. Delete supplier
    execute("DELETE FROM suppliers WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_SUPPLIER', 'Supplier', id, supplier, null);
  res.json({ message: `Supplier "${supplier.company_name}" and all related Purchase Orders, Invoices, and Ledger transactions have been deleted.` });
});

// System Notifications & Credit Payment Promise Reminders
router.get('/notifications', (req: AuthRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId || 'store-main';
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Credit Payment Promise Invoices (Udhaar due dates)
    const creditInvoices = queryAll(`
      SELECT s.id, s.invoice_number, s.customer_id, s.customer_name, s.customer_mobile,
             s.invoice_date, s.due_date, s.grand_total, s.balance_due, s.created_at
      FROM sales_invoices s
      WHERE s.store_id = ? AND s.balance_due > 0 AND s.status != 'Cancelled' AND s.due_date IS NOT NULL AND s.due_date != ''
      ORDER BY s.due_date ASC
    `, [storeId]);

    const creditDueToday: any[] = [];
    const creditOverdue: any[] = [];
    const creditUpcoming: any[] = [];

    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split('T')[0];

    for (const inv of creditInvoices) {
      if (inv.due_date === todayStr) {
        creditDueToday.push({
          id: `notif-today-${inv.id}`,
          type: 'credit_due_today',
          severity: 'warning',
          title: 'Udhaar Payment Due TODAY',
          message: `${inv.customer_name} promised payment of ₹${inv.balance_due.toLocaleString()} today for Invoice #${inv.invoice_number}`,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          customer_mobile: inv.customer_mobile,
          invoice_number: inv.invoice_number,
          invoice_id: inv.id,
          balance_due: inv.balance_due,
          due_date: inv.due_date,
          created_at: inv.created_at
        });
      } else if (inv.due_date < todayStr) {
        creditOverdue.push({
          id: `notif-overdue-${inv.id}`,
          type: 'credit_overdue',
          severity: 'error',
          title: 'Udhaar Payment OVERDUE',
          message: `OVERDUE Udhaar from ${inv.customer_name}: ₹${inv.balance_due.toLocaleString()} (Promised on ${inv.due_date}) for Invoice #${inv.invoice_number}`,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          customer_mobile: inv.customer_mobile,
          invoice_number: inv.invoice_number,
          invoice_id: inv.id,
          balance_due: inv.balance_due,
          due_date: inv.due_date,
          created_at: inv.created_at
        });
      } else if (inv.due_date > todayStr && inv.due_date <= in3DaysStr) {
        creditUpcoming.push({
          id: `notif-upcoming-${inv.id}`,
          type: 'credit_upcoming',
          severity: 'info',
          title: 'Upcoming Udhaar Payment',
          message: `${inv.customer_name} payment promise on ${inv.due_date}: ₹${inv.balance_due.toLocaleString()} (Invoice #${inv.invoice_number})`,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          customer_mobile: inv.customer_mobile,
          invoice_number: inv.invoice_number,
          invoice_id: inv.id,
          balance_due: inv.balance_due,
          due_date: inv.due_date,
          created_at: inv.created_at
        });
      }
    }

    const notifications = [...creditOverdue, ...creditDueToday, ...creditUpcoming];

    res.json({
      notifications,
      summary: {
        totalDueTodayCount: creditDueToday.length,
        totalDueTodayAmount: creditDueToday.reduce((acc, c) => acc + c.balance_due, 0),
        totalOverdueCount: creditOverdue.length,
        totalOverdueAmount: creditOverdue.reduce((acc, c) => acc + c.balance_due, 0),
        totalUpcomingCount: creditUpcoming.length,
        totalUpcomingAmount: creditUpcoming.reduce((acc, c) => acc + c.balance_due, 0)
      },
      creditDueToday,
      creditOverdue,
      creditUpcoming
    });
  } catch (err: any) {
    console.error("Notifications fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

export default router;
