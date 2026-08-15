import React, { useState, useEffect } from 'react';
import {
  FileText, RotateCcw, Search, Calendar, Filter, Printer, Receipt,
  Eye, X, AlertTriangle, CheckCircle2, ShieldAlert, ArrowLeft, RefreshCw, User, Tag
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesModuleProps {
  activeSubTab?: 'sales_history' | 'sales_returns';
}

export const SalesModule: React.FC<SalesModuleProps> = ({ activeSubTab = 'sales_history' }) => {
  const [tab, setTab] = useState<'history' | 'returns'>(
    activeSubTab === 'sales_returns' ? 'returns' : 'history'
  );

  useEffect(() => {
    if (activeSubTab === 'sales_returns') setTab('returns');
    else setTab('history');
  }, [activeSubTab]);

  // Sales History State
  const [salesList, setSalesList] = useState<any[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');

  // Load Categories for filtering
  const loadCategories = async () => {
    try {
      const res = await apiRequest('/api/products/masters/categories');
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Quick Date Range Presets
  const applyDatePreset = (preset: 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setDateRangePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'daily') {
      const today = formatYMD(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6); // Last 7 days
      setStartDate(formatYMD(startOfWeek));
      setEndDate(formatYMD(now));
    } else if (preset === 'monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Current month 1st
      setStartDate(formatYMD(startOfMonth));
      setEndDate(formatYMD(now));
    } else if (preset === 'yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1); // Current year Jan 1st
      setStartDate(formatYMD(startOfYear));
      setEndDate(formatYMD(now));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Cancel Invoice State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Sales Returns State
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(true);
  const [showNewReturnModal, setShowNewReturnModal] = useState<boolean>(false);

  // New Return Form State
  const [returnSearchMode, setReturnSearchMode] = useState<'customer' | 'invoice'>('customer');
  const [returnCustomerSearch, setReturnCustomerSearch] = useState<string>('');
  const [matchedCustomers, setMatchedCustomers] = useState<any[]>([]);
  const [selectedReturnCustomer, setSelectedReturnCustomer] = useState<any | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [isLoadingCustomerInvoices, setIsLoadingCustomerInvoices] = useState<boolean>(false);

  const [returnInvoiceSearch, setReturnInvoiceSearch] = useState<string>('');
  const [matchedInvoices, setMatchedInvoices] = useState<any[]>([]);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<{ [key: string]: number }>({});
  const [returnReason, setReturnReason] = useState<string>('Farmer Returned Unused');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

  // 5 Return Resolution Options
  const [returnResolution, setReturnResolution] = useState<'Credit Note' | 'Full Refund' | 'Partial Refund' | 'Sale Exchange' | 'Same Defective Exchange'>('Credit Note');
  const [customRefundAmt, setCustomRefundAmt] = useState<number>(0);
  const [isDefectivePackage, setIsDefectivePackage] = useState<boolean>(false);

  // Exchange Product Selection State
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState<string>('');
  const [exchangeProductResults, setExchangeProductResults] = useState<any[]>([]);
  const [exchangeCart, setExchangeCart] = useState<Array<{ product_id: string; name: string; rate: number; unit: string; quantity: number; stock: number; batch_id?: string }>>([]);

  // Result modal for printing Credit Note
  const [completedReturnData, setCompletedReturnData] = useState<any | null>(null);
  const [showSuccessReturnModal, setShowSuccessReturnModal] = useState<boolean>(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Sales History
  const loadSalesHistory = async () => {
    setIsLoadingSales(true);
    try {
      let url = `/api/sales?`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (selectedCategory) url += `category_id=${encodeURIComponent(selectedCategory)}&`;

      const res = await apiRequest(url);
      setSalesList(res.sales || []);
    } catch (err: any) {
      console.error('Failed to load sales history:', err);
    } finally {
      setIsLoadingSales(false);
    }
  };

  // Load Returns History
  const loadReturnsHistory = async () => {
    setIsLoadingReturns(true);
    try {
      let url = `/api/sales/returns/list?`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (selectedCategory) url += `category_id=${encodeURIComponent(selectedCategory)}&`;

      const res = await apiRequest(url);
      setReturnsList(res.returns || []);
    } catch (err: any) {
      console.error('Failed to load sales returns:', err);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  // Selected Return Detail Modal State
  const [selectedReturnRecord, setSelectedReturnRecord] = useState<any | null>(null);
  const [returnDetails, setReturnDetails] = useState<any | null>(null);
  const [isLoadingReturnDetails, setIsLoadingReturnDetails] = useState<boolean>(false);

  const handleViewReturnDetails = async (ret: any) => {
    setSelectedReturnRecord(ret);
    setIsLoadingReturnDetails(true);
    setReturnDetails(null);
    try {
      const res = await apiRequest(`/api/sales/returns/${ret.id}`);
      setReturnDetails(res);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to load return details.' });
    } finally {
      setIsLoadingReturnDetails(false);
    }
  };

  const handlePrintReturnThermal = (detail: any) => {
    if (!detail || !detail.returnRecord) return;
    const { returnRecord, items } = detail;
    const data = {
      res: {
        creditNoteNumber: returnRecord.credit_note_number || returnRecord.return_number,
        returnNumber: returnRecord.return_number,
        grandTotal: returnRecord.refund_amount || returnRecord.grand_total || 0
      },
      invoice: {
        sales: {
          invoice_number: returnRecord.invoice_number,
          customer_name: returnRecord.customer_name,
          customer_mobile: returnRecord.customer_mobile
        }
      },
      customer: {
        name: returnRecord.customer_name,
        mobile: returnRecord.customer_mobile
      },
      returnItemsList: (items || []).map((i: any) => ({
        product_name: i.product_name,
        returnQty: i.quantity,
        unit: i.unit || 'Pcs',
        rate: i.rate
      })),
      resolution: returnRecord.return_type || 'Sales Return'
    };
    printCreditNoteThermal(data);
  };

  const handlePrintReturnPDF = (detail: any) => {
    if (!detail || !detail.returnRecord) return;
    const { returnRecord, items } = detail;
    const data = {
      res: {
        creditNoteNumber: returnRecord.credit_note_number || returnRecord.return_number,
        returnNumber: returnRecord.return_number,
        grandTotal: returnRecord.refund_amount || returnRecord.grand_total || 0
      },
      invoice: {
        sales: {
          invoice_number: returnRecord.invoice_number,
          customer_name: returnRecord.customer_name,
          customer_mobile: returnRecord.customer_mobile
        }
      },
      customer: {
        name: returnRecord.customer_name,
        mobile: returnRecord.customer_mobile
      },
      returnItemsList: (items || []).map((i: any) => ({
        product_name: i.product_name,
        returnQty: i.quantity,
        unit: i.unit || 'Pcs',
        rate: i.rate
      })),
      resolution: returnRecord.return_type || 'Sales Return'
    };
    printCreditNotePDF(data);
  };

  useEffect(() => {
    if (tab === 'history') loadSalesHistory();
    else loadReturnsHistory();
  }, [tab, startDate, endDate, selectedCategory]);

  // Load Single Invoice Details
  const handleViewInvoice = async (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsLoadingDetails(true);
    setInvoiceDetails(null);
    try {
      const res = await apiRequest(`/api/sales/${invoice.id}`);
      setInvoiceDetails(res);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to load invoice details.' });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async () => {
    if (!selectedInvoice || !cancelReason.trim()) return;
    setIsCancelling(true);
    setFeedbackMsg(null);
    try {
      await apiRequest(`/api/sales/${selectedInvoice.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });
      setFeedbackMsg({ type: 'success', text: `Invoice ${selectedInvoice.invoice_number} cancelled and stock restored.` });
      setShowCancelModal(false);
      setSelectedInvoice(null);
      setInvoiceDetails(null);
      loadSalesHistory();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to cancel invoice.' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Open New Return Modal & Preload Recent Invoices / Customers
  const openNewReturnModal = async (initialInvoice?: any) => {
    setShowNewReturnModal(true);
    setReturnCustomerSearch('');
    setReturnInvoiceSearch('');
    setReturnReason('Farmer Returned Unused');
    setReturnResolution('Credit Note');
    setCustomRefundAmt(0);
    setIsDefectivePackage(false);
    setExchangeCart([]);

    if (initialInvoice) {
      handleSelectInvoiceForReturn(initialInvoice);
      return;
    }

    setSelectedReturnInvoice(null);
    setSelectedReturnCustomer(null);
    try {
      const [salesRes, custRes] = await Promise.all([
        apiRequest('/api/sales'),
        apiRequest('/api/customers')
      ]);
      setMatchedInvoices((salesRes.sales || []).filter((s: any) => s.status !== 'Cancelled').slice(0, 20));
      setMatchedCustomers((custRes.customers || []).slice(0, 15));
    } catch (err) {
      console.error('Failed to pre-populate return modal data:', err);
    }
  };

  // Search Customer for Return
  const handleSearchReturnCustomers = async (val: string) => {
    setReturnCustomerSearch(val);
    try {
      const url = val && val.trim().length > 0 ? `/api/customers?search=${encodeURIComponent(val.trim())}` : '/api/customers';
      const res = await apiRequest(url);
      setMatchedCustomers((res.customers || []).slice(0, 25));
    } catch (err) {
      setMatchedCustomers([]);
    }
  };

  // Select Customer & Fetch Customer Invoices
  const handleSelectCustomerForReturn = async (cust: any) => {
    setSelectedReturnCustomer(cust);
    setIsLoadingCustomerInvoices(true);
    setSelectedReturnInvoice(null);
    try {
      const res = await apiRequest(`/api/sales?customer_id=${cust.id}`);
      setCustomerInvoices((res.sales || []).filter((s: any) => s.status !== 'Cancelled'));
    } catch (err) {
      setCustomerInvoices([]);
    } finally {
      setIsLoadingCustomerInvoices(false);
    }
  };

  // Search Invoices directly
  const handleSearchReturnInvoices = async (val: string) => {
    setReturnInvoiceSearch(val);
    try {
      const url = val && val.trim().length > 0 ? `/api/sales?search=${encodeURIComponent(val.trim())}` : '/api/sales';
      const res = await apiRequest(url);
      setMatchedInvoices((res.sales || []).filter((s: any) => s.status !== 'Cancelled').slice(0, 25));
    } catch (err) {
      setMatchedInvoices([]);
    }
  };

  // Select Invoice for Return
  const handleSelectInvoiceForReturn = async (inv: any) => {
    try {
      const res = await apiRequest(`/api/sales/${inv.id}`);
      setSelectedReturnInvoice(res);
      // Initialize return quantities
      const initialQtyMap: { [key: string]: number } = {};
      (res.items || []).forEach((item: any) => {
        initialQtyMap[item.id] = 0;
      });
      setReturnItems(initialQtyMap);
      setExchangeCart([]);

      // If invoice has customer, pre-fill customer
      if (res.sales && res.sales.customer_id) {
        try {
          const custRes = await apiRequest(`/api/customers/${res.sales.customer_id}`);
          if (custRes.customer) setSelectedReturnCustomer(custRes.customer);
        } catch (_) {}
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Failed to fetch invoice items for return.' });
    }
  };

  // Search Products for Sale Exchange
  const handleSearchExchangeProducts = async (val: string) => {
    setExchangeSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setExchangeProductResults([]);
      return;
    }
    try {
      const res = await apiRequest(`/api/pos/products?search=${encodeURIComponent(val)}`);
      const prods = Array.isArray(res) ? res : (res.products || []);
      setExchangeProductResults(prods);
    } catch (err) {
      setExchangeProductResults([]);
    }
  };

  // Add Item to Exchange Cart
  const handleAddExchangeItem = (prod: any) => {
    const existing = exchangeCart.find((item) => item.product_id === prod.id);
    if (existing) {
      setExchangeCart(exchangeCart.map((i) => i.product_id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      const activeBatches = prod.activeBatches || prod.active_batches || prod.availableBatches || [];
      const batch = activeBatches.length > 0 ? activeBatches[0] : (prod.selectedBatch || null);
      const price = batch ? (batch.selling_price || batch.mrp || prod.selling_price || 100) : (prod.selling_price || 100);
      
      setExchangeCart([...exchangeCart, {
        product_id: prod.id,
        name: prod.name,
        rate: price,
        unit: prod.unit || 'Pcs',
        quantity: 1,
        stock: prod.stockQty || prod.stock_qty || (batch ? batch.current_qty : 0),
        batch_id: batch ? batch.id : undefined
      }]);
    }
    setExchangeSearchQuery('');
    setExchangeProductResults([]);
  };

  // Calculate return items value
  const calculateReturnTotal = () => {
    if (!selectedReturnInvoice || !selectedReturnInvoice.items) return 0;
    return selectedReturnInvoice.items.reduce((sum: number, item: any) => {
      const qty = returnItems[item.id] || 0;
      return sum + (qty * item.rate);
    }, 0);
  };

  // Calculate exchange cart total
  const calculateExchangeTotal = () => {
    return exchangeCart.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  // Submit Sales Return
  const handleProcessReturn = async () => {
    if (!selectedReturnInvoice) return;

    const returnPayloadItems = Object.entries(returnItems)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([itemId, qty]) => ({
        sales_item_id: itemId,
        quantity: Number(qty)
      }));

    if (returnPayloadItems.length === 0) {
      alert('Please select at least one item with a return quantity > 0.');
      return;
    }

    if (returnResolution === 'Credit Note' && !selectedReturnCustomer && !selectedReturnInvoice.sales.customer_id) {
      alert('A registered customer is required to issue a Credit Note against Udhaar khata. Please search and select a customer.');
      return;
    }

    setIsSubmittingReturn(true);
    setFeedbackMsg(null);

    try {
      const payload = {
        sales_id: selectedReturnInvoice.sales.id,
        customer_id: selectedReturnCustomer?.id || selectedReturnInvoice.sales.customer_id || null,
        return_type: returnResolution,
        reason: returnReason,
        is_defective: isDefectivePackage || returnResolution === 'Same Defective Exchange',
        refund_amount: returnResolution === 'Partial Refund'
          ? customRefundAmt
          : (returnResolution === 'Full Refund' ? calculateReturnTotal() : (returnResolution === 'Sale Exchange' ? Math.max(0, calculateReturnTotal() - calculateExchangeTotal()) : 0)),
        items: returnPayloadItems,
        exchange_items: exchangeCart.map((item) => ({
          product_id: item.product_id,
          batch_id: item.batch_id,
          quantity: item.quantity,
          rate: item.rate,
          unit: item.unit
        }))
      };

      const res = await apiRequest('/api/sales/returns', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const returnedLineItems = selectedReturnInvoice.items
        .filter((item: any) => returnItems[item.id] > 0)
        .map((item: any) => ({
          ...item,
          returnQty: returnItems[item.id]
        }));

      setCompletedReturnData({
        res,
        invoice: selectedReturnInvoice,
        customer: selectedReturnCustomer,
        returnItemsList: returnedLineItems,
        resolution: returnResolution,
        exchangeCart
      });

      setFeedbackMsg({
        type: 'success',
        text: `Sales return processed successfully! ${res.creditNoteNumber ? 'Credit Note #' + res.creditNoteNumber + ' recorded against customer Udhaar khata.' : ''}`
      });

      setShowNewReturnModal(false);
      setShowSuccessReturnModal(true);
      loadReturnsHistory();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to process return.' });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Thermal Credit Note Printing
  const printCreditNoteThermal = (data: any) => {
    if (!data) return;
    const { res, invoice, customer, returnItemsList, resolution } = data;
    const cnNo = res?.creditNoteNumber || res?.returnNumber || 'CN-N/A';

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = (returnItemsList || []).map((item: any) => `
      <tr>
        <td style="padding: 2px 0; font-weight: bold;" colSpan="4">${item.product_name}</td>
      </tr>
      <tr style="border-bottom: 1px dashed #aaa;">
        <td style="padding: 2px 0;">Qty: ${item.returnQty} ${item.unit}</td>
        <td style="text-align: right;">@ ₹${item.rate}</td>
        <td style="text-align: right; font-weight: bold;" colSpan="2">₹${(item.returnQty * item.rate).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Credit Note - ${cnNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; width: 76mm; margin: 0 auto; padding: 5mm; font-size: 11px; color: #000; line-height: 1.2; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-bottom: 2px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 13px;" class="bold">SHRI REVANASIDDESHWARA AGRO CENTER</div>
          <div>Main Road, Kalaghatagi - 581204</div>
          <div>Phone: +91 9844012345 | GSTIN: 29AABCA1234F1Z2</div>
        </div>
        <div class="double-divider"></div>
        <div class="bold text-center" style="font-size: 12px; margin: 2px 0;">OFFICIAL CREDIT NOTE / RETURN</div>
        <div class="divider"></div>
        <div>Credit Note #: <span class="bold">${cnNo}</span></div>
        <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        <div>Original Inv #: ${invoice?.sales?.invoice_number || 'N/A'}</div>
        <div>Resolution: <span class="bold">${resolution}</span></div>
        <div>Customer: <span class="bold">${customer?.name || invoice?.sales?.customer_name || 'Walk-in Customer'}</span></div>
        ${customer?.mobile ? `<div>Mobile: ${customer.mobile}</div>` : ''}
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Returned Item</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="double-divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;" class="bold">
          <span>TOTAL CREDIT:</span>
          <span>₹${(res?.grandTotal || 0).toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div style="font-size: 10px; font-style: italic;">
          * Recorded against customer Udhaar ledger.
        </div>
        <br/><br/>
        <div style="display: flex; justify-content: space-between; margin-top: 15px;">
          <div>Customer Sign</div>
          <div>Authorized Signatory</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // PDF Credit Note Printing
  const printCreditNotePDF = (data: any) => {
    if (!data) return;
    const { res, invoice, customer, returnItemsList, resolution } = data;
    const cnNo = res?.creditNoteNumber || res?.returnNumber || 'CN-N/A';

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SHRI REVANASIDDESHWARA AGRO CENTER', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Main Road, Kalaghatagi - 581204 | Phone: +91 9844012345', 105, 21, { align: 'center' });
    doc.text('GSTIN: 29AABCA1234F1Z2 | License: KLG/AGR/2024/88', 105, 26, { align: 'center' });

    doc.line(14, 30, 196, 30);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL CREDIT NOTE', 105, 37, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Credit Note No: ${cnNo}`, 14, 46);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 52);
    doc.text(`Resolution Type: ${resolution}`, 14, 58);
    doc.text(`Original Invoice No: ${invoice?.sales?.invoice_number || 'N/A'}`, 140, 46);

    doc.text(`Customer Name: ${customer?.name || invoice?.sales?.customer_name || 'Walk-in Customer'}`, 14, 66);
    doc.text(`Mobile: ${customer?.mobile || invoice?.sales?.customer_mobile || 'N/A'}`, 140, 66);

    const tableRows = (returnItemsList || []).map((item: any) => [
      item.product_name,
      `${item.returnQty} ${item.unit}`,
      `₹${item.rate}`,
      `₹${(item.returnQty * item.rate).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['Product Name', 'Return Qty', 'Unit Rate', 'Total Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Credit Value: ₹${(res?.grandTotal || 0).toFixed(2)}`, 140, finalY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('* Note: This credit note is officially recorded against customer Udhaar account ledger.', 14, finalY + 8);

    doc.setFont('helvetica', 'normal');
    doc.text('Customer Signature', 14, finalY + 30);
    doc.text('Authorized Signatory', 140, finalY + 30);

    doc.save(`Credit_Note_${cnNo}.pdf`);
  };

  // Thermal Receipt Printing
  const printThermalReceipt = (invData: any) => {
    if (!invData || !invData.sales || !invData.items) return;
    const { sales, items } = invData;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 2px 0; font-weight: bold;" colSpan="4">${item.product_name}</td>
      </tr>
      <tr style="border-bottom: 1px dashed #aaa;">
        <td style="padding: 2px 0; font-size: 9px; color: #555;">${item.batch_number ? `Batch: ${item.batch_number} (Exp: ${item.expiry_date || 'N/A'})` : 'Standard'}</td>
        <td style="text-align: center;">${item.quantity} ${item.unit}</td>
        <td style="text-align: right;">₹${item.rate}</td>
        <td style="text-align: right; font-weight: bold;">₹${item.total_amount.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thermal Receipt - ${sales.invoice_number}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; width: 76mm; margin: 0 auto; padding: 5mm; font-size: 11px; color: #000; line-height: 1.2; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-bottom: 2px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
          .total-row { font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 13px;" class="bold">SHRI REVANASIDDESHWARA AGRO CENTER</div>
          <div>Main Road, Kalaghatagi - 581204</div>
          <div>Phone: +91 9844012345 | GSTIN: 29AABCA1234F1Z2</div>
        </div>
        <div class="double-divider"></div>
        <div class="bold text-center">TAX INVOICE</div>
        <div>Inv No: <span class="bold">${sales.invoice_number}</span></div>
        <div>Date  : ${sales.invoice_date}</div>
        <div>Cust  : ${sales.customer_name || 'Walk-in Customer'}</div>
        <div>Pay   : ${sales.payment_mode}</div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr><th>Item</th><th style="text-align: center;">Qty</th><th style="text-align: right;">Rate</th><th style="text-align: right;">Total</th></tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr><td>Taxable Value:</td><td class="text-right">₹${sales.taxable_value.toFixed(2)}</td></tr>
          <tr><td>GST Tax:</td><td class="text-right">₹${sales.total_tax.toFixed(2)}</td></tr>
          <tr class="total-row"><td style="padding-top: 4px;">GRAND TOTAL:</td><td class="text-right" style="padding-top: 4px; font-size: 14px;">₹${sales.grand_total.toFixed(2)}</td></tr>
        </table>
        <div class="double-divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          <div>*** THANK YOU FOR YOUR VISIT ***</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // PDF Invoice Download
  const generatePdfInvoice = (invData: any) => {
    if (!invData || !invData.sales || !invData.items) return;
    const { sales, items } = invData;
    const doc = new jsPDF();

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('SHRI REVANASIDDESHWARA AGRO CENTER', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Main Road, Kalaghatagi, Dharwad Dist, Karnataka - 581204 | Ph: +91 9844012345', 14, 24);

    doc.line(14, 28, 196, 28);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`GST TAX INVOICE: ${sales.invoice_number}`, 14, 36);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${sales.invoice_date}`, 140, 36);
    doc.text(`Customer: ${sales.customer_name || 'Walk-in Customer'}`, 14, 43);

    const tableData = items.map((item: any, i: number) => [
      i + 1,
      item.product_name,
      item.batch_number ? `${item.batch_number} (Exp: ${item.expiry_date || 'N/A'})` : 'Standard',
      `${item.quantity} ${item.unit}`,
      `₹${item.rate}`,
      `₹${item.discount || 0}`,
      `₹${item.taxable_value.toFixed(2)}`,
      `₹${item.total_amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['#', 'Item Description', 'Batch / Expiry', 'Qty', 'Rate', 'Disc', 'Taxable', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Taxable Value: ₹${sales.taxable_value.toFixed(2)}`, 130, finalY);
    doc.text(`Total GST: ₹${sales.total_tax.toFixed(2)}`, 130, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ₹${sales.grand_total.toFixed(2)}`, 130, finalY + 12);

    doc.save(`Invoice_${sales.invoice_number}.pdf`);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)]">
      {/* Header & Subtab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            {tab === 'history' ? <FileText className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              {tab === 'history' ? 'Sales History & Invoices' : 'Sales Returns & Exchanges'}
            </h1>
            <p className="text-xs text-slate-400">
              {tab === 'history'
                ? 'Search, inspect, re-print or manage customer billing history'
                : 'Process product returns, refunds, batch restocking, and credit notes'}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'history'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Sales History</span>
          </button>
          <button
            onClick={() => setTab('returns')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              tab === 'returns'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Sales Returns</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center space-x-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: SALES HISTORY */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar with Quick Presets & Category Selector */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
            {/* Quick Date Presets Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Quick Date Filter:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'daily', label: 'Daily (Today)' },
                  { id: 'weekly', label: 'Weekly (7 Days)' },
                  { id: 'monthly', label: 'Monthly (This Month)' },
                  { id: 'yearly', label: 'Yearly (This Year)' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyDatePreset(p.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      dateRangePreset === p.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Invoice #, Customer Name or Mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadSalesHistory()}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Custom Date Range Picker */}
                <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 font-medium">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateRangePreset('custom');
                    }}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateRangePreset('custom');
                    }}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Product Category Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-950 text-xs text-slate-200 focus:outline-none cursor-pointer border-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                    setSelectedCategory('');
                    setDateRangePreset('all');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={loadSalesHistory}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Apply Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sales History Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Invoice No & Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Type / Payment</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-right">Paid Amount</th>
                    <th className="p-3 text-right">Balance Due</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoadingSales ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                        <span>Loading sales records...</span>
                      </td>
                    </tr>
                  ) : salesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <span>No sales invoices found matching filters.</span>
                      </td>
                    </tr>
                  ) : (
                    salesList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="font-mono text-emerald-400 font-bold">{s.invoice_number}</div>
                          <div className="text-[10px] text-slate-400">{s.invoice_date}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-100">{s.customer_name || 'Walk-in Retail Customer'}</div>
                          {s.customer_mobile && <div className="text-[10px] text-slate-400">Mob: {s.customer_mobile}</div>}
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-medium text-slate-300">
                            {s.invoice_type || 'B2C'}
                          </span>
                          <div className="text-[10px] text-emerald-400 font-medium mt-0.5">{s.payment_mode}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-100">₹{s.grand_total.toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-400 font-semibold">₹{(s.amount_received || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold">
                          <span className={s.balance_due > 0 ? "text-amber-400" : "text-slate-400"}>
                            ₹{(s.balance_due || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'Cancelled'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleViewInvoice(s)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-medium text-[11px] inline-flex items-center space-x-1 border border-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Inspect</span>
                            </button>
                            {s.status !== 'Cancelled' && (
                              <button
                                onClick={() => openNewReturnModal(s)}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg font-medium text-[11px] inline-flex items-center space-x-1 border border-amber-500/30"
                                title="Return or Exchange items from this invoice"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                <span>Return</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES RETURNS & EXCHANGES */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {/* Filters Bar with Quick Presets & Category Selector */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
            {/* Quick Date Presets Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Quick Date Filter:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'daily', label: 'Daily (Today)' },
                  { id: 'weekly', label: 'Weekly (7 Days)' },
                  { id: 'monthly', label: 'Monthly (This Month)' },
                  { id: 'yearly', label: 'Yearly (This Year)' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyDatePreset(p.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      dateRangePreset === p.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Return #, Invoice #, Customer Name or Mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadReturnsHistory()}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Custom Date Range Picker */}
                <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 font-medium">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateRangePreset('custom');
                    }}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateRangePreset('custom');
                    }}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Product Category Filter */}
                <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-950 text-xs text-slate-200 focus:outline-none cursor-pointer border-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                    setSelectedCategory('');
                    setDateRangePreset('all');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={loadReturnsHistory}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Apply Filters</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Sales Return Records & Credit Notes</h2>
              <p className="text-xs text-slate-400">Processed product returns and batch inventory adjustments</p>
            </div>
            <button
              onClick={() => openNewReturnModal()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg shadow-emerald-900/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Process New Sales Return</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Return # & Date</th>
                    <th className="p-3">Original Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Return Reason</th>
                    <th className="p-3 text-right">Taxable Value</th>
                    <th className="p-3 text-right">Total GST</th>
                    <th className="p-3 text-right">Refund Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoadingReturns ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                        <span>Loading returns history...</span>
                      </td>
                    </tr>
                  ) : returnsList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-500">
                        <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <span>No sales return records found.</span>
                      </td>
                    </tr>
                  ) : (
                    returnsList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/50">
                        <td className="p-3 font-medium">
                          <div className="font-mono text-emerald-400 font-bold">{r.return_number}</div>
                          <div className="text-[10px] text-slate-400">{r.return_date}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-slate-200 font-bold flex items-center space-x-1">
                            <span className="text-[10px] text-slate-400">Inv:</span>
                            <span className="text-emerald-400">{r.invoice_number}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                            {r.orig_invoice_date && <span>Date: {r.orig_invoice_date}</span>}
                            {r.orig_payment_mode && <span className="text-amber-400">({r.orig_payment_mode})</span>}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-100">{r.customer_name || 'Walk-in Retail Customer'}</td>
                        <td className="p-3 text-slate-300">{r.reason}</td>
                        <td className="p-3 text-right font-medium text-slate-300">₹{r.taxable_value.toFixed(2)}</td>
                        <td className="p-3 text-right font-medium text-slate-300">₹{r.total_tax.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-emerald-400 text-sm">₹{r.refund_amount.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {r.status || 'Completed'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleViewReturnDetails(r)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-medium text-[11px] inline-flex items-center space-x-1 border border-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: VIEW & INSPECT INVOICE DETAILS */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <span>Sales Invoice Details</span>
                  <span className="font-mono text-emerald-400 text-sm">({selectedInvoice.invoice_number})</span>
                </h3>
                <p className="text-xs text-slate-400">Invoice Date: {selectedInvoice.invoice_date}</p>
              </div>
              <button
                onClick={() => { setSelectedInvoice(null); setInvoiceDetails(null); }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading line items...</span>
              </div>
            ) : invoiceDetails ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Customer & Payment Info Header */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer Name:</span>
                    <strong className="text-slate-100 text-sm">{invoiceDetails.sales.customer_name || 'Walk-in Retail Customer'}</strong>
                    {invoiceDetails.sales.customer_mobile && (
                      <div className="text-slate-400 text-[11px]">Mobile: {invoiceDetails.sales.customer_mobile}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Payment Mode & Status:</span>
                    <strong className="text-emerald-400 text-sm">{invoiceDetails.sales.payment_mode}</strong>
                    <div className="text-[11px] text-slate-300">
                      Paid: ₹{(invoiceDetails.sales.amount_received || 0).toFixed(2)} | Due: ₹{(invoiceDetails.sales.balance_due || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Seller Internal Note Box (Exclusive for Seller) */}
                {invoiceDetails.sales.notes && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-amber-300 flex items-center space-x-1 text-[11px]">
                      <span>Seller Private Internal Note (Confidential):</span>
                    </div>
                    <p className="text-slate-200 italic">{invoiceDetails.sales.notes}</p>
                  </div>
                )}

                {/* Items Table with Full Product Verification Details */}
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="p-2.5">Product & Batch Details</th>
                        <th className="p-2.5 text-center">HSN Code</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Rate</th>
                        <th className="p-2.5 text-right">Disc</th>
                        <th className="p-2.5 text-right">GST Tax</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                      {invoiceDetails.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-100">{item.product_name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                              <span className="font-mono text-amber-300">Batch: {item.batch_number || 'Standard'}</span>
                              {item.expiry_date && <span>Exp: {item.expiry_date}</span>}
                              {item.sku && <span>SKU: {item.sku}</span>}
                              {item.pack_size && <span>Pack: {item.pack_size}</span>}
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-slate-800 text-amber-300 font-bold border border-slate-700">
                              {item.hsn_code || 'N/A'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-200">{item.quantity} {item.unit}</td>
                          <td className="p-2.5 text-right text-slate-300">₹{item.rate}</td>
                          <td className="p-2.5 text-right text-amber-300">₹{item.discount || 0}</td>
                          <td className="p-2.5 text-right text-slate-400">
                            ₹{(item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">₹{item.total_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-right">
                  <div><span className="text-slate-400">Taxable Value: </span><span className="font-semibold text-slate-200">₹{invoiceDetails.sales.taxable_value.toFixed(2)}</span></div>
                  <div><span className="text-slate-400">Total GST Tax: </span><span className="font-semibold text-slate-200">₹{invoiceDetails.sales.total_tax.toFixed(2)}</span></div>
                  <div className="text-sm font-bold text-emerald-400 pt-1 border-t border-slate-800">
                    Grand Total: ₹{invoiceDetails.sales.grand_total.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => printThermalReceipt(invoiceDetails)}
                  disabled={!invoiceDetails}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Thermal Receipt</span>
                </button>

                <button
                  onClick={() => generatePdfInvoice(invoiceDetails)}
                  disabled={!invoiceDetails}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {selectedInvoice.status !== 'Cancelled' && (
                  <button
                    onClick={() => {
                      const inv = selectedInvoice;
                      setSelectedInvoice(null);
                      setInvoiceDetails(null);
                      openNewReturnModal(inv);
                    }}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return / Exchange</span>
                  </button>
                )}

                {selectedInvoice.status !== 'Cancelled' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Cancel / Reverse Invoice</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCEL INVOICE CONFIRMATION */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Cancel & Reverse Invoice</h3>
            </div>

            <p className="text-xs text-slate-300">
              Cancelling invoice <strong className="text-emerald-400 font-mono">{selectedInvoice?.invoice_number}</strong> will automatically restore stock to product batches and reverse customer credit balances.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 block">Reason for Cancellation</label>
              <textarea
                rows={3}
                placeholder="Specify reason (e.g. Billed wrong items / Duplicate bill / Customer cancelled)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCancelInvoice}
                disabled={isCancelling || !cancelReason.trim()}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                {isCancelling ? 'Processing Reversal...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PROCESS NEW SALES RETURN & CREDIT NOTE */}
      {showNewReturnModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                  <span>Process Product Return & Credit Note</span>
                </h3>
                <p className="text-xs text-slate-400">Search customer or invoice, set return items, and choose resolution option</p>
              </div>
              <button onClick={() => setShowNewReturnModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Step 1: Customer Search or Direct Invoice Search */}
              {!selectedReturnInvoice ? (
                <div className="space-y-4">
                  {/* Mode Toggle */}
                  <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
                    <button
                      type="button"
                      onClick={() => setReturnSearchMode('customer')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                        returnSearchMode === 'customer'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Search Customer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnSearchMode('invoice')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                        returnSearchMode === 'invoice'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Search Invoice #</span>
                    </button>
                  </div>

                  {returnSearchMode === 'customer' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-200 block">Search Customer by Name, Phone or Village</label>
                        <input
                          type="text"
                          placeholder="Type customer name, phone number or village..."
                          value={returnCustomerSearch}
                          onChange={(e) => handleSearchReturnCustomers(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Customer Results List */}
                      {matchedCustomers.length > 0 && !selectedReturnCustomer && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          <span className="text-[10px] text-slate-400 font-semibold block">Select Customer:</span>
                          {matchedCustomers.map((cust) => (
                            <div
                              key={cust.id}
                              onClick={() => handleSelectCustomerForReturn(cust)}
                              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div>
                                <div className="font-bold text-slate-100">{cust.name}</div>
                                <div className="text-[11px] text-slate-400">{cust.mobile || 'No Phone'} {cust.village ? `• ${cust.village}` : ''}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-400">Current Udhaar:</div>
                                <div className="font-bold text-rose-400">₹{(cust.current_outstanding || 0).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selected Customer Header & Invoices List */}
                      {selectedReturnCustomer && (
                        <div className="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 text-[10px]">Customer Selected:</span>
                              <div className="font-bold text-emerald-400 text-sm">{selectedReturnCustomer.name}</div>
                              <div className="text-[11px] text-slate-300">
                                Mobile: {selectedReturnCustomer.mobile || 'N/A'} • Udhaar Balance: ₹{(selectedReturnCustomer.current_outstanding || 0).toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedReturnCustomer(null); setCustomerInvoices([]); }}
                              className="text-xs text-rose-400 hover:underline"
                            >
                              Change Customer
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-200 block">Select Invoice to Return Items From:</span>
                            {isLoadingCustomerInvoices ? (
                              <div className="text-center py-4 text-slate-400">
                                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-400" />
                                Loading customer invoices...
                              </div>
                            ) : customerInvoices.length === 0 ? (
                              <div className="text-center py-3 text-slate-400 italic text-xs">
                                No active invoices found for this customer.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                {customerInvoices.map((inv) => (
                                  <div
                                    key={inv.id}
                                    onClick={() => handleSelectInvoiceForReturn(inv)}
                                    className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                                  >
                                    <div>
                                      <div className="font-bold text-emerald-400 font-mono">{inv.invoice_number}</div>
                                      <div className="text-[10px] text-slate-400">Date: {inv.invoice_date} • Mode: {inv.payment_mode}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-slate-100">₹{inv.grand_total.toFixed(2)}</div>
                                      <div className="text-[10px] text-emerald-400">Select Invoice &rarr;</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Invoice Search Mode */
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-200 block">Search Invoice Number</label>
                        <input
                          type="text"
                          placeholder="Type Invoice Number (e.g. INV-2026-001)..."
                          value={returnInvoiceSearch}
                          onChange={(e) => handleSearchReturnInvoices(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {matchedInvoices.map((inv) => (
                          <div
                            key={inv.id}
                            onClick={() => handleSelectInvoiceForReturn(inv)}
                            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="font-bold text-emerald-400 font-mono">{inv.invoice_number}</div>
                              <div className="text-[11px] text-slate-300">{inv.customer_name || 'Walk-in Customer'} ({inv.invoice_date})</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-slate-100">₹{inv.grand_total.toFixed(2)}</div>
                              <div className="text-[10px] text-emerald-400">Select Invoice &rarr;</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Select Items & Return Resolution */
                <div className="space-y-4">
                  {/* Tagged Selected Invoice Banner */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-emerald-400">🏷️ Tagged Original Sales Invoice</span>
                        <span className="font-mono text-xs font-bold bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                          {selectedReturnInvoice.sales.invoice_number}
                        </span>
                      </div>
                      <button
                        onClick={() => { setSelectedReturnInvoice(null); setReturnItems({}); setExchangeCart([]); }}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Change Invoice
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Invoice Date:</span>
                        <span className="text-slate-200 font-semibold">{selectedReturnInvoice.sales.invoice_date || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Payment Mode:</span>
                        <span className="text-amber-300 font-bold">{selectedReturnInvoice.sales.payment_mode || 'Cash'}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Original Total:</span>
                        <span className="text-emerald-400 font-mono font-bold">₹{selectedReturnInvoice.sales.grand_total?.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Billed By:</span>
                        <span className="text-slate-200">{selectedReturnInvoice.sales.created_by || 'Cashier'}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 pt-0.5">
                      <span className="text-slate-400">Customer: </span>
                      <strong className="text-slate-100">{selectedReturnCustomer?.name || selectedReturnInvoice.sales.customer_name || 'Walk-in Retail Customer'}</strong>
                      {selectedReturnCustomer?.mobile && (
                        <span className="text-slate-400 ml-1">({selectedReturnCustomer.mobile})</span>
                      )}
                    </div>
                  </div>

                  {/* Return Reason */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-200 block">Return Reason</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Farmer Returned Unused">Farmer Returned Unused</option>
                      <option value="Defective / Damaged Package">Defective / Damaged Package</option>
                      <option value="Wrong Product Selected">Wrong Product Selected</option>
                      <option value="Expired / Near Expiry">Expired / Near Expiry</option>
                    </select>
                  </div>

                  {/* Return Line Items Selector & Product Origin Verification */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-200 block text-xs">
                        Select Items to Return & Verify Store Purchase Origin
                      </label>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        ✓ Cross-check physical Batch & SKU with invoice records
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {selectedReturnInvoice.items.map((item: any) => {
                        const qty = returnItems[item.id] || 0;
                        const lineVal = qty * item.rate;
                        const isSelected = qty > 0;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all text-xs ${
                              isSelected
                                ? 'bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/30'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center space-x-2 flex-wrap">
                                  <span className="font-bold text-slate-100 text-sm">{item.product_name}</span>
                                  {item.category_name && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      {item.category_name}
                                    </span>
                                  )}
                                  {item.brand_name && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      {item.brand_name}
                                    </span>
                                  )}
                                </div>

                                {/* Product Specifications & Origin Details */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px] text-slate-400">
                                  <div>
                                    <span className="text-slate-500 text-[10px] block">SKU / Code:</span>
                                    <span className="font-mono text-slate-200 font-semibold">{item.sku || item.product_code || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 text-[10px] block">Batch Number:</span>
                                    <span className="font-mono text-amber-300 font-bold">{item.batch_number || 'Standard'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 text-[10px] block">Expiry Date:</span>
                                    <span className={`font-mono ${item.expiry_date ? 'text-slate-200' : 'text-slate-400'}`}>
                                      {item.expiry_date || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 text-[10px] block">Pack Size / Unit:</span>
                                    <span className="text-slate-200">{item.pack_size || item.unit || '1 Unit'}</span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-0.5">
                                  {item.barcode && (
                                    <span>Barcode: <strong className="font-mono text-slate-300">{item.barcode}</strong></span>
                                  )}
                                  {item.crop && (
                                    <span>Crop: <strong className="text-slate-300">{item.crop}</strong></span>
                                  )}
                                  {item.technical_name && (
                                    <span>Comp: <strong className="text-slate-300">{item.technical_name}</strong></span>
                                  )}
                                  <span>HSN: <strong className="font-mono text-slate-300">{item.hsn_code || 'N/A'}</strong></span>
                                </div>
                              </div>

                              {/* Billed Quantity vs Return Quantity Input */}
                              <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 bg-slate-950 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-slate-800 min-w-[140px]">
                                <div className="text-right">
                                  <div className="text-[10px] text-slate-400">Original Billed:</div>
                                  <div className="font-bold text-slate-200">{item.quantity} {item.unit} @ ₹{item.rate}</div>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <label className="text-[10px] text-emerald-400 font-semibold">Return Qty:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    step="1"
                                    value={qty}
                                    onChange={(e) => setReturnItems({
                                      ...returnItems,
                                      [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0))
                                    })}
                                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                                  />
                                </div>

                                {qty > 0 && (
                                  <div className="text-right text-xs font-bold text-emerald-400">
                                    Subtotal: ₹{lineVal.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-right pt-1 font-bold text-slate-200 text-xs">
                      Total Returned Value: <span className="text-emerald-400 text-sm font-mono">₹{calculateReturnTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Return Resolution Type Selector (5 Options) */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="font-semibold text-slate-200 block text-xs">Choose Return Resolution Method:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div
                        onClick={() => setReturnResolution('Credit Note')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          returnResolution === 'Credit Note'
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
                          <span>📜 Issue Printed Credit Note</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Record credit against customer Udhaar ledger. Decreases balance due or creates store credit.
                        </p>
                      </div>

                      <div
                        onClick={() => setReturnResolution('Full Refund')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          returnResolution === 'Full Refund'
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
                          <span>💵 Full Cash/UPI Refund</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Refund complete return value (₹{calculateReturnTotal().toFixed(2)}) directly in cash/UPI.
                        </p>
                      </div>

                      <div
                        onClick={() => setReturnResolution('Partial Refund')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          returnResolution === 'Partial Refund'
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
                          <span>📉 Partial Refund</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Specify a custom partial refund amount after deducting re-stocking or handling fee.
                        </p>
                      </div>

                      <div
                        onClick={() => setReturnResolution('Sale Exchange')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          returnResolution === 'Sale Exchange'
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
                          <span>🔄 Sale Another Product in Exchange</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Select replacement product(s) from inventory. Adjust rate/qty difference automatically.
                        </p>
                      </div>

                      <div
                        onClick={() => {
                          setReturnResolution('Same Defective Exchange');
                          setIsDefectivePackage(true);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all col-span-1 sm:col-span-2 ${
                          returnResolution === 'Same Defective Exchange'
                            ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-amber-400 text-xs flex items-center space-x-1.5">
                          <span>🛠️ Same Product Exchange (Defective / Damaged)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          1-to-1 swap for defective item. Replaces with fresh unit without price difference. Does not restock defective package.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Partial Refund Input */}
                  {returnResolution === 'Partial Refund' && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <label className="text-[11px] font-semibold text-slate-200 block">Specify Partial Refund Amount (₹):</label>
                      <input
                        type="number"
                        min="0"
                        max={calculateReturnTotal()}
                        value={customRefundAmt}
                        onChange={(e) => setCustomRefundAmt(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {/* Sale Exchange Item Search & Cart */}
                  {returnResolution === 'Sale Exchange' && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                      <span className="font-bold text-emerald-400 block text-xs">Select Replacement Exchange Product(s):</span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search replacement product by name or brand..."
                          value={exchangeSearchQuery}
                          onChange={(e) => handleSearchExchangeProducts(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {exchangeProductResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto mt-1 divide-y divide-slate-800">
                            {exchangeProductResults.map((prod) => (
                              <div
                                key={prod.id}
                                onClick={() => handleAddExchangeItem(prod)}
                                className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-100">{prod.name}</div>
                                  <div className="text-[10px] text-slate-400">Stock: {prod.stock_qty || 0} {prod.unit}</div>
                                </div>
                                <div className="font-bold text-emerald-400">₹{prod.selling_price || 100}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Exchange Cart Table */}
                      {exchangeCart.length > 0 && (
                        <div className="space-y-2">
                          <div className="border border-slate-800 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                                <tr>
                                  <th className="p-2">Replacement Product</th>
                                  <th className="p-2 text-center">Qty</th>
                                  <th className="p-2 text-right">Rate</th>
                                  <th className="p-2 text-right">Total</th>
                                  <th className="p-2 text-center">Remove</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 bg-slate-950">
                                {exchangeCart.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="p-2 font-semibold text-slate-100">{item.name}</td>
                                    <td className="p-2 text-center">
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const q = Math.max(1, parseInt(e.target.value) || 1);
                                          setExchangeCart(exchangeCart.map((it, i) => i === idx ? { ...it, quantity: q } : it));
                                        }}
                                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-bold text-slate-100"
                                      />
                                    </td>
                                    <td className="p-2 text-right text-slate-300">₹{item.rate}</td>
                                    <td className="p-2 text-right font-bold text-emerald-400">₹{(item.quantity * item.rate).toFixed(2)}</td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setExchangeCart(exchangeCart.filter((_, i) => i !== idx))}
                                        className="text-rose-400 hover:text-rose-300"
                                      >
                                        <X className="w-4 h-4 mx-auto" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex items-center justify-between text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                            <div>Returned: <strong className="text-slate-100">₹{calculateReturnTotal().toFixed(2)}</strong></div>
                            <div>Exchange Replacement: <strong className="text-emerald-400">₹{calculateExchangeTotal().toFixed(2)}</strong></div>
                            <div className="font-bold">
                              {calculateExchangeTotal() > calculateReturnTotal() ? (
                                <span className="text-amber-400">Customer Pays Extra: ₹{(calculateExchangeTotal() - calculateReturnTotal()).toFixed(2)}</span>
                              ) : (
                                <span className="text-emerald-400">Store Credit / Refund: ₹{(calculateReturnTotal() - calculateExchangeTotal()).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedReturnInvoice && (
              <div className="flex items-center justify-end space-x-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewReturnModal(false)}
                  className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  disabled={isSubmittingReturn}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingReturn ? 'Processing Return...' : 'Complete Return & Issue Credit Note'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: RETURN SUCCESS & PRINT CREDIT NOTE */}
      {showSuccessReturnModal && completedReturnData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-100">Sales Return Completed!</h3>
            <p className="text-xs text-slate-300">
              Return Reference #: <strong className="text-emerald-400 font-mono">{completedReturnData.res.returnNumber}</strong>
              {completedReturnData.res.creditNoteNumber && (
                <span className="block font-bold text-amber-400 mt-1">
                  Credit Note Issued: {completedReturnData.res.creditNoteNumber}
                </span>
              )}
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-left space-y-1">
              <div>Resolution Type: <strong className="text-slate-100">{completedReturnData.resolution}</strong></div>
              <div>Total Return Value: <strong className="text-emerald-400">₹{(completedReturnData.res.grandTotal || 0).toFixed(2)}</strong></div>
              {completedReturnData.customer && (
                <div>Udhaar Khata Recorded for: <strong className="text-slate-100">{completedReturnData.customer.name}</strong></div>
              )}
            </div>

            <div className="flex flex-col space-y-2 pt-2">
              <button
                type="button"
                onClick={() => printCreditNoteThermal(completedReturnData)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2"
              >
                <Receipt className="w-4 h-4" />
                <span>Print Thermal Credit Note Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => printCreditNotePDF(completedReturnData)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Download Official PDF Credit Note</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessReturnModal(false);
                  setCompletedReturnData(null);
                  setSelectedReturnInvoice(null);
                  setSelectedReturnCustomer(null);
                }}
                className="w-full bg-slate-950 hover:bg-slate-900 text-slate-400 text-xs py-2 rounded-xl"
              >
                Close & Return to History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: VIEW & INSPECT RETURN DETAILS */}
      {selectedReturnRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <span>Sales Return Details</span>
                  <span className="font-mono text-emerald-400 text-sm">({selectedReturnRecord.return_number})</span>
                </h3>
                <p className="text-xs text-slate-400">Return Date: {selectedReturnRecord.return_date}</p>
              </div>
              <button
                onClick={() => { setSelectedReturnRecord(null); setReturnDetails(null); }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingReturnDetails ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading return line items...</span>
              </div>
            ) : returnDetails ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Tagged Original Sales Details Banner */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 flex items-center space-x-1.5 text-sm">
                      <span>🏷️ Tagged Original Sales Details</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                      Original Inv #{returnDetails.returnRecord.invoice_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Original Sale Date:</span>
                      <strong className="text-slate-200">{returnDetails.returnRecord.orig_invoice_date || returnDetails.returnRecord.invoice_date || 'N/A'}</strong>
                    </div>
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Orig Payment Mode:</span>
                      <strong className="text-amber-300 font-bold">{returnDetails.returnRecord.orig_payment_mode || 'Cash'}</strong>
                    </div>
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Original Invoice Value:</span>
                      <strong className="text-emerald-400 font-mono font-bold">₹{(returnDetails.returnRecord.orig_grand_total || 0).toFixed(2)}</strong>
                    </div>
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Original Cashier:</span>
                      <strong className="text-slate-200">{returnDetails.returnRecord.orig_cashier || 'Sales Staff'}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px]">Customer: </span>
                      <strong className="text-slate-100">{returnDetails.returnRecord.customer_name || 'Walk-in Customer'}</strong>
                      {returnDetails.returnRecord.customer_mobile && (
                        <span className="text-slate-400 ml-1">({returnDetails.returnRecord.customer_mobile})</span>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <span className="text-slate-400 text-[10px]">Return Type & Status: </span>
                      <strong className="text-emerald-400">{returnDetails.returnRecord.return_type || 'Sales Return'}</strong>
                      {returnDetails.returnRecord.credit_note_number && (
                        <span className="text-amber-400 font-mono ml-2 font-bold">(Credit Note #{returnDetails.returnRecord.credit_note_number})</span>
                      )}
                    </div>
                  </div>
                </div>

                {returnDetails.returnRecord.reason && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 font-medium block mb-0.5">Return Reason / Notes:</span>
                    <p className="text-slate-200">{returnDetails.returnRecord.reason}</p>
                  </div>
                )}

                {/* Returned Line Items with Full Product Origin Verification */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300">Returned Product Specifications & Origin Match:</span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ Verified purchase from Invoice #{returnDetails.returnRecord.invoice_number}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(returnDetails.items || []).map((item: any) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="font-bold text-slate-100 text-sm">{item.product_name}</span>
                              {item.category_name && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {item.category_name}
                                </span>
                              )}
                              {item.brand_name && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {item.brand_name}
                                </span>
                              )}
                            </div>

                            {/* Specifications Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-400">
                              <div>
                                <span className="text-slate-500 text-[10px] block">SKU / Code:</span>
                                <span className="font-mono text-slate-200 font-semibold">{item.sku || item.product_code || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] block">Batch Number:</span>
                                <span className="font-mono text-amber-300 font-bold">{item.batch_number || 'Standard'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] block">Expiry Date:</span>
                                <span className={`font-mono ${item.expiry_date ? 'text-slate-200' : 'text-slate-400'}`}>
                                  {item.expiry_date || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] block">Pack Size / Unit:</span>
                                <span className="text-slate-200">{item.pack_size || item.unit || '1 Unit'}</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-0.5">
                              {item.barcode && <span>Barcode: <strong className="font-mono text-slate-300">{item.barcode}</strong></span>}
                              {item.crop && <span>Crop: <strong className="text-slate-300">{item.crop}</strong></span>}
                              {item.technical_name && <span>Comp: <strong className="text-slate-300">{item.technical_name}</strong></span>}
                              <span>HSN Code: <strong className="font-mono text-slate-300">{item.hsn_code || 'N/A'}</strong></span>
                            </div>
                          </div>

                          <div className="text-right sm:min-w-[130px] bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">Qty Returned:</div>
                            <div className="font-bold text-amber-400 text-sm">{item.quantity} {item.unit || 'Pcs'}</div>
                            <div className="text-[11px] text-slate-300">@ ₹{item.rate} / unit</div>
                            <div className="text-xs font-bold text-emerald-400 mt-0.5">
                              Total: ₹{(item.total_amount || (item.quantity * item.rate)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-right">
                  <div><span className="text-slate-400">Taxable Value: </span><span className="font-semibold text-slate-200">₹{(returnDetails.returnRecord.taxable_value || 0).toFixed(2)}</span></div>
                  <div><span className="text-slate-400">Total GST Tax: </span><span className="font-semibold text-slate-200">₹{(returnDetails.returnRecord.total_tax || 0).toFixed(2)}</span></div>
                  <div className="text-sm font-bold text-emerald-400 pt-1 border-t border-slate-800">
                    Total Return Value: ₹{(returnDetails.returnRecord.grand_total || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePrintReturnThermal(returnDetails)}
                  disabled={!returnDetails}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Thermal Credit Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintReturnPDF(returnDetails)}
                  disabled={!returnDetails}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 border border-slate-700 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedReturnRecord(null); setReturnDetails(null); }}
                className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
