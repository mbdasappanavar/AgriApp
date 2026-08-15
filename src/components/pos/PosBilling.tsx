import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, CheckCircle2, AlertTriangle, Printer,
  Package, Filter, RefreshCw, ShoppingBag, Tag, AlertCircle, Receipt,
  Search, User, UserPlus, X, ChevronDown, Phone, MapPin, Sprout, Calendar, Bell
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Product, Customer } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductWithBatch extends Product {
  category_name?: string;
  brand_name?: string;
  stock_qty: number;
  activeBatches: any[];
  selectedBatch: any | null;
}

interface CartItem {
  product: Product;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  availableQty: number;
  quantity: number;
  unit: string;
  rate: number; // Selling unit price (editable)
  discount: number; // Discount in ₹ (editable)
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export const PosBilling = () => {
  const [products, setProducts] = useState<ProductWithBatch[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [productSearch, setProductSearch] = useState<string>('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [isCreditSale, setIsCreditSale] = useState<boolean>(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Cheque Payment Details
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');

  // Mixed Payment Breakdown Parts
  const [mixedCash, setMixedCash] = useState<string>('');
  const [mixedUpi, setMixedUpi] = useState<string>('');
  const [mixedCheque, setMixedCheque] = useState<string>('');
  const [mixedChequeNum, setMixedChequeNum] = useState<string>('');
  const [mixedBankName, setMixedBankName] = useState<string>('');
  const [mixedCredit, setMixedCredit] = useState<string>('');

  // Active Customer Credit Notes state
  const [availableCreditNotes, setAvailableCreditNotes] = useState<any[]>([]);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string>('');
  const [creditNoteDeduction, setCreditNoteDeduction] = useState<string>('');

  const [isSubmitting, setIsSalesSubmitting] = useState<boolean>(false);
  const [completedInvoice, setCompletedInvoice] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active credit notes when selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      apiRequest(`/api/customers/${selectedCustomer.id}/credit-notes`)
        .then((res: any) => {
          setAvailableCreditNotes(res.activeCreditNotes || []);
          setSelectedCreditNoteId('');
          setCreditNoteDeduction('');
        })
        .catch(() => setAvailableCreditNotes([]));
    } else {
      setAvailableCreditNotes([]);
      setSelectedCreditNoteId('');
      setCreditNoteDeduction('');
    }
  }, [selectedCustomer]);

  // Auto-calculate total received amount when in Mixed payment mode
  useEffect(() => {
    if (paymentMode === 'Mixed') {
      const cashVal = parseFloat(mixedCash) || 0;
      const upiVal = parseFloat(mixedUpi) || 0;
      setAmountReceived((cashVal + upiVal).toString());
    }
  }, [paymentMode, mixedCash, mixedUpi]);

  const getFutureDateStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };
  const [paymentPromiseDate, setPaymentPromiseDate] = useState<string>(getFutureDateStr(15));

  // Quick Add Customer Modal state
  const [showQuickAddModal, setShowQuickAddModal] = useState<boolean>(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    village: '',
    mobile: ''
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers by search term
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const term = customerSearch.toLowerCase().trim();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.mobile && c.mobile.toLowerCase().includes(term)) ||
      (c.village && c.village.toLowerCase().includes(term))
    );
  });

  const loadPosProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await apiRequest('/api/pos/products');
      setProducts(res.products || []);
    } catch (err: any) {
      console.error('Failed to load POS products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await apiRequest('/api/customers');
      setCustomers(res.customers || []);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    }
  };

  useEffect(() => {
    loadPosProducts();

    // Load categories
    apiRequest('/api/products/masters/categories')
      .then(res => setCategories(res.categories || []))
      .catch(() => {});

    // Load customers
    loadCustomers();
  }, []);

  // Filtered Products Calculation
  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory && p.category_name !== selectedCategory) {
      return false;
    }
    if (onlyInStock && (p.stock_qty <= 0 || !p.selectedBatch)) {
      return false;
    }
    if (productSearch.trim()) {
      const term = productSearch.toLowerCase().trim();
      const matchName = p.name && p.name.toLowerCase().includes(term);
      const matchCode = p.code && p.code.toLowerCase().includes(term);
      const matchBrand = p.brand_name && p.brand_name.toLowerCase().includes(term);
      const matchCrop = p.crop && p.crop.toLowerCase().includes(term);
      if (!matchName && !matchCode && !matchBrand && !matchCrop) return false;
    }
    return true;
  });

  // Handle Quick Add Customer
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    setIsSavingCustomer(true);
    try {
      const res = await apiRequest('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustomerForm.name.trim(),
          village: newCustomerForm.village.trim() || null,
          mobile: newCustomerForm.mobile.trim() || null,
          customer_type: 'Farmer'
        })
      });

      await loadCustomers();

      // If created customer ID returned, select them
      if (res.id) {
        const createdCust = {
          id: res.id,
          name: newCustomerForm.name.trim(),
          village: newCustomerForm.village.trim(),
          mobile: newCustomerForm.mobile.trim(),
          current_outstanding: 0
        } as Customer;

        setSelectedCustomer(createdCust);
        setCustomerSearch(createdCust.name);
      }

      setShowQuickAddModal(false);
      setNewCustomerForm({ name: '', village: '', mobile: '' });
    } catch (err: any) {
      alert('Failed to register customer: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Add Product to Cart
  const handleAddToCart = (prod: ProductWithBatch, batchToUse?: any) => {
    setErrorMsg(null);
    const batch = batchToUse || prod.selectedBatch;

    if (!batch || prod.stock_qty <= 0 || batch.current_qty <= 0) {
      setErrorMsg(`'${prod.name}' is currently OUT OF STOCK or all available batches have expired.`);
      return;
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === prod.id && item.batchId === batch.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        if (newQty > batch.current_qty) {
          setErrorMsg(`Stock limit reached for Batch ${batch.batch_number} (${batch.current_qty} ${prod.unit})`);
          return prev;
        }
        const taxable = Math.max(0, (newQty * item.rate) - item.discount);
        const totalTax = (taxable * item.gstRate) / 100;
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          taxableValue: taxable,
          cgstAmount: totalTax / 2,
          sgstAmount: totalTax / 2,
          totalAmount: taxable + totalTax
        };
        return updated;
      } else {
        const qty = 1;
        const rate = prod.selling_price;
        const discount = 0;
        const taxable = Math.max(0, (qty * rate) - discount);
        const totalTax = (taxable * prod.gst_rate) / 100;
        return [...prev, {
          product: prod,
          batchId: batch.id,
          batchNumber: batch.batch_number,
          expiryDate: batch.expiry_date,
          availableQty: batch.current_qty,
          quantity: qty,
          unit: prod.unit,
          rate,
          discount,
          taxableValue: taxable,
          gstRate: prod.gst_rate,
          cgstAmount: totalTax / 2,
          sgstAmount: totalTax / 2,
          igstAmount: 0,
          totalAmount: taxable + totalTax
        }];
      }
    });
  };

  // Update item in cart (supports quantity, rate alteration, discount addition)
  const updateCartItem = (idx: number, field: 'quantity' | 'rate' | 'discount', value: number) => {
    setErrorMsg(null);
    if (field === 'quantity' && value <= 0) {
      setCart(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      const item = { ...updated[idx] };

      if (field === 'quantity') {
        if (value > item.availableQty) {
          setErrorMsg(`Quantity exceeds batch available stock (${item.availableQty})`);
          value = item.availableQty;
        }
        item.quantity = value;
      } else if (field === 'rate') {
        item.rate = Math.max(0, value);
      } else if (field === 'discount') {
        item.discount = Math.max(0, value);
      }

      // Recalculate financial breakdown
      const gross = item.quantity * item.rate;
      const taxable = Math.max(0, gross - item.discount);
      const totalTax = (taxable * item.gstRate) / 100;

      item.taxableValue = taxable;
      item.cgstAmount = totalTax / 2;
      item.sgstAmount = totalTax / 2;
      item.totalAmount = taxable + totalTax;

      updated[idx] = item;
      return updated;
    });
  };

  // Totals calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
  const totalDiscount = cart.reduce((acc, item) => acc + item.discount, 0);
  const totalTaxable = cart.reduce((acc, item) => acc + item.taxableValue, 0);
  const totalTax = cart.reduce((acc, item) => acc + (item.cgstAmount + item.sgstAmount + item.igstAmount), 0);
  const grandTotal = cart.reduce((acc, item) => acc + item.totalAmount, 0);

  // Credit Note calculation helper
  const selectedCN = availableCreditNotes.find(c => c.id === selectedCreditNoteId);
  const maxCNAvailable = selectedCN ? Math.max(0, (selectedCN.grand_total || 0) - (selectedCN.used_amount || 0)) : 0;
  const appliedCNVal = selectedCreditNoteId ? Math.min(grandTotal, Math.min(maxCNAvailable, Math.max(0, parseFloat(creditNoteDeduction) || 0))) : 0;
  const netPayable = Math.max(0, Number((grandTotal - appliedCNVal).toFixed(2)));

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cannot complete sale: Cart is empty.');
      return;
    }

    let paidVal = 0;
    let finalPaymentModeLabel = paymentMode;
    const additionalNotes: string[] = [];

    if (appliedCNVal > 0 && selectedCN) {
      additionalNotes.push(`Credit Note ${selectedCN.credit_note_number || selectedCN.return_number} Applied: ₹${appliedCNVal}`);
    }

    if (paymentMode === 'Cheque') {
      if (!chequeNumber.trim() || !bankName.trim()) {
        setErrorMsg('Please enter both Cheque Number and Bank Name for Cheque payment.');
        return;
      }
      finalPaymentModeLabel = `Cheque (#${chequeNumber.trim()}, ${bankName.trim()})`;
      additionalNotes.push(`Cheque No: ${chequeNumber.trim()}, Bank: ${bankName.trim()}`);
      paidVal = (amountReceived !== '' && amountReceived !== null) 
        ? Math.min(netPayable, Math.max(0, parseFloat(amountReceived) || 0))
        : netPayable;
    } else if (paymentMode === 'Mixed') {
      const cashVal = parseFloat(mixedCash) || 0;
      const upiVal = parseFloat(mixedUpi) || 0;
      const credVal = parseFloat(mixedCredit) || 0;

      paidVal = cashVal + upiVal;

      const partsSummary: string[] = [];
      if (cashVal > 0) partsSummary.push(`Cash: ₹${cashVal}`);
      if (upiVal > 0) partsSummary.push(`UPI: ₹${upiVal}`);
      if (credVal > 0) partsSummary.push(`Credit: ₹${credVal}`);

      if (partsSummary.length === 0 && appliedCNVal <= 0) {
        setErrorMsg('Please enter payment amounts for at least one payment method in Mixed payment.');
        return;
      }

      finalPaymentModeLabel = `Mixed (${partsSummary.join(', ')})`;
      additionalNotes.push(`Mixed Payment Breakdown: [${partsSummary.join(', ')}]`);
    } else if (paymentMode === 'Credit') {
      paidVal = 0;
    } else {
      paidVal = (amountReceived !== '' && amountReceived !== null) 
        ? Math.min(netPayable, Math.max(0, parseFloat(amountReceived) || 0))
        : netPayable;
    }

    const remainingDue = Math.max(0, Number((netPayable - paidVal).toFixed(2)));
    const willBeCredit = isCreditSale || remainingDue > 0 || (paymentMode === 'Mixed' && (parseFloat(mixedCredit) || 0) > 0);

    if (willBeCredit && !selectedCustomer) {
      setErrorMsg('A registered customer is required when there is an unpaid remaining balance or credit / khata sale.');
      return;
    }

    if (selectedCreditNoteId && !selectedCustomer) {
      setErrorMsg('A registered customer is required when redeeming a Credit Note.');
      return;
    }

    setIsSalesSubmitting(true);
    setErrorMsg(null);

    const fullNotes = [notes.trim(), ...additionalNotes].filter(Boolean).join(' | ');

    try {
      const payload = {
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        customer_mobile: selectedCustomer?.mobile,
        customer_gstin: selectedCustomer?.gstin,
        items: cart.map(c => ({
          product_id: c.product.id,
          batch_id: c.batchId,
          quantity: c.quantity,
          rate: c.rate,
          discount: c.discount
        })),
        payment_mode: finalPaymentModeLabel,
        amount_received: paidVal,
        is_credit_sale: willBeCredit ? 1 : 0,
        due_date: willBeCredit ? paymentPromiseDate : null,
        notes: fullNotes,
        credit_note_id: selectedCreditNoteId || null,
        credit_note_amount: appliedCNVal
      };

      const res = await apiRequest('/api/pos/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setCompletedInvoice({
        invoiceNumber: res.invoiceNumber,
        grandTotal,
        subtotal,
        totalDiscount,
        totalTaxable,
        totalTax,
        creditNoteAmount: appliedCNVal,
        creditNoteNumber: selectedCN ? (selectedCN.credit_note_number || selectedCN.return_number) : null,
        netPayable,
        amountReceived: paidVal,
        balanceDue: remainingDue,
        dueDate: willBeCredit ? paymentPromiseDate : null,
        paymentMode: finalPaymentModeLabel,
        notes: fullNotes,
        customer: selectedCustomer,
        cart: [...cart]
      });

      // Reset state for next bill
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setAmountReceived('');
      setNotes('');
      setIsCreditSale(false);
      setPaymentMode('Cash');
      setChequeNumber('');
      setBankName('');
      setMixedCash('');
      setMixedUpi('');
      setMixedCheque('');
      setMixedChequeNum('');
      setMixedBankName('');
      setMixedCredit('');
      setSelectedCreditNoteId('');
      setCreditNoteDeduction('');
      setAvailableCreditNotes([]);

      // Refresh stock qty
      loadPosProducts();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete sale transaction');
    } finally {
      setIsSalesSubmitting(false);
    }
  };

  // Thermal Receipt Printing Mode (80mm / 3 inch printer)
  const printThermalReceipt = () => {
    if (!completedInvoice) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = completedInvoice.cart.map((item: CartItem) => `
      <tr>
        <td style="padding: 2px 0;">
          <div style="font-weight: bold;">${item.product.name}</div>
          <div style="font-size: 9px; color: #555;">Batch: ${item.batchNumber} (Exp: ${item.expiryDate})</div>
        </td>
        <td style="text-align: center;">${item.quantity} ${item.unit}</td>
        <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold;">₹${item.totalAmount.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${completedInvoice.invoiceNumber}</title>
        <style>
          body { font-family: monospace; font-size: 11px; margin: 0; padding: 10px; width: 280px; color: #000; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-bottom: 2px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
          .total-row { font-size: 12px; font-weight: bold; }
          @media print {
            body { width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 13px;" class="bold">SHRI REVANASIDDESHWARA AGRO CENTER</div>
          <div>Main Road, Kalaghatagi - 581204</div>
          <div>Phone: +91 9844012345</div>
          <div>GSTIN: 29AABCA1234F1Z2</div>
        </div>

        <div class="double-divider"></div>

        <div class="bold text-center">TAX INVOICE</div>
        <div>Inv No: <span class="bold">${completedInvoice.invoiceNumber}</span></div>
        <div>Date  : ${new Date().toLocaleString()}</div>
        <div>Cust  : ${completedInvoice.customer?.name || 'Walk-in Retail Customer'}</div>
        ${completedInvoice.customer?.mobile ? `<div>Mob   : ${completedInvoice.customer.mobile}</div>` : ''}
        <div>Pay   : ${completedInvoice.paymentMode}</div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <table>
          <tr>
            <td>Subtotal:</td>
            <td class="text-right">₹${completedInvoice.subtotal.toFixed(2)}</td>
          </tr>
          ${completedInvoice.totalDiscount > 0 ? `
          <tr>
            <td>Total Discount:</td>
            <td class="text-right">-₹${completedInvoice.totalDiscount.toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td>Taxable Amount:</td>
            <td class="text-right">₹${completedInvoice.totalTaxable.toFixed(2)}</td>
          </tr>
          <tr>
            <td>CGST + SGST:</td>
            <td class="text-right">₹${completedInvoice.totalTax.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Grand Total:</td>
            <td class="text-right">₹${completedInvoice.grandTotal.toFixed(2)}</td>
          </tr>
          ${completedInvoice.creditNoteAmount > 0 ? `
          <tr>
            <td>Credit Note (${completedInvoice.creditNoteNumber || 'Redeemed'}):</td>
            <td class="text-right">-₹${completedInvoice.creditNoteAmount.toFixed(2)}</td>
          </tr>` : ''}
          <tr class="total-row">
            <td style="padding-top: 4px;">NET PAYABLE:</td>
            <td class="text-right" style="padding-top: 4px; font-size: 14px;">₹${(completedInvoice.netPayable || completedInvoice.grandTotal - (completedInvoice.creditNoteAmount || 0)).toFixed(2)}</td>
          </tr>
        </table>

        <div class="double-divider"></div>

        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          <div>*** THANK YOU FOR YOUR VISIT ***</div>
          <div>Verify batch & expiry before leaving counter</div>
          <div>Goods once sold returned as per rules</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Standard A4 GST PDF Invoice Download
  const generatePdfInvoice = () => {
    if (!completedInvoice) return;
    const doc = new jsPDF();

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('SHRI REVANASIDDESHWARA AGRO CENTER', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Main Road, Kalaghatagi, Dharwad Dist, Karnataka - 581204 | Ph: +91 9844012345', 14, 24);
    doc.text('GSTIN: 29AABCA1234F1Z2', 14, 29);

    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`GST TAX INVOICE: ${completedInvoice.invoiceNumber}`, 14, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice Date: ${new Date().toISOString().split('T')[0]}`, 140, 40);

    doc.text(`Customer Name: ${completedInvoice.customer?.name || 'Walk-in Customer'}`, 14, 47);
    doc.text(`Mobile: ${completedInvoice.customer?.mobile || 'N/A'}`, 14, 52);
    if (completedInvoice.customer?.gstin) doc.text(`GSTIN: ${completedInvoice.customer.gstin}`, 14, 57);

    const tableData = completedInvoice.cart.map((item: CartItem, i: number) => [
      i + 1,
      item.product.name,
      item.batchNumber,
      item.expiryDate,
      `${item.quantity} ${item.unit}`,
      `₹${item.rate.toFixed(2)}`,
      `₹${item.discount.toFixed(2)}`,
      `${item.gstRate}%`,
      `₹${item.totalAmount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: completedInvoice.customer?.gstin ? 62 : 56,
      head: [['#', 'Product Item', 'Batch', 'Expiry', 'Qty', 'Rate', 'Discount', 'GST', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    // Totals footer block
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subtotal Amount: ₹${completedInvoice.subtotal.toFixed(2)}`, 130, finalY);
    if (completedInvoice.totalDiscount > 0) {
      doc.text(`Discount Amount: -₹${completedInvoice.totalDiscount.toFixed(2)}`, 130, finalY + 5);
    }
    doc.text(`Taxable Amount: ₹${completedInvoice.totalTaxable.toFixed(2)}`, 130, finalY + 10);
    doc.text(`CGST + SGST: ₹${completedInvoice.totalTax.toFixed(2)}`, 130, finalY + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ₹${completedInvoice.grandTotal.toFixed(2)}`, 130, finalY + 22);

    doc.save(`Invoice_${completedInvoice.invoiceNumber}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Left Column: Product Catalog Display */}
      <div className="flex-1 flex flex-col border-r border-slate-800 p-3 space-y-2.5 overflow-hidden min-w-0">
        
        {/* Catalog Header Bar */}
        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-xs font-bold text-slate-100">POS Product Catalog</h2>
              <p className="text-[10px] text-slate-400">Available store inventory items</p>
            </div>
          </div>

          {/* Product Search & Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 text-slate-200 text-xs rounded-lg pl-8 pr-2 py-1.5 w-36 sm:w-44 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-500"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* In Stock Toggle */}
            <button
              type="button"
              onClick={() => setOnlyInStock(!onlyInStock)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1 transition-colors ${
                onlyInStock
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>In Stock</span>
            </button>

            <button
              type="button"
              onClick={loadPosProducts}
              title="Refresh Products"
              className="p-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2 rounded-lg text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200 text-xs px-1">✕</button>
          </div>
        )}

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
              <div className="text-center space-y-2">
                <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto" />
                <p>Loading Product Catalog...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs p-6 text-center border-2 border-dashed border-slate-800 rounded-2xl">
              <Package className="w-10 h-10 mb-2 opacity-30" />
              <p className="font-semibold text-slate-400">No products match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {filteredProducts.map((p) => {
                const inCartCount = cart
                  .filter(c => c.product.id === p.id)
                  .reduce((acc, c) => acc + c.quantity, 0);

                const hasStock = p.stock_qty > 0 && p.selectedBatch;

                return (
                  <div
                    key={p.id}
                    className={`bg-slate-900/90 rounded-xl border p-2.5 flex flex-col justify-between transition-all hover:border-emerald-500/50 shadow-sm ${
                      hasStock ? 'border-slate-800' : 'border-slate-800/60 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between text-[10px] mb-1 gap-1">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium truncate max-w-[120px]">
                          {p.category_name || 'Agri Input'}
                        </span>
                        {p.brand_name && (
                          <span className="text-emerald-400 font-semibold truncate max-w-[100px]">
                            {p.brand_name}
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <h3 className="font-bold text-slate-100 text-xs line-clamp-1 group-hover:text-emerald-400" title={p.name}>
                        {p.name}
                      </h3>

                      {/* Code / Pack / Crop / HSN details */}
                      <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>Code: <strong className="text-slate-300">{p.code}</strong></span>
                        {p.hsn_code && (
                          <span className="text-amber-400">HSN: <strong className="font-mono">{p.hsn_code}</strong></span>
                        )}
                        <span>Pack: <strong className="text-slate-300">{p.pack_size}</strong></span>
                        {p.crop && <span className="text-emerald-400">Crop: {p.crop}</span>}
                      </div>

                      {/* FEFO Batch Badge */}
                      <div className="mt-1.5 text-[10px] bg-slate-950 p-1.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                        {p.selectedBatch ? (
                          <>
                            <span className="text-slate-400 flex items-center space-x-1">
                              <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="font-mono text-emerald-400">{p.selectedBatch.batch_number}</span>
                            </span>
                            <span className="text-slate-400">Exp: {p.selectedBatch.expiry_date}</span>
                          </>
                        ) : (
                          <span className="text-rose-400 flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>No Active Batch</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Stock Footer */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-emerald-400">
                          ₹{p.selling_price} <span className="text-[9px] font-normal text-slate-400">({p.gst_rate}% GST)</span>
                        </div>
                        <div className="text-[10px]">
                          {hasStock ? (
                            <span className="text-emerald-400 font-semibold">Stock: {p.stock_qty} {p.unit}</span>
                          ) : (
                            <span className="text-rose-400 font-semibold">Out of Stock</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        disabled={!hasStock}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all shadow ${
                          hasStock
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inCartCount > 0 ? `Add (${inCartCount})` : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Counter Cart & Customer Billing Panel */}
      <div className="w-full lg:w-[460px] xl:w-[490px] bg-slate-900 border-t lg:border-t-0 border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
        
        {/* Cart Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <h2 className="text-xs font-bold text-slate-100 flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Counter Bill Cart ({cart.length} items)</span>
          </h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Table Area (Scrollable) */}
        <div className="flex-1 min-h-[160px] overflow-y-auto bg-slate-950 p-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-10">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
              <p className="font-semibold text-slate-400">Cart is empty.</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Click "+ Add" on items to list them here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cart.map((item, idx) => (
                <div
                  key={`${item.product.id}-${item.batchId}`}
                  className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col space-y-1.5 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate text-xs">{item.product.name}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        Batch: {item.batchNumber} (Exp: {item.expiryDate})
                      </div>
                    </div>
                    <button
                      onClick={() => updateCartItem(idx, 'quantity', 0)}
                      className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 shrink-0"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Qty, Unit Price, Discount & Total Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                    {/* Qty Selector */}
                    <div className="flex items-center space-x-1 bg-slate-950 px-1 py-0.5 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => updateCartItem(idx, 'quantity', item.quantity - 1)}
                        className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded font-bold text-slate-300 flex items-center justify-center text-xs shrink-0"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.availableQty}
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateCartItem(idx, 'quantity', isNaN(val) ? 0 : val);
                        }}
                        className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                        title="Enter quantity manually"
                      />
                      <button
                        type="button"
                        onClick={() => updateCartItem(idx, 'quantity', item.quantity + 1)}
                        className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded font-bold text-slate-300 flex items-center justify-center text-xs shrink-0"
                      >
                        +
                      </button>
                    </div>

                    {/* Price Input */}
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-400">Rate:</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateCartItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-right font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Discount Input */}
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-400">Disc:</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.discount}
                        onChange={(e) => updateCartItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                        className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-right font-semibold text-amber-300 focus:outline-none focus:border-amber-500"
                        placeholder="0"
                      />
                    </div>

                    {/* Item Total */}
                    <div className="font-extrabold text-emerald-400 text-xs shrink-0 pl-1">
                      ₹{item.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Billing Controls (Customer, Payment Mode, Totals) */}
        <div className="p-3 space-y-2.5 bg-slate-900 border-t border-slate-800/80 overflow-y-auto shrink-0 max-h-[52vh] text-xs">
          
          {/* Customer Search & Selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Customer Profile</span>
              </label>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(true)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Register New Farmer</span>
              </button>
            </div>

            {selectedCustomer ? (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-100 text-xs flex items-center space-x-1.5">
                    <span className="text-emerald-400">{selectedCustomer.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({selectedCustomer.mobile || 'No Mobile'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded"
                  >
                    Change Customer
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Village: <strong className="text-slate-200">{selectedCustomer.village || 'Kalaghatagi'}</strong> {selectedCustomer.crop ? `(${selectedCustomer.crop})` : ''}</span>
                  <span className={selectedCustomer.current_outstanding > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    Outstanding Balance: ₹{selectedCustomer.current_outstanding}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search farmer by Name, Mobile or Village..."
                    value={customerSearch}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-12 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => { setCustomerSearch(''); setIsCustomerDropdownOpen(false); }}
                      className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Floating Autocomplete Overlay */}
                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 max-h-52 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="w-full text-left p-2.5 hover:bg-slate-800 text-xs text-slate-300 flex items-center justify-between font-medium"
                    >
                      <span>Walk-in Customer (Cash Retail)</span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">Default</span>
                    </button>

                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 space-y-1">
                        <p>No customer found matching "{customerSearch}"</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomerDropdownOpen(false);
                            setNewCustomerForm(prev => ({ ...prev, name: customerSearch }));
                            setShowQuickAddModal(true);
                          }}
                          className="text-xs text-emerald-400 font-bold hover:underline"
                        >
                          + Quick Register "{customerSearch}"
                        </button>
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch(c.name);
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="w-full text-left p-2 hover:bg-slate-800 text-xs transition-colors space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100">{c.name}</span>
                            <span className="text-[10px] font-mono text-emerald-400">{c.mobile || 'No Mobile'}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{c.village || 'Kalaghatagi'} {c.crop ? `(${c.crop})` : ''}</span>
                            <span className={c.current_outstanding > 0 ? "text-amber-400 font-semibold" : "text-emerald-400"}>
                              Outstanding: ₹{c.current_outstanding}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Credit Note Selection (If customer has available credit notes) */}
          {selectedCustomer && availableCreditNotes.length > 0 && (
            <div className="bg-teal-950/40 border border-teal-500/40 p-2.5 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-300">
                  <Receipt className="w-4 h-4 text-teal-400" />
                  <span>Available Credit Notes ({availableCreditNotes.length})</span>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-200 border border-teal-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                  Total Avail: ₹{availableCreditNotes.reduce((sum, c) => sum + (c.grand_total - (c.used_amount || 0)), 0).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-300 mb-0.5">Select Credit Note to Redeem</label>
                  <select
                    value={selectedCreditNoteId}
                    onChange={(e) => {
                      const cnId = e.target.value;
                      setSelectedCreditNoteId(cnId);
                      if (!cnId) {
                        setCreditNoteDeduction('');
                      } else {
                        const cn = availableCreditNotes.find(c => c.id === cnId);
                        if (cn) {
                          const avail = Math.max(0, (cn.grand_total || 0) - (cn.used_amount || 0));
                          const applyVal = Math.min(grandTotal, avail);
                          setCreditNoteDeduction(applyVal.toString());
                        }
                      }
                    }}
                    className="w-full bg-slate-950 border border-teal-500/50 rounded-lg px-2 py-1 text-xs text-teal-200 font-semibold focus:outline-none"
                  >
                    <option value="">-- No Credit Note Applied --</option>
                    {availableCreditNotes.map((cn: any) => {
                      const avail = Math.max(0, (cn.grand_total || 0) - (cn.used_amount || 0));
                      return (
                        <option key={cn.id} value={cn.id}>
                          {cn.credit_note_number || cn.return_number} - Avail: ₹{avail.toFixed(2)} (Total ₹{cn.grand_total})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedCreditNoteId && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-teal-500/20 text-xs">
                    <span className="text-slate-300 text-[11px] font-semibold">Credit Amount to Apply (₹):</span>
                    <input
                      type="number"
                      min="0"
                      max={maxCNAvailable}
                      step="1"
                      value={creditNoteDeduction}
                      onChange={(e) => setCreditNoteDeduction(e.target.value)}
                      className="w-24 bg-slate-950 border border-teal-400 rounded px-2 py-1 text-xs text-right font-extrabold text-teal-300 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Mode Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-semibold text-slate-300">Payment Mode</label>
            <div className="grid grid-cols-5 gap-1">
              {['Cash', 'UPI', 'Cheque', 'Credit', 'Mixed'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPaymentMode(mode);
                    if (mode === 'Credit') {
                      setIsCreditSale(true);
                      setAmountReceived('0');
                    } else if (mode === 'Cash' || mode === 'UPI' || mode === 'Cheque') {
                      setIsCreditSale(false);
                      setAmountReceived('');
                    } else if (mode === 'Mixed') {
                      setIsCreditSale(false);
                      if (!mixedCash && !mixedUpi && !mixedCredit && netPayable > 0) {
                        setMixedCash(netPayable.toString());
                      }
                    }
                  }}
                  className={`py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                    paymentMode === mode
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Cheque Details Fields */}
            {paymentMode === 'Cheque' && (
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                  <span>Cheque Payment Details</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Required)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Cheque No. *</label>
                    <input
                      type="text"
                      placeholder="e.g. 849201"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Bank Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. SBI / Canara / HDFC"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mixed Payment Breakdown UI */}
            {paymentMode === 'Mixed' && (
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-bold text-emerald-400">Mixed Payment Parts Breakdown</span>
                  {(() => {
                    const totalParts = (parseFloat(mixedCash) || 0) + (parseFloat(mixedUpi) || 0) + (parseFloat(mixedCredit) || 0);
                    const diff = Number((netPayable - totalParts).toFixed(2));
                    if (diff === 0) {
                      return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">✓ Balanced</span>;
                    } else if (diff > 0) {
                      return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Unallocated: ₹{diff}</span>;
                    } else {
                      return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Exceeds: ₹{Math.abs(diff)}</span>;
                    }
                  })()}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Cash Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={mixedCash}
                      onChange={(e) => setMixedCash(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono text-right focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">UPI Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={mixedUpi}
                      onChange={(e) => setMixedUpi(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono text-right focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Credit / Khata (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={mixedCredit}
                      onChange={(e) => setMixedCredit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-bold font-mono text-right focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment & Credit Breakdown */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  {paymentMode === 'Mixed' ? 'Received Funds Today (₹):' : 'Amount Paid Today (₹):'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  readOnly={paymentMode === 'Mixed'}
                  placeholder={netPayable ? netPayable.toFixed(2) : '0'}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className={`w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-right font-bold focus:outline-none ${
                    paymentMode === 'Mixed' ? 'text-teal-400 bg-slate-950 cursor-not-allowed' : 'text-emerald-400 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Remaining Balance status */}
              {(() => {
                const paidVal = (amountReceived !== '' && amountReceived !== null)
                  ? Math.min(netPayable, Math.max(0, parseFloat(amountReceived) || 0))
                  : (paymentMode === 'Credit' ? 0 : netPayable);
                const remainingDue = Math.max(0, Number((netPayable - paidVal).toFixed(2)));

                return (
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80 font-semibold">
                    <span className="text-slate-400">Remaining Balance Due:</span>
                    <span className={remainingDue > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                      ₹{remainingDue.toFixed(2)} {remainingDue > 0 ? '(Added to Khata Udhaar)' : '(Full Paid)'}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Payment Promise Date Selector for Credit / Udhaar Sales */}
            {(() => {
              const paidVal = (amountReceived !== '' && amountReceived !== null)
                ? Math.min(netPayable, Math.max(0, parseFloat(amountReceived) || 0))
                : (paymentMode === 'Credit' ? 0 : netPayable);
              const remainingDue = Math.max(0, Number((netPayable - paidVal).toFixed(2)));
              const isCreditNeeded = isCreditSale || remainingDue > 0 || paymentMode === 'Credit' || (paymentMode === 'Mixed' && (parseFloat(mixedCredit) || 0) > 0);

              if (!isCreditNeeded) return null;

              return (
                <div className="bg-amber-950/40 border border-amber-800/70 p-2.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Payment Promise Date (Udhaar Due)</span>
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-normal">Promised Payment On</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <div className="relative flex-1 flex items-center">
                      <input
                        id="payment-promise-date-input"
                        type="date"
                        value={paymentPromiseDate}
                        min={getFutureDateStr(1)}
                        onChange={(e) => {
                          const val = e.target.value;
                          const tomorrow = getFutureDateStr(1);
                          if (val && val < tomorrow) {
                            setPaymentPromiseDate(tomorrow);
                          } else {
                            setPaymentPromiseDate(val);
                          }
                        }}
                        onClick={(e) => {
                          try {
                            (e.target as HTMLInputElement).showPicker?.();
                          } catch (_) {}
                        }}
                        onFocus={(e) => {
                          try {
                            (e.target as HTMLInputElement).showPicker?.();
                          } catch (_) {}
                        }}
                        className="w-full bg-slate-900 border border-amber-700/60 rounded-lg pl-8 pr-2 py-1.5 text-xs text-amber-200 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                      />
                      <Calendar
                        onClick={() => {
                          const inputEl = document.getElementById('payment-promise-date-input') as HTMLInputElement;
                          try { inputEl?.showPicker?.(); } catch (_) { inputEl?.focus(); }
                        }}
                        className="w-4 h-4 text-amber-400 absolute left-2 pointer-events-auto cursor-pointer"
                      />
                    </div>
                    <div className="flex space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPaymentPromiseDate(getFutureDateStr(7))}
                        className="px-1.5 py-1.5 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/50 rounded-lg text-[10px] font-semibold text-amber-200"
                      >
                        +7d
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentPromiseDate(getFutureDateStr(15))}
                        className="px-1.5 py-1.5 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/50 rounded-lg text-[10px] font-semibold text-amber-200"
                      >
                        +15d
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentPromiseDate(getFutureDateStr(30))}
                        className="px-1.5 py-1.5 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/50 rounded-lg text-[10px] font-semibold text-amber-200"
                      >
                        +30d
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-300/80 flex items-center space-x-1">
                    <Bell className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Seller will be notified on <strong className="text-amber-200 font-semibold">{paymentPromiseDate}</strong> for payment collection.</span>
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Seller Note */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <label className="font-semibold text-slate-300">Seller Internal Note</label>
              <span className="text-slate-500 text-[9px]">(Private)</span>
            </div>
            <input
              type="text"
              placeholder="e.g. 15-day extended payment terms requested..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Totals Breakdown & Complete Sale Button */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Subtotal:</span>
              <span className="font-medium text-slate-200">₹{subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-amber-400 text-[11px]">
                <span>Total Item Discount:</span>
                <span className="font-medium">-₹{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>GST Tax:</span>
              <span className="font-medium text-slate-200">₹{totalTax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-200 text-xs font-bold pt-1 border-t border-slate-800">
              <span>Bill Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>

            {appliedCNVal > 0 && (
              <div className="flex justify-between text-teal-300 text-xs font-bold">
                <span>Credit Note Applied ({selectedCN?.credit_note_number || selectedCN?.return_number}):</span>
                <span>-₹{appliedCNVal.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-800 pt-1 flex justify-between text-xs font-extrabold text-slate-100">
              <span>Net Payable Amount:</span>
              <span className="text-emerald-400 text-sm">₹{netPayable.toFixed(2)}</span>
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={isSubmitting || cart.length === 0}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 text-xs transition-all active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Transaction...' : 'Complete Sale'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Farmer Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Quick Register Farmer / Customer</span>
              </h3>
              <button onClick={() => setShowQuickAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basavaraj Patil"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Village *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navalgund"
                  value={newCustomerForm.village}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, village: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Mobile Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9844012345"
                  value={newCustomerForm.mobile}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, mobile: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow"
                >
                  {isSavingCustomer ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Success & Print Modal */}
      {completedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Sale Completed Successfully!</h3>
              <p className="text-xs text-slate-400">Invoice No: <span className="font-mono text-emerald-400 font-semibold">{completedInvoice.invoiceNumber}</span></p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-400">Grand Total:</span><span className="font-bold text-slate-100">₹{completedInvoice.grandTotal.toFixed(2)}</span></div>
              {completedInvoice.totalDiscount > 0 && (
                <div className="flex justify-between text-amber-400"><span className="text-slate-400">Total Discount:</span><span>-₹{completedInvoice.totalDiscount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-400">GST Tax:</span><span className="font-medium text-slate-200">₹{completedInvoice.totalTax.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Payment Mode:</span><span className="font-medium text-emerald-400">{completedInvoice.paymentMode}</span></div>
            </div>

            <div className="flex flex-col space-y-2">
              {/* Thermal Receipt Mode Print Button */}
              <button
                onClick={printThermalReceipt}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/40"
              >
                <Receipt className="w-4 h-4" />
                <span>Print Thermal Receipt (80mm)</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={generatePdfInvoice}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 rounded-xl text-xs flex items-center justify-center space-x-1 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  onClick={() => setCompletedInvoice(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
