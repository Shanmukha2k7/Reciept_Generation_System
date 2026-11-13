/**
 * ==============================================================================
 * BillBuddy - Enterprise POS & Sales Intelligence System
 * Academic Project for BTech Software Engineering
 * 
 * Strict Role Separation:
 *  - Worker Portal: Dedicated to POS Cashiering, Custom & Catalog Items,
 *    QR Code Payment Verification, and Bill Generation.
 *    Workers have NO access or visibility into the Admin Portal.
 * 
 *  - Admin Portal: Dedicated to Executive Sales Presentations, Pictorial
 *    Product Analytics, Master Catalog Management (Add Products), Store QR
 *    Code Configuration, and Worker Provisioning.
 *    Admins do NOT perform bill payments and cannot switch to worker portal.
 * ==============================================================================
 */

(function () {
  'use strict';

  // ============================================================================
  // 1. CRYPTOGRAPHIC SHA-256 HASH ENGINE
  // ============================================================================
  function sha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i, j;
    let result = '';

    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [];
    const k = [];
    let primeCounter = 0;

    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 300; i += candidate) {
          isComposite[i] = true;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];

        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);

        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash.unshift((temp1 + temp2) | 0);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  // ============================================================================
  // 2. STORAGE KEYS
  // ============================================================================
  const STORAGE_KEYS = {
    STORE_DEFAULT: 'BILLBUDDY_DEFAULT_STORE',
    HISTORY: 'BILLBUDDY_HISTORY',
    USERS: 'BILLBUDDY_USERS',
    SESSION: 'BILLBUDDY_SESSION',
    CATALOG: 'BILLBUDDY_CATALOG',
    QR_CONFIG: 'BILLBUDDY_QR_CONFIG',
    SERVER_DB: 'BILLBUDDY_SERVER_DB'
  };

  // ============================================================================
  // 3. APPLICATION STATE
  // ============================================================================
  const AppState = {
    currentUser: null,
    isBillLocked: true,
    lastVerifiedPayment: null,
    store: {
      name: 'Apex Tech Mart',
      taxId: 'GSTIN: 29AABCU9603R1ZM',
      address: 'Plot 42, Silicon Square, Whitefield, Bengaluru',
      phone: '+91 98765 43210 | support@apextech.in',
      logo: null
    },
    qrConfig: {
      upiId: 'apextech@icici',
      merchantName: 'Apex Tech Mart Enterprises',
      notes: 'Scan with any UPI App: GPay, PhonePe, Paytm, BHIM',
      customQrImage: null
    },
    customer: {
      name: 'Walk-in Customer',
      contact: ''
    },
    meta: {
      receiptNumber: '',
      dateTime: '',
      cashierName: 'Staff',
      currency: '₹',
      paymentMode: 'UPI QR',
      paymentStatus: 'PENDING',
      notes: 'Thank you for your purchase! Goods once sold can be exchanged within 7 days.',
      formatMode: 'thermal'
    },
    items: [],
    billing: {
      subtotal: 0,
      discountType: 'percent',
      discountValue: 0,
      discountAmount: 0,
      taxableAmount: 0,
      taxRate: 18,
      taxAmount: 0,
      grandTotal: 0
    }
  };

  let splashCaptchaCode = '';
  let productBarChartInstance = null;
  let productPieChartInstance = null;
  let presentationChartInstance = null;

  // ============================================================================
  // 4. DOM REFERENCES
  // ============================================================================
  const DOM = {
    // Splash Authentication
    splashAuthOverlay: document.getElementById('splash-auth-overlay'),
    splashEmail: document.getElementById('splash-email'),
    splashPassword: document.getElementById('splash-password'),
    btnSplashSignin: document.getElementById('btn-splash-signin'),

    // Top Header
    headerRoleBadge: document.getElementById('header-role-badge'),
    headerUserWelcome: document.getElementById('header-user-welcome'),
    workerNavControls: document.getElementById('worker-nav-controls'),
    adminNavControls: document.getElementById('admin-nav-controls'),
    btnOpenCatalog: document.getElementById('btn-open-catalog'),
    btnOpenHistory: document.getElementById('btn-open-history'),
    historyBadge: document.getElementById('history-badge'),
    btnLogout: document.getElementById('btn-logout'),

    // View Containers
    viewWorker: document.getElementById('view-worker'),
    viewAdmin: document.getElementById('view-admin'),

    // Worker POS Controls
    storeNameInput: document.getElementById('store-name'),
    storeTaxInput: document.getElementById('store-tax-id'),
    storeAddressInput: document.getElementById('store-address'),
    storePhoneInput: document.getElementById('store-phone'),
    logoUploadInput: document.getElementById('logo-upload-input'),
    logoPreviewImg: document.getElementById('logo-preview-img'),
    logoPlaceholderIcon: document.getElementById('logo-placeholder-icon'),
    btnRemoveLogo: document.getElementById('btn-remove-logo'),
    btnSaveStoreDefault: document.getElementById('btn-save-store-default'),

    receiptNumberInput: document.getElementById('receipt-number'),
    btnRegenReceiptNo: document.getElementById('btn-regen-receipt-no'),
    receiptDateInput: document.getElementById('receipt-date'),
    cashierNameInput: document.getElementById('cashier-name-input'),
    customerNameInput: document.getElementById('customer-name'),
    customerContactInput: document.getElementById('customer-contact'),

    masterCatalogDatalist: document.getElementById('master-catalog-datalist'),
    itemsTbody: document.getElementById('items-tbody'),
    itemsEmptyState: document.getElementById('items-empty-state'),
    btnAddItem: document.getElementById('btn-add-item'),
    btnPickCatalogRow: document.getElementById('btn-pick-catalog-row'),
    btnQuickCatalogPicker: document.getElementById('btn-quick-catalog-picker'),
    btnClearItems: document.getElementById('btn-clear-items'),
    itemCountLabel: document.getElementById('item-count-label'),

    currencySelect: document.getElementById('currency-select'),
    currencyLabels: document.querySelectorAll('.currency-label'),
    btnDiscountPercent: document.getElementById('btn-discount-percent'),
    btnDiscountFlat: document.getElementById('btn-discount-flat'),
    discountValueInput: document.getElementById('discount-value'),
    discountSymbolIndicator: document.getElementById('discount-symbol-indicator'),
    taxPresetSelect: document.getElementById('tax-preset-select'),
    taxCustomInput: document.getElementById('tax-custom-input'),
    receiptNotesInput: document.getElementById('receipt-notes'),

    formGrandTotalPreview: document.getElementById('form-grand-total-preview'),
    btnProceedToPayment: document.getElementById('btn-proceed-to-payment'),

    // Receipt Preview & Locked Bill Overlay
    receiptLockedOverlay: document.getElementById('receipt-locked-overlay'),
    btnOverlayOpenPayment: document.getElementById('btn-overlay-open-payment'),
    billStatusPill: document.getElementById('bill-status-pill'),
    receiptPaper: document.getElementById('receipt-paper'),
    btnFormatThermal: document.getElementById('btn-format-thermal'),
    btnFormatA4: document.getElementById('btn-format-a4'),
    pvLogoContainer: document.getElementById('pv-logo-container'),
    pvLogoImg: document.getElementById('pv-logo-img'),
    pvStoreName: document.getElementById('pv-store-name'),
    pvStoreAddress: document.getElementById('pv-store-address'),
    pvStorePhone: document.getElementById('pv-store-phone'),
    pvStoreTax: document.getElementById('pv-store-tax'),
    pvReceiptNumber: document.getElementById('pv-receipt-number'),
    pvReceiptDate: document.getElementById('pv-receipt-date'),
    pvCashierName: document.getElementById('pv-cashier-name'),
    pvCustomerName: document.getElementById('pv-customer-name'),
    pvCustomerContact: document.getElementById('pv-customer-contact'),
    pvCustomerContactRow: document.getElementById('pv-customer-contact-row'),
    pvItemsTbody: document.getElementById('pv-items-tbody'),
    pvSubtotal: document.getElementById('pv-subtotal'),
    pvDiscountRow: document.getElementById('pv-discount-row'),
    pvDiscountLabel: document.getElementById('pv-discount-label'),
    pvDiscountAmount: document.getElementById('pv-discount-amount'),
    pvTaxableRow: document.getElementById('pv-taxable-row'),
    pvTaxableAmount: document.getElementById('pv-taxable-amount'),
    pvTaxLabel: document.getElementById('pv-tax-label'),
    pvTaxAmount: document.getElementById('pv-tax-amount'),
    pvGrandTotal: document.getElementById('pv-grand-total'),
    pvPaymentBadge: document.getElementById('pv-payment-badge'),
    pvBarcodeNumber: document.getElementById('pv-barcode-number'),
    pvReceiptNotes: document.getElementById('pv-receipt-notes'),
    btnPrint: document.getElementById('btn-print'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    btnResetNewSale: document.getElementById('btn-reset-new-sale'),

    // Multi-Payment Gateway Modal
    paymentModal: document.getElementById('payment-modal'),
    btnClosePaymentModal: document.getElementById('btn-close-payment-modal'),
    btnCancelPayment: document.getElementById('btn-cancel-payment'),
    modalPayAmount: document.getElementById('modal-pay-amount'),
    modalPayReceiptNo: document.getElementById('modal-pay-receipt-no'),

    tabBtnCash: document.getElementById('tab-btn-cash'),
    tabBtnCredit: document.getElementById('tab-btn-credit'),
    tabBtnDebit: document.getElementById('tab-btn-debit'),
    tabBtnUpi: document.getElementById('tab-btn-upi'),

    panelPayCash: document.getElementById('panel-pay-cash'),
    panelPayCredit: document.getElementById('panel-pay-credit'),
    panelPayDebit: document.getElementById('panel-pay-debit'),
    panelPayUpi: document.getElementById('panel-pay-upi'),

    inputCashTendered: document.getElementById('input-cash-tendered'),
    cashChangeAmount: document.getElementById('cash-change-amount'),
    cashStatusIndicator: document.getElementById('cash-status-indicator'),
    btnConfirmCash: document.getElementById('btn-confirm-cash'),

    creditCardNetwork: document.getElementById('credit-card-network'),
    creditCardLast4: document.getElementById('credit-card-last4'),
    creditAuthCode: document.getElementById('credit-auth-code'),
    btnGenerateCreditAuth: document.getElementById('btn-generate-credit-auth'),
    btnConfirmCredit: document.getElementById('btn-confirm-credit'),

    debitCardBank: document.getElementById('debit-card-bank'),
    debitCardLast4: document.getElementById('debit-card-last4'),
    debitAuthCode: document.getElementById('debit-auth-code'),
    btnGenerateDebitAuth: document.getElementById('btn-generate-debit-auth'),
    btnConfirmDebit: document.getElementById('btn-confirm-debit'),

    checkoutQrBox: document.getElementById('checkout-qr-box'),
    checkoutMerchantName: document.getElementById('checkout-merchant-name'),
    checkoutVpa: document.getElementById('checkout-vpa'),
    inputPaymentUtr: document.getElementById('input-payment-utr'),
    btnManualVerifyUtr: document.getElementById('btn-manual-verify-utr'),
    btnSimulateCustomerPaid: document.getElementById('btn-simulate-customer-paid'),

    paymentVerificationStatusBadge: document.getElementById('payment-verification-status-badge'),
    paymentSuccessBanner: document.getElementById('payment-success-banner'),
    paymentSuccessTitle: document.getElementById('payment-success-title'),
    paymentSuccessTxnText: document.getElementById('payment-success-txn-text'),
    paymentSuccessDetailText: document.getElementById('payment-success-detail-text'),
    btnCompleteAndUnlock: document.getElementById('btn-complete-and-unlock'),
    pvPaymentDetails: document.getElementById('pv-payment-details'),

    // Admin Panels & Tabs
    adminNavCompany: document.getElementById('admin-nav-company'),
    adminNavProducts: document.getElementById('admin-nav-products'),
    adminNavCatalog: document.getElementById('admin-nav-catalog'),
    adminNavQrcode: document.getElementById('admin-nav-qrcode'),
    adminNavWorkers: document.getElementById('admin-nav-workers'),
    adminNavAnalytics: document.getElementById('admin-nav-analytics'),
    adminNavServer: document.getElementById('admin-nav-server'),

    adminPanelCompany: document.getElementById('admin-panel-company'),
    adminPanelProducts: document.getElementById('admin-panel-products'),
    adminPanelCatalog: document.getElementById('admin-panel-catalog'),
    adminPanelQrcode: document.getElementById('admin-panel-qrcode'),
    adminPanelWorkers: document.getElementById('admin-panel-workers'),
    adminPanelAnalytics: document.getElementById('admin-panel-analytics'),
    adminPanelServer: document.getElementById('admin-panel-server'),

    // Admin Company Profile Settings
    adminCompanyName: document.getElementById('admin-company-name'),
    adminCompanyTax: document.getElementById('admin-company-tax'),
    adminCompanyAddress: document.getElementById('admin-company-address'),
    adminCompanyPhone: document.getElementById('admin-company-phone'),
    btnAdminSaveCompany: document.getElementById('btn-admin-save-company'),

    // Admin Worker ID Provisioning
    newWorkerId: document.getElementById('new-worker-id'),
    btnAutoWorkerId: document.getElementById('btn-auto-worker-id'),

    // Admin Product Sales & Presentation
    productMonthSelect: document.getElementById('product-month-select'),
    btnOpenSalesPresentation: document.getElementById('btn-open-sales-presentation'),
    chartMonthBadge: document.getElementById('chart-month-badge'),
    monthlyProductsTbody: document.getElementById('monthly-products-tbody'),

    // Presentation Modal Elements
    presentationModal: document.getElementById('presentation-modal'),
    btnClosePresentationModal: document.getElementById('btn-close-presentation-modal'),
    btnClosePresentationModalFooter: document.getElementById('btn-close-presentation-modal-footer'),
    btnPrintPresentation: document.getElementById('btn-print-presentation'),
    presSubtitle: document.getElementById('pres-subtitle'),
    presTopProduct: document.getElementById('pres-top-product'),
    presTopRevenue: document.getElementById('pres-top-revenue'),
    presHighestVolume: document.getElementById('pres-highest-volume'),
    presVolumeUnits: document.getElementById('pres-volume-units'),
    presTotalRevenue: document.getElementById('pres-total-revenue'),
    presTakeawaysList: document.getElementById('pres-takeaways-list'),

    // Admin Master Product Catalog Management (Add Products)
    adminCatNewName: document.getElementById('admin-cat-new-name'),
    adminCatNewCategory: document.getElementById('admin-cat-new-category'),
    adminCatNewPrice: document.getElementById('admin-cat-new-price'),
    btnAdminAddProduct: document.getElementById('btn-admin-add-product'),
    adminCatalogCount: document.getElementById('admin-catalog-count'),
    adminCatalogTbody: document.getElementById('admin-catalog-tbody'),

    // Admin QR Settings
    adminQrUpiId: document.getElementById('admin-qr-upi-id'),
    adminQrMerchantName: document.getElementById('admin-qr-merchant-name'),
    adminQrNotes: document.getElementById('admin-qr-notes'),
    adminCustomQrFile: document.getElementById('admin-custom-qr-file'),
    btnResetDynamicQr: document.getElementById('btn-reset-dynamic-qr'),
    btnSaveQrConfig: document.getElementById('btn-save-qr-config'),
    adminQrRenderBox: document.getElementById('admin-qr-render-box'),
    adminQrPreviewName: document.getElementById('admin-qr-preview-name'),
    adminQrPreviewVpa: document.getElementById('admin-qr-preview-vpa'),

    // Admin Worker Provisioning (No ID, No Password shown)
    newWorkerName: document.getElementById('new-worker-name'),
    newWorkerEmail: document.getElementById('new-worker-email'),
    newWorkerPassword: document.getElementById('new-worker-password'),
    btnCreateWorkerAccount: document.getElementById('btn-create-worker-account'),
    rosterWorkerCount: document.getElementById('roster-worker-count'),
    workerRosterTbody: document.getElementById('worker-roster-tbody'),

    // Admin Sales Overview & Ledger
    adminFilterWorker: document.getElementById('admin-filter-worker'),
    adminTimeBtns: document.querySelectorAll('.admin-time-btn'),
    statTotalRevenue: document.getElementById('stat-total-revenue'),
    statRevenueSubtitle: document.getElementById('stat-revenue-subtitle'),
    statTotalReceipts: document.getElementById('stat-total-receipts'),
    statAvgSale: document.getElementById('stat-avg-sale'),
    statTopWorker: document.getElementById('stat-top-worker'),
    statTopWorkerSub: document.getElementById('stat-top-worker-sub'),
    workerBarsContainer: document.getElementById('worker-bars-container'),
    filteredLedgerCount: document.getElementById('filtered-ledger-count'),
    adminLedgerTbody: document.getElementById('admin-ledger-tbody'),

    // Server DB Tab
    serverDbTbody: document.getElementById('server-db-tbody'),
    btnExportServerJson: document.getElementById('btn-export-server-json'),

    // Catalog & History Modals (Worker)
    catalogModal: document.getElementById('catalog-modal'),
    btnCloseCatalogModal: document.getElementById('btn-close-catalog-modal'),
    btnCloseCatalogModalFooter: document.getElementById('btn-close-catalog-modal-footer'),
    catalogSearchInput: document.getElementById('catalog-search-input'),
    catalogTotalCount: document.getElementById('catalog-total-count'),
    catalogTbody: document.getElementById('catalog-tbody'),

    historyModal: document.getElementById('history-modal'),
    btnCloseHistoryModal: document.getElementById('btn-close-history-modal'),
    btnCloseHistoryModalFooter: document.getElementById('btn-close-history-modal-footer'),
    historySearchInput: document.getElementById('history-search-input'),
    historyTbody: document.getElementById('history-tbody'),
    historyListEmpty: document.getElementById('history-list-empty'),
    historyTotalCount: document.getElementById('history-total-count'),
    btnExportHistoryJson: document.getElementById('btn-export-history-json'),
    btnClearAllHistory: document.getElementById('btn-clear-all-history'),

    toastContainer: document.getElementById('toast-container')
  };

  // ============================================================================
  // 5. TOAST NOTIFICATION SERVICE
  // ============================================================================
  const Toast = {
    show(message, type = 'info') {
      const toastEl = document.createElement('div');
      toastEl.className = `toast toast-${type}`;

      const iconMap = {
        success: 'fa-circle-check text-emerald-500',
        error: 'fa-circle-xmark text-rose-500',
        warning: 'fa-triangle-exclamation text-amber-500',
        info: 'fa-circle-info text-indigo-500'
      };

      toastEl.innerHTML = `
        <i class="fa-solid ${iconMap[type] || 'fa-circle-info text-indigo-500'} text-lg"></i>
        <div class="flex-1 text-xs sm:text-sm font-medium text-slate-800">${escapeHtml(message)}</div>
      `;

      DOM.toastContainer.appendChild(toastEl);
      requestAnimationFrame(() => toastEl.classList.add('show'));

      setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.remove(), 350);
      }, 3200);
    }
  };

  // ============================================================================
  // 6. ANTI-BOT CAPTCHA GENERATOR
  // ============================================================================
  const CaptchaService = {
    generate(canvasElement) {
      if (!canvasElement) return '';
      const ctx = canvasElement.getContext('2d');
      const width = canvasElement.width;
      const height = canvasElement.height;

      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 160)}, ${Math.floor(Math.random() * 160)}, ${Math.floor(Math.random() * 210)}, 0.45)`;
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.bezierCurveTo(
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height
        );
        ctx.stroke();
      }

      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const charSpacing = width / 7;
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        ctx.save();
        const x = (i + 0.8) * charSpacing;
        const y = height / 2 + (Math.random() * 6 - 3);
        const angle = (Math.random() * 40 - 20) * (Math.PI / 180);

        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = `bold ${Math.floor(Math.random() * 4 + 20)}px 'Space Mono', monospace`;
        ctx.fillStyle = `rgb(${Math.floor(Math.random() * 100 + 20)}, ${Math.floor(Math.random() * 100 + 20)}, ${Math.floor(Math.random() * 150 + 50)})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, 0, 0);
        ctx.restore();
      }

      for (let i = 0; i < 25; i++) {
        ctx.fillStyle = `rgba(${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 150)}, 0.4)`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      return code;
    },

    refreshSplash() {
      splashCaptchaCode = this.generate(DOM.splashCaptchaCanvas);
      DOM.splashCaptchaInput.value = '';
    }
  };

  // ============================================================================
  // 7. USER AUTHENTICATION & STRICT ROLE ENFORCEMENT
  // ============================================================================
  const AuthService = {
    initUsers() {
      let users = this.getUsers();
      if (!users || users.length === 0) {
        users = [
          {
            workerId: 'ADM-001',
            name: 'System Administrator',
            email: 'admin@billbuddy.com',
            role: 'admin',
            passwordHash: sha256('Admin@123')
          },
          {
            workerId: 'WRK-101',
            name: 'Rahul Sharma',
            email: 'rahul@billbuddy.com',
            role: 'worker',
            passwordHash: sha256('Worker@123')
          },
          {
            workerId: 'WRK-102',
            name: 'Priya Patel',
            email: 'priya@billbuddy.com',
            role: 'worker',
            passwordHash: sha256('Worker@123')
          }
        ];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      } else {
        // Ensure legacy records have Worker IDs and modern BillBuddy domain
        let modified = false;
        users = users.map((u, i) => {
          if (!u.workerId) {
            u.workerId = u.role === 'admin' ? 'ADM-001' : `WRK-${101 + i}`;
            modified = true;
          }
          if (u.email && u.email.includes('@smartreceipt.com')) {
            u.email = u.email.replace('@smartreceipt.com', '@billbuddy.com');
            modified = true;
          }
          return u;
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      }

      // Always present the Splash Sign-In Gate on website open (Manual user ID & password required)
      this.promptSplashAuth();
    },

    promptSplashAuth() {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      AppState.currentUser = null;
      if (DOM.splashEmail) DOM.splashEmail.value = '';
      if (DOM.splashPassword) DOM.splashPassword.value = '';
      DOM.splashAuthOverlay.classList.remove('hidden');
      DOM.viewWorker.classList.add('hidden');
      DOM.viewAdmin.classList.add('hidden');
    },

    getUsers() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.USERS);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },

    login(identifierInput, passwordInput) {
      const rawId = (identifierInput || '').trim();
      const lowerId = rawId.toLowerCase();

      if (!rawId) {
        Toast.show('Please enter your Worker ID or Email address', 'warning');
        return false;
      }

      if (!passwordInput) {
        Toast.show('Please enter your password', 'warning');
        return false;
      }

      const users = this.getUsers();
      // Supports login via EITHER Worker ID (e.g. WRK-101) OR Email address (billbuddy.com or legacy)
      const user = users.find(u => 
        (u.workerId && u.workerId.toUpperCase() === rawId.toUpperCase()) ||
        (u.email && (
          u.email.toLowerCase() === lowerId ||
          u.email.toLowerCase().replace('@billbuddy.com', '@smartreceipt.com') === lowerId ||
          u.email.toLowerCase().replace('@smartreceipt.com', '@billbuddy.com') === lowerId
        ))
      );

      if (!user) {
        Toast.show('No staff account found with this Worker ID / Email.', 'error');
        return false;
      }

      if (user.passwordHash !== sha256(passwordInput)) {
        Toast.show('Incorrect password. Access denied.', 'error');
        return false;
      }

      // Session established
      AppState.currentUser = {
        workerId: user.workerId || 'WRK-100',
        name: user.name,
        email: user.email,
        role: user.role
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(AppState.currentUser));

      DOM.splashAuthOverlay.classList.add('hidden');
      this.applyUserInterface();
      Toast.show(`Welcome, ${user.name}! (${user.workerId || user.role.toUpperCase()})`, 'success');
      return true;
    },

    logout() {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      AppState.currentUser = null;
      this.promptSplashAuth();
      Toast.show('Signed out from console', 'info');
    },

    // Strict Role Separation: Workers CANNOT see Admin portal; Admin CANNOT switch to Worker POS
    applyUserInterface() {
      const user = AppState.currentUser;
      if (!user) return;

      if (user.role === 'admin') {
        // ADMIN MODE:
        // Admin is taken directly to Admin Portal.
        // Worker POS is completely hidden. Admin does NOT bill or make payments.
        DOM.viewWorker.classList.add('hidden');
        DOM.viewAdmin.classList.remove('hidden');

        DOM.headerUserWelcome.textContent = `Administrator: ${user.name}`;
        DOM.headerRoleBadge.textContent = 'Admin Executive Portal';
        DOM.headerRoleBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200';

        DOM.adminNavControls.classList.remove('hidden');
        DOM.adminNavControls.classList.add('flex');
        DOM.workerNavControls.classList.add('hidden');

        // Render admin views
        AdminModule.renderMonthlyProductAnalytics();
        AdminModule.renderAdminCatalog();
        QrConfigService.renderAdminQrPreview();
        AdminModule.renderWorkerRoster();
      } else {
        // WORKER MODE:
        // Worker is taken directly to Worker POS Billing.
        // Admin Portal is completely hidden and inaccessible.
        DOM.viewAdmin.classList.add('hidden');
        DOM.viewWorker.classList.remove('hidden');

        DOM.headerUserWelcome.textContent = `Cashier: ${user.name}`;
        DOM.headerRoleBadge.textContent = 'Worker POS Billing';
        DOM.headerRoleBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200';

        DOM.workerNavControls.classList.remove('hidden');
        DOM.workerNavControls.classList.add('flex');
        DOM.adminNavControls.classList.add('hidden');

        AppState.meta.cashierName = user.name;
        DOM.cashierNameInput.value = user.name;
        ReceiptRenderer.render();
      }
    },

    // Admin provisions new worker credentials with unique Worker ID
    provisionWorker(workerId, name, email, password) {
      const trimmedWorkerId = (workerId || '').trim().toUpperCase() || this.getNextWorkerId();
      const trimmedName = (name || '').trim();
      const trimmedEmail = (email || '').trim().toLowerCase();

      if (!trimmedWorkerId || trimmedWorkerId.length < 2) {
        Toast.show('A valid Worker ID is required', 'warning');
        return false;
      }
      if (!trimmedName || trimmedName.length < 2) {
        Toast.show('Valid full name is required', 'warning');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        Toast.show('Valid email address is required', 'warning');
        return false;
      }
      if (!password || password.length < 6) {
        Toast.show('Initial password must be at least 6 characters', 'warning');
        return false;
      }

      const users = this.getUsers();
      if (users.some(u => u.workerId && u.workerId.toUpperCase() === trimmedWorkerId)) {
        Toast.show(`Worker ID "${trimmedWorkerId}" is already assigned! Please use a unique ID.`, 'error');
        return false;
      }
      if (users.some(u => u.email.toLowerCase() === trimmedEmail)) {
        Toast.show('A staff account with this email address already exists', 'error');
        return false;
      }

      const newWorker = {
        workerId: trimmedWorkerId,
        name: trimmedName,
        email: trimmedEmail,
        role: 'worker',
        passwordHash: sha256(password),
        createdAt: new Date().toISOString()
      };

      users.push(newWorker);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      AdminModule.renderWorkerRoster();
      Toast.show(`Worker created with ID "${trimmedWorkerId}" for ${trimmedName}!`, 'success');
      return true;
    },

    getNextWorkerId() {
      const users = this.getUsers();
      let maxNum = 100;
      users.forEach(u => {
        if (u.workerId && u.workerId.startsWith('WRK-')) {
          const num = parseInt(u.workerId.replace('WRK-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      return `WRK-${maxNum + 1}`;
    }
  };

  // ============================================================================
  // 8. MASTER PRODUCT CATALOG SERVICE ("Common Data")
  // ============================================================================
  const CatalogService = {
    initCatalog() {
      let catalog = this.getCatalog();
      if (!catalog || catalog.length === 0) {
        catalog = [
          { id: 'cat_1', name: 'Logitech Wireless Mouse M185', category: 'Hardware', price: 999 },
          { id: 'cat_2', name: 'Keychron K2 Mechanical Keyboard', category: 'Hardware', price: 6999 },
          { id: 'cat_3', name: 'Braided Type-C Fast Cable 1.5m', category: 'Accessories', price: 349 },
          { id: 'cat_4', name: 'SanDisk 128GB Ultra Flash Drive', category: 'Storage', price: 899 },
          { id: 'cat_5', name: 'Thermal Receipt Paper Roll 80mm', category: 'Consumables', price: 299 },
          { id: 'cat_6', name: 'Extended Micro-Weave Deskmat (90x40cm)', category: 'Accessories', price: 799 },
          { id: 'cat_7', name: 'USB-C Multiport 7-in-1 Hub Adapter', category: 'Hardware', price: 2499 },
          { id: 'cat_8', name: 'HDMI 2.1 Ultra 4K Cable 2m', category: 'Accessories', price: 599 }
        ];
        localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
      }
      this.syncDatalist();
    },

    getCatalog() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.CATALOG);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },

    addProduct(name, category, price) {
      const trimmedName = (name || '').trim();
      if (!trimmedName) {
        Toast.show('Product name is required', 'warning');
        return false;
      }
      const numPrice = Math.max(0, Number(price) || 0);
      const catalog = this.getCatalog();

      const existing = catalog.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        existing.price = numPrice;
        if (category) existing.category = category.trim();
      } else {
        catalog.push({
          id: 'cat_' + Math.random().toString(36).substr(2, 9),
          name: trimmedName,
          category: (category || 'General').trim(),
          price: numPrice
        });
      }

      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
      this.syncDatalist();
      AdminModule.renderAdminCatalog();
      Toast.show(`Product "${trimmedName}" saved to Master Catalog!`, 'success');
      return true;
    },

    deleteProduct(id) {
      let catalog = this.getCatalog();
      catalog = catalog.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
      this.syncDatalist();
      AdminModule.renderAdminCatalog();
      this.renderWorkerCatalogList();
      Toast.show('Product removed from catalog', 'info');
    },

    syncDatalist() {
      const catalog = this.getCatalog();
      DOM.masterCatalogDatalist.innerHTML = '';
      catalog.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name;
        opt.textContent = `(${item.category || 'General'}) - ${AppState.meta.currency}${item.price}`;
        DOM.masterCatalogDatalist.appendChild(opt);
      });
    },

    openWorkerCatalogModal() {
      this.renderWorkerCatalogList();
      DOM.catalogModal.classList.remove('hidden');
    },

    closeWorkerCatalogModal() {
      DOM.catalogModal.classList.add('hidden');
    },

    renderWorkerCatalogList(searchQuery = '') {
      const catalog = this.getCatalog();
      DOM.catalogTbody.innerHTML = '';
      const query = searchQuery.trim().toLowerCase();

      const filtered = catalog.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query)
      );

      if (DOM.catalogTotalCount) DOM.catalogTotalCount.textContent = catalog.length;

      if (filtered.length === 0) {
        DOM.catalogTbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-400 italic">No products found</td></tr>`;
        return;
      }

      filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-semibold text-slate-800">${escapeHtml(p.name)}</td>
          <td class="py-2.5 px-4">
            <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-brand-700">
              ${escapeHtml(p.category || 'General')}
            </span>
          </td>
          <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
            ${AppState.meta.currency}${Number(p.price).toFixed(2)}
          </td>
          <td class="py-2.5 px-4 text-center">
            <button type="button" class="btn-catalog-pick-to-receipt px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-600 hover:text-white text-brand-700 font-semibold text-xs transition-colors" data-name="${escapeHtml(p.name)}" data-price="${p.price}">
              + Add to POS
            </button>
          </td>
        `;
        DOM.catalogTbody.appendChild(tr);
      });
    }
  };

  // ============================================================================
  // 9. QR CODE CONFIGURATION SERVICE (Admin Power to Change QR Code)
  // ============================================================================
  const QrConfigService = {
    initQrConfig() {
      const stored = localStorage.getItem(STORAGE_KEYS.QR_CONFIG);
      if (stored) {
        try {
          AppState.qrConfig = Object.assign(AppState.qrConfig, JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
      this.syncFormInputs();
      this.renderAdminQrPreview();
    },

    syncFormInputs() {
      DOM.adminQrUpiId.value = AppState.qrConfig.upiId;
      DOM.adminQrMerchantName.value = AppState.qrConfig.merchantName;
      DOM.adminQrNotes.value = AppState.qrConfig.notes;
    },

    saveQrConfig(upiId, merchantName, notes) {
      if (!upiId || !upiId.includes('@')) {
        Toast.show('Please enter a valid UPI VPA ID (e.g. merchant@bank)', 'warning');
        return false;
      }
      AppState.qrConfig.upiId = upiId.trim();
      AppState.qrConfig.merchantName = merchantName.trim() || 'Store Enterprise';
      AppState.qrConfig.notes = notes.trim();

      localStorage.setItem(STORAGE_KEYS.QR_CONFIG, JSON.stringify(AppState.qrConfig));
      this.renderAdminQrPreview();
      Toast.show('QR Code configuration updated successfully!', 'success');
      return true;
    },

    buildUpiString(amount = 0, receiptNumber = '') {
      const upi = AppState.qrConfig.upiId;
      const pn = encodeURIComponent(AppState.qrConfig.merchantName);
      const tn = encodeURIComponent(`Bill ${receiptNumber}`);
      const am = Number(amount).toFixed(2);
      return `upi://pay?pa=${upi}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
    },

    renderQrIntoContainer(containerElement, amount = 0, receiptNumber = '') {
      containerElement.innerHTML = '';

      if (AppState.qrConfig.customQrImage) {
        const img = document.createElement('img');
        img.src = AppState.qrConfig.customQrImage;
        img.alt = 'Store Payment QR';
        img.className = 'w-48 h-48 object-contain mx-auto';
        containerElement.appendChild(img);
        return;
      }

      const upiPayload = this.buildUpiString(amount, receiptNumber);
      try {
        if (typeof QRCode !== 'undefined') {
          new QRCode(containerElement, {
            text: upiPayload,
            width: 190,
            height: 190,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        } else {
          const img = document.createElement('img');
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(upiPayload)}`;
          img.alt = 'UPI QR Code';
          img.className = 'w-48 h-48 mx-auto';
          containerElement.appendChild(img);
        }
      } catch (err) {
        console.error('QR Render Error:', err);
      }
    },

    renderAdminQrPreview() {
      DOM.adminQrPreviewName.textContent = AppState.qrConfig.merchantName;
      DOM.adminQrPreviewVpa.textContent = `UPI: ${AppState.qrConfig.upiId}`;
      this.renderQrIntoContainer(DOM.adminQrRenderBox, 100, 'DEMO-PREVIEW');
    }
  };

  // ============================================================================
  // 10. SERVER DATABASE PERSISTENCE SERVICE ("Definitely Save in Server")
  // ============================================================================
  const ServerAPI = {
    getServerDb() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.SERVER_DB);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },

    commitPaymentRecord(receiptSnapshot, paymentDetails) {
      try {
        const db = this.getServerDb();
        const serverRecord = {
          syncId: 'SRV_SYNC_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
          receiptNumber: receiptSnapshot.meta.receiptNumber,
          timestamp: new Date().toISOString(),
          status: 'SAVED_200_OK',
          amount: receiptSnapshot.billing.grandTotal,
          currency: receiptSnapshot.meta.currency,
          paymentMethod: paymentDetails.method || 'UPI QR',
          utr: paymentDetails.utr || 'VERIFIED_AUTO',
          cashier: (receiptSnapshot.createdBy && receiptSnapshot.createdBy.name) || receiptSnapshot.meta.cashierName || 'Staff',
          customer: receiptSnapshot.customer.name,
          itemsCount: receiptSnapshot.items.length,
          payload: receiptSnapshot
        };

        db.unshift(serverRecord);
        localStorage.setItem(STORAGE_KEYS.SERVER_DB, JSON.stringify(db));

        StorageService.saveReceiptToHistory(receiptSnapshot);
        HistoryManager.updateBadge();

        return serverRecord;
      } catch (err) {
        console.error('Server save error:', err);
        return null;
      }
    },

    renderServerLogsTable() {
      const db = this.getServerDb();
      DOM.serverDbTbody.innerHTML = '';

      if (db.length === 0) {
        DOM.serverDbTbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400 italic font-sans">No transactions committed to server database yet</td></tr>`;
        return;
      }

      db.forEach(rec => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-100/60 transition-colors';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-bold text-slate-700">${escapeHtml(rec.syncId)}</td>
          <td class="py-2.5 px-4 text-brand-600 font-bold">${escapeHtml(rec.receiptNumber)}</td>
          <td class="py-2.5 px-4 text-slate-500 text-[11px]">${formatHumanDate(rec.timestamp)}</td>
          <td class="py-2.5 px-4">
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${rec.status}
            </span>
          </td>
          <td class="py-2.5 px-4 text-slate-600">${escapeHtml(rec.paymentMethod)} (${escapeHtml(rec.utr)})</td>
          <td class="py-2.5 px-4 text-right font-bold text-slate-900">${rec.currency}${Number(rec.amount).toFixed(2)}</td>
        `;
        DOM.serverDbTbody.appendChild(tr);
      });
    }
  };

  // ============================================================================
  // 11. MULTI-OPTION PAYMENT VERIFICATION & BILL UNLOCK GATEWAY (WORKER POS)
  // Supports: Cash, Credit Card, Debit Card, and UPI QR Code
  // ============================================================================
  const PaymentGateway = {
    isVerified: false,
    activeMethod: 'Cash',
    paymentRecord: null,

    openModal() {
      // Strict role isolation: Admin does not access Worker POS or billing
      if (AppState.currentUser && AppState.currentUser.role === 'admin') {
        Toast.show('Access Denied: Administrators do not have access to Worker POS or billing.', 'error');
        return;
      }

      if (AppState.items.length === 0 || AppState.billing.grandTotal <= 0) {
        Toast.show('Please add items with valid prices before proceeding to payment', 'warning');
        return;
      }

      this.isVerified = false;
      this.paymentRecord = null;
      DOM.paymentSuccessBanner.classList.add('hidden');
      DOM.btnCompleteAndUnlock.disabled = true;

      DOM.modalPayAmount.textContent = CalculationEngine.formatCurrency(AppState.billing.grandTotal);
      DOM.modalPayReceiptNo.textContent = AppState.meta.receiptNumber;

      // Reset / initialize payment inputs
      if (DOM.inputCashTendered) {
        DOM.inputCashTendered.value = '';
        this.updateCashChange();
      }
      if (DOM.creditAuthCode) {
        DOM.creditAuthCode.value = this.generateAuthCode('CC');
      }
      if (DOM.debitAuthCode) {
        DOM.debitAuthCode.value = this.generateAuthCode('DB');
      }
      if (DOM.inputPaymentUtr) {
        DOM.inputPaymentUtr.value = '';
      }

      DOM.checkoutMerchantName.textContent = AppState.qrConfig.merchantName;
      DOM.checkoutVpa.textContent = `UPI: ${AppState.qrConfig.upiId}`;

      DOM.paymentVerificationStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1.5';
      DOM.paymentVerificationStatusBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
        <span>Awaiting Payment Verification</span>
      `;

      // Default to Cash tab
      this.switchTab('Cash');

      DOM.paymentModal.classList.remove('hidden');
    },

    closeModal() {
      DOM.paymentModal.classList.add('hidden');
    },

    switchTab(method) {
      this.activeMethod = method;

      const tabs = [
        { name: 'Cash', btn: DOM.tabBtnCash, panel: DOM.panelPayCash, activeBorder: 'border-emerald-500' },
        { name: 'Credit Card', btn: DOM.tabBtnCredit, panel: DOM.panelPayCredit, activeBorder: 'border-indigo-500' },
        { name: 'Debit Card', btn: DOM.tabBtnDebit, panel: DOM.panelPayDebit, activeBorder: 'border-blue-500' },
        { name: 'UPI QR', btn: DOM.tabBtnUpi, panel: DOM.panelPayUpi, activeBorder: 'border-teal-500' }
      ];

      tabs.forEach(t => {
        if (!t.btn || !t.panel) return;
        if (t.name === method) {
          t.btn.classList.add('active', 'bg-white', 'text-slate-900', 'shadow-xs', t.activeBorder);
          t.btn.classList.remove('bg-slate-100', 'text-slate-600');
          t.panel.classList.remove('hidden');
        } else {
          t.btn.classList.remove('active', 'bg-white', 'text-slate-900', 'shadow-xs', 'border-emerald-500', 'border-indigo-500', 'border-blue-500', 'border-teal-500');
          t.btn.classList.add('bg-slate-100', 'text-slate-600');
          t.panel.classList.add('hidden');
        }
      });

      if (method === 'UPI QR') {
        QrConfigService.renderQrIntoContainer(DOM.checkoutQrBox, AppState.billing.grandTotal, AppState.meta.receiptNumber);
      }
    },

    generateAuthCode(type = 'CC') {
      const rand = Math.floor(100000 + Math.random() * 900000);
      return `AUTH-${type}-${rand}`;
    },

    updateCashChange() {
      const tendered = parseFloat(DOM.inputCashTendered.value) || 0;
      const due = AppState.billing.grandTotal;

      if (tendered <= 0) {
        DOM.cashChangeAmount.textContent = CalculationEngine.formatCurrency(0);
        DOM.cashStatusIndicator.textContent = 'Enter cash amount above';
        DOM.cashStatusIndicator.className = 'text-xs font-semibold text-slate-500';
      } else if (tendered < due) {
        const diff = due - tendered;
        DOM.cashChangeAmount.textContent = CalculationEngine.formatCurrency(0);
        DOM.cashStatusIndicator.textContent = `Shortage: ${CalculationEngine.formatCurrency(diff)}`;
        DOM.cashStatusIndicator.className = 'text-xs font-semibold text-rose-600';
      } else {
        const change = tendered - due;
        DOM.cashChangeAmount.textContent = CalculationEngine.formatCurrency(change);
        DOM.cashStatusIndicator.textContent = change === 0 ? 'Exact amount received' : 'Change to return';
        DOM.cashStatusIndicator.className = 'text-xs font-semibold text-emerald-600';
      }
    },

    setCashPreset(preset) {
      const due = AppState.billing.grandTotal;
      if (preset === 'exact') {
        DOM.inputCashTendered.value = due.toFixed(2);
      } else {
        const val = parseFloat(preset);
        if (!isNaN(val)) DOM.inputCashTendered.value = val.toFixed(2);
      }
      this.updateCashChange();
    },

    verifyCash() {
      const tendered = parseFloat(DOM.inputCashTendered.value) || 0;
      const due = AppState.billing.grandTotal;
      if (tendered < due) {
        Toast.show(`Cash tendered is insufficient! Due is ${CalculationEngine.formatCurrency(due)}`, 'error');
        return;
      }
      const change = tendered - due;
      const rand = Math.floor(100000 + Math.random() * 900000);
      this.confirmVerification({
        method: 'Cash',
        ref: `TXN-CSH-${rand}`,
        tendered: tendered,
        change: change,
        detailString: `Tendered: ${CalculationEngine.formatCurrency(tendered)} | Change: ${CalculationEngine.formatCurrency(change)}`
      });
    },

    verifyCreditCard() {
      const network = DOM.creditCardNetwork ? DOM.creditCardNetwork.value : 'Visa';
      const last4 = (DOM.creditCardLast4 ? DOM.creditCardLast4.value : '').trim() || '4242';
      const auth = (DOM.creditAuthCode ? DOM.creditAuthCode.value : '').trim() || this.generateAuthCode('CC');
      const rand = Math.floor(100000 + Math.random() * 900000);
      this.confirmVerification({
        method: 'Credit Card',
        ref: `TXN-CC-${rand}`,
        network: network,
        last4: last4,
        authCode: auth,
        detailString: `${network} •••• ${last4} | Auth: ${auth}`
      });
    },

    verifyDebitCard() {
      const bank = DOM.debitCardBank ? DOM.debitCardBank.value : 'HDFC Bank';
      const last4 = (DOM.debitCardLast4 ? DOM.debitCardLast4.value : '').trim() || '9812';
      const auth = (DOM.debitAuthCode ? DOM.debitAuthCode.value : '').trim() || this.generateAuthCode('DB');
      const rand = Math.floor(100000 + Math.random() * 900000);
      this.confirmVerification({
        method: 'Debit Card',
        ref: `TXN-DC-${rand}`,
        bank: bank,
        last4: last4,
        authCode: auth,
        detailString: `${bank} •••• ${last4} | PIN Auth: ${auth}`
      });
    },

    verifyUpi(customUtr = '') {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const utr = customUtr || (DOM.inputPaymentUtr && DOM.inputPaymentUtr.value.trim()) || `4312${rand}`;
      this.confirmVerification({
        method: 'UPI QR',
        ref: `TXN-UPI-${rand}`,
        upiId: AppState.qrConfig.upiId,
        utr: utr,
        detailString: `UPI: ${AppState.qrConfig.upiId} | UTR: ${utr}`
      });
    },

    confirmVerification(details) {
      this.isVerified = true;
      this.paymentRecord = details;

      DOM.paymentVerificationStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5';
      DOM.paymentVerificationStatusBadge.innerHTML = `
        <i class="fa-solid fa-circle-check text-emerald-600"></i>
        <span>Verified via ${details.method}</span>
      `;

      if (DOM.paymentSuccessTitle) {
        DOM.paymentSuccessTitle.textContent = `${details.method.toUpperCase()} Payment Verified!`;
      }
      DOM.paymentSuccessTxnText.textContent = `Reference / Auth: ${details.ref}`;
      if (DOM.paymentSuccessDetailText) {
        DOM.paymentSuccessDetailText.textContent = details.detailString;
      }
      DOM.paymentSuccessBanner.classList.remove('hidden');
      DOM.btnCompleteAndUnlock.disabled = false;

      Toast.show(`${details.method} payment verified successfully!`, 'success');
      if (window.confetti) {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      }
    },

    completeAndGenerateBill() {
      if (!this.isVerified || !this.paymentRecord) return;

      const p = this.paymentRecord;
      AppState.meta.paymentStatus = 'PAID';
      AppState.meta.paymentMode = p.method;
      AppState.meta.paymentDetails = p;
      AppState.isBillLocked = false;

      const snapshot = JSON.parse(JSON.stringify(AppState));
      snapshot.createdBy = AppState.currentUser
        ? { name: AppState.currentUser.name, email: AppState.currentUser.email, role: AppState.currentUser.role }
        : { name: AppState.meta.cashierName, email: 'worker@billbuddy.com', role: 'worker' };

      ServerAPI.commitPaymentRecord(snapshot, {
        method: p.method,
        utr: p.ref,
        detailString: p.detailString
      });

      DOM.receiptLockedOverlay.classList.add('hidden');
      DOM.billStatusPill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
      DOM.billStatusPill.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Bill Generated & Verified (${p.method})</span>`;

      DOM.btnPrint.disabled = false;
      DOM.btnDownloadPdf.disabled = false;

      ReceiptRenderer.render();
      this.closeModal();

      Toast.show(`Bill ${AppState.meta.receiptNumber} generated & saved to Server DB!`, 'success');
      if (window.confetti) {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.8 } });
      }
    }
  };

  // ============================================================================
  // 12. CALCULATION ENGINE
  // ============================================================================
  const CalculationEngine = {
    recalculate() {
      let subtotal = 0;
      AppState.items.forEach(item => {
        const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
        item.total = lineTotal;
        subtotal += lineTotal;
      });
      AppState.billing.subtotal = subtotal;

      const discVal = Number(AppState.billing.discountValue) || 0;
      let discountAmount = AppState.billing.discountType === 'percent'
        ? subtotal * (discVal / 100)
        : discVal;

      discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
      AppState.billing.discountAmount = discountAmount;

      const taxable = Math.max(0, subtotal - discountAmount);
      AppState.billing.taxableAmount = taxable;

      const taxRate = Number(AppState.billing.taxRate) || 0;
      const taxAmount = taxable * (taxRate / 100);
      AppState.billing.taxAmount = taxAmount;

      AppState.billing.grandTotal = taxable + taxAmount;
      DOM.formGrandTotalPreview.textContent = this.formatCurrency(AppState.billing.grandTotal);

      ReceiptRenderer.render();
      ItemManager.updateLineTotalsInDOM();
    },

    formatCurrency(amount) {
      const num = Number(amount) || 0;
      return `${AppState.meta.currency}${num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  };

  // ============================================================================
  // 13. ITEM MANAGER (Dynamic Rows & Custom Items Freedom)
  // ============================================================================
  const ItemManager = {
    initDefaultItems() {
      AppState.items = [
        { id: this.generateItemId(), name: 'Logitech Wireless Mouse M185', qty: 1, price: 999, total: 999 },
        { id: this.generateItemId(), name: 'Braided Type-C Fast Cable 1.5m', qty: 2, price: 349, total: 698 }
      ];
      this.renderEditableRows();
      CalculationEngine.recalculate();
    },

    generateItemId() {
      return 'item_' + Math.random().toString(36).substr(2, 9);
    },

    addItem(name = '', qty = 1, price = 0) {
      const newItem = {
        id: this.generateItemId(),
        name: name,
        qty: Number(qty) || 1,
        price: Number(price) || 0,
        total: (Number(qty) || 1) * (Number(price) || 0)
      };
      AppState.items.push(newItem);
      this.renderEditableRows();
      CalculationEngine.recalculate();

      const latestRow = DOM.itemsTbody.lastElementChild;
      if (latestRow) {
        const input = latestRow.querySelector('.item-name-input');
        if (input) input.focus();
      }
    },

    removeItem(id) {
      AppState.items = AppState.items.filter(item => item.id !== id);
      this.renderEditableRows();
      CalculationEngine.recalculate();
      Toast.show('Item removed', 'info');
    },

    clearAllItems() {
      if (AppState.items.length === 0) return;
      if (confirm('Are you sure you want to clear all items?')) {
        AppState.items = [];
        this.renderEditableRows();
        CalculationEngine.recalculate();
        Toast.show('Items cleared', 'info');
      }
    },

    renderEditableRows() {
      DOM.itemsTbody.innerHTML = '';
      const items = AppState.items;
      DOM.itemCountLabel.textContent = items.length;

      if (items.length === 0) {
        DOM.itemsEmptyState.classList.remove('hidden');
        return;
      }

      DOM.itemsEmptyState.classList.add('hidden');

      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors group';
        tr.dataset.id = item.id;

        tr.innerHTML = `
          <td class="py-2.5 pl-1 pr-2">
            <div class="flex items-center space-x-1.5">
              <input type="text" list="master-catalog-datalist" class="item-name-input w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Custom item name or pick from catalog..." value="${escapeHtml(item.name)}">
              <button type="button" class="btn-save-item-to-catalog text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/70 p-2 rounded-xl transition-all shrink-0 shadow-sm" title="Save this custom item to Master Product Catalog">
                <i class="fa-solid fa-cloud-arrow-up text-xs"></i>
              </button>
            </div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <input type="number" min="1" step="1" class="item-qty-input w-16 px-2 py-1.5 text-center border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 font-bold" value="${item.qty}">
          </td>
          <td class="py-2.5 px-2 text-right">
            <input type="number" min="0" step="any" class="item-price-input w-24 px-2.5 py-1.5 text-right border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 font-bold" value="${item.price}">
          </td>
          <td class="py-2.5 px-2 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm item-line-total">
            ${CalculationEngine.formatCurrency(item.total)}
          </td>
          <td class="py-2.5 pl-2 text-center">
            <button type="button" class="btn-delete-row text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200/70 p-2 rounded-xl transition-all shadow-sm" title="Delete item">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </td>
        `;

        DOM.itemsTbody.appendChild(tr);
      });
    },

    updateLineTotalsInDOM() {
      const rows = DOM.itemsTbody.querySelectorAll('tr');
      rows.forEach(row => {
        const id = row.dataset.id;
        const item = AppState.items.find(i => i.id === id);
        if (item) {
          const totalCell = row.querySelector('.item-line-total');
          if (totalCell) {
            totalCell.textContent = CalculationEngine.formatCurrency(item.total);
          }
        }
      });
    }
  };

  // ============================================================================
  // 14. RECEIPT RENDERER
  // ============================================================================
  const ReceiptRenderer = {
    render() {
      DOM.pvStoreName.textContent = AppState.store.name || 'STORE NAME';
      DOM.pvStoreAddress.textContent = AppState.store.address || '';
      DOM.pvStorePhone.textContent = AppState.store.phone || '';

      if (AppState.store.taxId) {
        DOM.pvStoreTax.textContent = AppState.store.taxId;
        DOM.pvStoreTax.classList.remove('hidden');
      } else {
        DOM.pvStoreTax.classList.add('hidden');
      }

      if (AppState.store.logo) {
        DOM.pvLogoImg.src = AppState.store.logo;
        DOM.pvLogoContainer.classList.remove('hidden');
      } else {
        DOM.pvLogoContainer.classList.add('hidden');
      }

      DOM.pvReceiptNumber.textContent = AppState.meta.receiptNumber || 'REC-000000';
      DOM.pvBarcodeNumber.textContent = AppState.meta.receiptNumber || 'REC-000000';
      DOM.pvReceiptDate.textContent = formatHumanDate(AppState.meta.dateTime);
      DOM.pvCashierName.textContent = AppState.meta.cashierName || 'Staff';
      DOM.pvCustomerName.textContent = AppState.customer.name || 'Walk-in Customer';

      if (AppState.customer.contact) {
        DOM.pvCustomerContact.textContent = AppState.customer.contact;
        DOM.pvCustomerContactRow.classList.remove('hidden');
      } else {
        DOM.pvCustomerContactRow.classList.add('hidden');
      }

      DOM.pvItemsTbody.innerHTML = '';
      if (AppState.items.length === 0) {
        DOM.pvItemsTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400 italic">No items added to receipt</td></tr>`;
      } else {
        AppState.items.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'py-1';
          row.innerHTML = `
            <td class="text-left py-1 pr-1 font-medium">${escapeHtml(item.name || 'Custom Item')}</td>
            <td class="text-center py-1 px-1">${item.qty}</td>
            <td class="text-right py-1 px-1">${CalculationEngine.formatCurrency(item.price)}</td>
            <td class="text-right py-1 pl-1 font-semibold">${CalculationEngine.formatCurrency(item.total)}</td>
          `;
          DOM.pvItemsTbody.appendChild(row);
        });
      }

      DOM.pvSubtotal.textContent = CalculationEngine.formatCurrency(AppState.billing.subtotal);

      if (AppState.billing.discountAmount > 0) {
        DOM.pvDiscountRow.classList.remove('hidden');
        DOM.pvDiscountLabel.textContent = AppState.billing.discountType === 'percent'
          ? `DISCOUNT (${AppState.billing.discountValue}%)`
          : 'DISCOUNT (FLAT)';
        DOM.pvDiscountAmount.textContent = `-${CalculationEngine.formatCurrency(AppState.billing.discountAmount)}`;
      } else {
        DOM.pvDiscountRow.classList.add('hidden');
      }

      if (AppState.billing.discountAmount > 0) {
        DOM.pvTaxableRow.classList.remove('hidden');
        DOM.pvTaxableAmount.textContent = CalculationEngine.formatCurrency(AppState.billing.taxableAmount);
      } else {
        DOM.pvTaxableRow.classList.add('hidden');
      }

      const taxRate = Number(AppState.billing.taxRate) || 0;
      DOM.pvTaxLabel.textContent = `GST / TAX (${taxRate}%)`;
      DOM.pvTaxAmount.textContent = `+${CalculationEngine.formatCurrency(AppState.billing.taxAmount)}`;
      DOM.pvGrandTotal.textContent = CalculationEngine.formatCurrency(AppState.billing.grandTotal);

      if (AppState.meta.paymentStatus === 'PAID') {
        DOM.pvPaymentBadge.textContent = `${AppState.meta.paymentMode.toUpperCase()} - VERIFIED`;
        DOM.pvPaymentBadge.className = 'inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300';
        if (DOM.pvPaymentDetails && AppState.meta.paymentDetails) {
          DOM.pvPaymentDetails.textContent = AppState.meta.paymentDetails.detailString || AppState.meta.paymentDetails.ref || '';
          DOM.pvPaymentDetails.classList.remove('hidden');
        }
      } else {
        DOM.pvPaymentBadge.textContent = 'PAYMENT PENDING';
        DOM.pvPaymentBadge.className = 'inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300';
        if (DOM.pvPaymentDetails) {
          DOM.pvPaymentDetails.textContent = '';
          DOM.pvPaymentDetails.classList.add('hidden');
        }
      }

      DOM.pvReceiptNotes.textContent = AppState.meta.notes || 'Thank you for your purchase!';
    },

    setFormat(mode) {
      AppState.meta.formatMode = mode;
      if (mode === 'thermal') {
        DOM.receiptPaper.classList.remove('a4-mode');
        DOM.receiptPaper.classList.add('thermal-mode');
        DOM.btnFormatThermal.classList.add('active');
        DOM.btnFormatA4.classList.remove('active');
      } else {
        DOM.receiptPaper.classList.remove('thermal-mode');
        DOM.receiptPaper.classList.add('a4-mode');
        DOM.btnFormatA4.classList.add('active');
        DOM.btnFormatThermal.classList.remove('active');
      }
    }
  };

  // ============================================================================
  // 15. ADMIN MODULE (POWER: PRESENTATION, ADD PRODUCTS, QR CODE, ONBOARDING)
  // ============================================================================
  const AdminModule = {
    activePeriod: 'all',
    activeWorker: 'all',

    initAdmin() {
      this.bindAdminSubnav();
      this.populateWorkerFilter();
      this.populateMonthlyDropdown();
      this.renderCompanySettings();
    },

    bindAdminSubnav() {
      const tabs = [
        { btn: DOM.adminNavCompany, panel: DOM.adminPanelCompany, onOpen: () => this.renderCompanySettings() },
        { btn: DOM.adminNavProducts, panel: DOM.adminPanelProducts, onOpen: () => this.renderMonthlyProductAnalytics() },
        { btn: DOM.adminNavCatalog, panel: DOM.adminPanelCatalog, onOpen: () => this.renderAdminCatalog() },
        { btn: DOM.adminNavQrcode, panel: DOM.adminPanelQrcode, onOpen: () => QrConfigService.renderAdminQrPreview() },
        { btn: DOM.adminNavWorkers, panel: DOM.adminPanelWorkers, onOpen: () => this.renderWorkerRoster() },
        { btn: DOM.adminNavAnalytics, panel: DOM.adminPanelAnalytics, onOpen: () => this.renderAnalytics() },
        { btn: DOM.adminNavServer, panel: DOM.adminPanelServer, onOpen: () => ServerAPI.renderServerLogsTable() }
      ];

      tabs.forEach(tab => {
        if (!tab.btn || !tab.panel) return;
        tab.btn.addEventListener('click', () => {
          tabs.forEach(t => {
            if (t.btn && t.panel) {
              t.btn.classList.remove('active');
              t.panel.classList.add('hidden');
            }
          });
          tab.btn.classList.add('active');
          tab.panel.classList.remove('hidden');
          if (tab.onOpen) tab.onOpen();
        });
      });
    },

    renderCompanySettings() {
      if (!DOM.adminCompanyName) return;
      DOM.adminCompanyName.value = AppState.store.name || '';
      DOM.adminCompanyTax.value = AppState.store.taxId || '';
      DOM.adminCompanyAddress.value = AppState.store.address || '';
      DOM.adminCompanyPhone.value = AppState.store.phone || '';
    },

    saveCompanySettings(name, taxId, address, phone) {
      const trimmedName = (name || '').trim();
      if (!trimmedName) {
        Toast.show('Company / Store name cannot be blank', 'warning');
        return false;
      }

      AppState.store.name = trimmedName;
      AppState.store.taxId = (taxId || '').trim();
      AppState.store.address = (address || '').trim();
      AppState.store.phone = (phone || '').trim();

      // Automatically sync store name to UPI merchant name as well
      AppState.qrConfig.merchantName = trimmedName;

      StorageService.saveDefaultStore(AppState.store);
      try {
        localStorage.setItem(STORAGE_KEYS.QR_CONFIG, JSON.stringify(AppState.qrConfig));
      } catch {}

      // Sync form inputs
      if (DOM.storeNameInput) DOM.storeNameInput.value = trimmedName;
      if (DOM.storeTaxInput) DOM.storeTaxInput.value = AppState.store.taxId;
      if (DOM.storeAddressInput) DOM.storeAddressInput.value = AppState.store.address;
      if (DOM.storePhoneInput) DOM.storePhoneInput.value = AppState.store.phone;

      if (DOM.checkoutMerchantName) DOM.checkoutMerchantName.textContent = trimmedName;
      if (DOM.adminQrMerchantName) DOM.adminQrMerchantName.value = trimmedName;
      if (DOM.adminQrPreviewName) DOM.adminQrPreviewName.textContent = trimmedName;

      ReceiptRenderer.render();
      Toast.show(`Company name updated to "${trimmedName}"!`, 'success');
      return true;
    },

    populateWorkerFilter() {
      const users = AuthService.getUsers();
      DOM.adminFilterWorker.innerHTML = '<option value="all">👥 All Accounts (Group Total)</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.email;
        opt.textContent = `${u.name} (${u.role.toUpperCase()})`;
        DOM.adminFilterWorker.appendChild(opt);
      });
    },

    populateMonthlyDropdown() {
      DOM.productMonthSelect.innerHTML = '';
      const months = [
        { label: 'November 2026 (Current Month)', val: '2026-11' },
        { label: 'October 2026', val: '2026-10' },
        { label: 'September 2026', val: '2026-09' },
        { label: 'August 2026', val: '2026-08' }
      ];

      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.val;
        opt.textContent = m.label;
        DOM.productMonthSelect.appendChild(opt);
      });
    },

    // 1. POWER: MAKE PRESENTATION ON PRODUCT SALES
    openSalesPresentation() {
      const selectedMonthStr = DOM.productMonthSelect.value || '2026-11';
      const [selYear, selMonth] = selectedMonthStr.split('-').map(Number);
      const history = StorageService.getHistory();
      const productStats = {};
      let totalRevenue = 0;
      let totalVolume = 0;

      history.forEach(receipt => {
        const rDate = new Date(receipt.meta.dateTime || receipt.savedAt);
        if (rDate.getFullYear() === selYear && rDate.getMonth() + 1 === selMonth) {
          (receipt.items || []).forEach(item => {
            const name = item.name || 'Item';
            const qty = Number(item.qty) || 0;
            const lineTotal = Number(item.total) || 0;

            if (!productStats[name]) productStats[name] = { qty: 0, revenue: 0 };
            productStats[name].qty += qty;
            productStats[name].revenue += lineTotal;
            totalRevenue += lineTotal;
            totalVolume += qty;
          });
        }
      });

      const productList = Object.keys(productStats).map(name => ({
        name: name,
        qty: productStats[name].qty,
        revenue: productStats[name].revenue
      }));

      productList.sort((a, b) => b.revenue - a.revenue);

      const topRevenueProduct = productList.length ? productList[0] : null;
      const topVolumeProduct = [...productList].sort((a, b) => b.qty - a.qty)[0] || null;

      DOM.presSubtitle.textContent = `Monthly Briefing for ${DOM.productMonthSelect.options[DOM.productMonthSelect.selectedIndex].text}`;
      DOM.presTopProduct.textContent = topRevenueProduct ? topRevenueProduct.name : 'N/A';
      DOM.presTopRevenue.textContent = topRevenueProduct ? CalculationEngine.formatCurrency(topRevenueProduct.revenue) : '₹0.00';
      DOM.presHighestVolume.textContent = topVolumeProduct ? topVolumeProduct.name : 'N/A';
      DOM.presVolumeUnits.textContent = topVolumeProduct ? `${topVolumeProduct.qty} Units Sold` : '0 Units';
      DOM.presTotalRevenue.textContent = CalculationEngine.formatCurrency(totalRevenue);

      // Takeaways
      DOM.presTakeawaysList.innerHTML = `
        <li><strong>Primary Revenue Driver:</strong> "${topRevenueProduct ? topRevenueProduct.name : 'N/A'}" accounted for the majority of sales volume. Recommend keeping buffer inventory.</li>
        <li><strong>Sales Velocity:</strong> Recorded a total of <strong>${totalVolume} units</strong> moved across all cashier terminals in this billing cycle.</li>
        <li><strong>Inventory Recommendation:</strong> Optimize procurement cycle for high-margin items to maximize gross operating margins.</li>
      `;

      // Render chart inside presentation modal
      const presCanvas = document.getElementById('presentation-chart-canvas');
      if (presCanvas && typeof Chart !== 'undefined') {
        if (presentationChartInstance) presentationChartInstance.destroy();

        const topFive = productList.slice(0, 5);
        presentationChartInstance = new Chart(presCanvas, {
          type: 'bar',
          data: {
            labels: topFive.map(p => p.name),
            datasets: [{
              label: 'Revenue (₹)',
              data: topFive.map(p => p.revenue),
              backgroundColor: '#9333ea',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
          }
        });
      }

      DOM.presentationModal.classList.remove('hidden');
    },

    closeSalesPresentation() {
      DOM.presentationModal.classList.add('hidden');
    },

    // 2. POWER: ADD PRODUCT & MANAGE MASTER CATALOG
    renderAdminCatalog() {
      const catalog = CatalogService.getCatalog();
      DOM.adminCatalogCount.textContent = catalog.length;
      DOM.adminCatalogTbody.innerHTML = '';

      if (catalog.length === 0) {
        DOM.adminCatalogTbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-400 italic">No products in Master Catalog</td></tr>`;
        return;
      }

      catalog.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-semibold text-slate-800">${escapeHtml(p.name)}</td>
          <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700">${escapeHtml(p.category || 'General')}</span></td>
          <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${AppState.meta.currency}${Number(p.price).toFixed(2)}</td>
          <td class="py-2.5 px-4 text-center">
            <button type="button" class="btn-admin-delete-product inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200/70 font-bold text-xs transition-all" data-id="${p.id}" title="Delete product">
              <i class="fa-solid fa-trash-can text-[11px]"></i>
            </button>
          </td>
        `;
        DOM.adminCatalogTbody.appendChild(tr);
      });
    },

    // 3. PICTORIAL PRODUCT SALES AS PER MONTH
    renderMonthlyProductAnalytics() {
      const selectedMonthStr = DOM.productMonthSelect.value || '2026-11';
      const [selYear, selMonth] = selectedMonthStr.split('-').map(Number);
      const history = StorageService.getHistory();
      const productStats = {};
      let totalMonthlyRevenue = 0;

      history.forEach(receipt => {
        const rDate = new Date(receipt.meta.dateTime || receipt.savedAt);
        if (rDate.getFullYear() === selYear && rDate.getMonth() + 1 === selMonth) {
          (receipt.items || []).forEach(item => {
            const name = item.name || 'Custom Item';
            const qty = Number(item.qty) || 0;
            const lineTotal = Number(item.total) || 0;

            if (!productStats[name]) productStats[name] = { qty: 0, revenue: 0 };
            productStats[name].qty += qty;
            productStats[name].revenue += lineTotal;
            totalMonthlyRevenue += lineTotal;
          });
        }
      });

      const productList = Object.keys(productStats).map(name => ({
        name: name,
        qty: productStats[name].qty,
        revenue: productStats[name].revenue,
        share: totalMonthlyRevenue > 0 ? ((productStats[name].revenue / totalMonthlyRevenue) * 100).toFixed(1) : 0
      }));

      productList.sort((a, b) => b.qty - a.qty);
      DOM.chartMonthBadge.textContent = DOM.productMonthSelect.options[DOM.productMonthSelect.selectedIndex].text;

      DOM.monthlyProductsTbody.innerHTML = '';
      if (productList.length === 0) {
        DOM.monthlyProductsTbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400 italic">No products sold in this month</td></tr>`;
      } else {
        productList.forEach((prod, idx) => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-50 transition-colors';
          tr.innerHTML = `
            <td class="py-2.5 px-4 font-bold text-slate-500">#${idx + 1}</td>
            <td class="py-2.5 px-4 font-semibold text-slate-800">${escapeHtml(prod.name)}</td>
            <td class="py-2.5 px-4 text-center font-bold text-purple-700">${prod.qty} units</td>
            <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${CalculationEngine.formatCurrency(prod.revenue)}</td>
            <td class="py-2.5 px-4 text-right font-semibold text-emerald-700">${prod.share}%</td>
          `;
          DOM.monthlyProductsTbody.appendChild(tr);
        });
      }

      this.drawPictorialCharts(productList);
    },

    drawPictorialCharts(productList) {
      if (typeof Chart === 'undefined') return;

      const topProducts = productList.slice(0, 7);
      const labels = topProducts.map(p => p.name.length > 18 ? p.name.substring(0, 16) + '..' : p.name);
      const qtyData = topProducts.map(p => p.qty);
      const revenueData = topProducts.map(p => p.revenue);

      const barCanvas = document.getElementById('product-sales-bar-chart');
      if (barCanvas && typeof Chart !== 'undefined') {
        if (productBarChartInstance) productBarChartInstance.destroy();
        productBarChartInstance = new Chart(barCanvas, {
          type: 'bar',
          data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
              label: 'Units Sold',
              data: qtyData.length ? qtyData : [0],
              backgroundColor: 'rgba(147, 51, 234, 0.85)',
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
          }
        });
      }

      const pieCanvas = document.getElementById('product-sales-pie-chart');
      if (pieCanvas && typeof Chart !== 'undefined') {
        if (productPieChartInstance) productPieChartInstance.destroy();
        productPieChartInstance = new Chart(pieCanvas, {
          type: 'doughnut',
          data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
              data: revenueData.length ? revenueData : [1],
              backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
          }
        });
      }
    },

    // 4. WORKER ROSTER WITH UNIQUE WORKER IDs
    renderWorkerRoster() {
      const users = AuthService.getUsers();
      DOM.rosterWorkerCount.textContent = users.length;
      DOM.workerRosterTbody.innerHTML = '';

      // Auto-suggest next sequential worker ID in the form
      if (DOM.newWorkerId) {
        DOM.newWorkerId.value = AuthService.getNextWorkerId();
      }

      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        const workerId = u.workerId || (u.role === 'admin' ? 'ADM-001' : 'WRK-100');

        tr.innerHTML = `
          <td class="py-3 px-5 font-semibold text-slate-800 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
              ${u.name.charAt(0)}
            </div>
            <span>${escapeHtml(u.name)}</span>
          </td>
          <td class="py-3 px-5">
            <span class="inline-block px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-purple-50 text-purple-800 border border-purple-200">
              ${escapeHtml(workerId)}
            </span>
          </td>
          <td class="py-3 px-5 text-slate-600 font-mono text-xs">${escapeHtml(u.email)}</td>
          <td class="py-3 px-5">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-brand-50 text-brand-700 border border-brand-200'}">
              ${u.role}
            </span>
          </td>
          <td class="py-3 px-5">
            <span class="text-slate-400 font-mono text-xs">•••••••••••••••• (SHA-256 Hidden)</span>
          </td>
          <td class="py-3 px-5 text-center">
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
            </span>
          </td>
          <td class="py-3 px-5 text-center">
            ${u.role === 'admin' ? '<span class="text-xs text-slate-400 italic font-semibold">Root Admin</span>' : '<button type="button" class="btn-delete-worker inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200/70 font-bold text-xs transition-all" data-email="' + escapeHtml(u.email) + '"><i class="fa-solid fa-user-slash text-[10px]"></i> Deactivate</button>'}
          </td>
        `;

        DOM.workerRosterTbody.appendChild(tr);
      });
    },

    // 5. SALES OVERVIEW
    renderAnalytics() {
      const history = StorageService.getHistory();
      const now = new Date();

      const filtered = history.filter(receipt => {
        const receiptDate = new Date(receipt.meta.dateTime || receipt.savedAt);
        if (this.activeWorker !== 'all') {
          const email = (receipt.createdBy && receipt.createdBy.email) ? receipt.createdBy.email.toLowerCase() : '';
          const cashier = (receipt.meta.cashierName || '').toLowerCase();
          const target = AuthService.getUsers().find(u => u.email.toLowerCase() === this.activeWorker.toLowerCase());
          if (email !== this.activeWorker.toLowerCase() && (!target || cashier !== target.name.toLowerCase())) return false;
        }

        if (this.activePeriod === 'day') {
          return receiptDate.getDate() === now.getDate() && receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear();
        } else if (this.activePeriod === 'week') {
          return (now - receiptDate) / (1000 * 60 * 60 * 24) <= 7;
        } else if (this.activePeriod === 'month') {
          return receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear();
        } else if (this.activePeriod === 'year') {
          return receiptDate.getFullYear() === now.getFullYear();
        }
        return true;
      });

      const totalCount = filtered.length;
      let totalRevenue = 0;
      let highestSale = 0;
      const workerVolumeMap = {};

      filtered.forEach(r => {
        const grandTotal = Number(r.billing.grandTotal) || 0;
        totalRevenue += grandTotal;
        if (grandTotal > highestSale) highestSale = grandTotal;
        const wName = (r.createdBy && r.createdBy.name) || r.meta.cashierName || 'Staff';
        workerVolumeMap[wName] = (workerVolumeMap[wName] || 0) + grandTotal;
      });

      const avgSale = totalCount > 0 ? totalRevenue / totalCount : 0;
      DOM.statTotalRevenue.textContent = CalculationEngine.formatCurrency(totalRevenue);
      DOM.statTotalReceipts.textContent = totalCount;
      DOM.statAvgSale.textContent = CalculationEngine.formatCurrency(avgSale);

      let topWorkerName = 'N/A';
      let maxSales = 0;
      for (const [name, sales] of Object.entries(workerVolumeMap)) {
        if (sales > maxSales) { maxSales = sales; topWorkerName = name; }
      }
      DOM.statTopWorker.textContent = topWorkerName;
      DOM.statTopWorkerSub.textContent = maxSales > 0 ? `${CalculationEngine.formatCurrency(maxSales)} sales volume` : 'No volume recorded';

      DOM.workerBarsContainer.innerHTML = '';
      for (const [name, sales] of Object.entries(workerVolumeMap)) {
        const percent = totalRevenue > 0 ? ((sales / totalRevenue) * 100).toFixed(1) : 0;
        const barWrapper = document.createElement('div');
        barWrapper.className = 'space-y-1';
        barWrapper.innerHTML = `
          <div class="flex justify-between text-xs font-semibold text-slate-700">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-user-tag text-purple-600"></i> ${escapeHtml(name)}</span>
            <span class="font-mono text-slate-900">${CalculationEngine.formatCurrency(sales)} (${percent}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="bg-gradient-to-r from-purple-500 to-indigo-600 h-2.5 rounded-full" style="width: ${percent}%"></div>
          </div>
        `;
        DOM.workerBarsContainer.appendChild(barWrapper);
      }

      DOM.filteredLedgerCount.textContent = `${totalCount} records`;
      DOM.adminLedgerTbody.innerHTML = '';
      filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        const cashier = (r.createdBy && r.createdBy.name) || r.meta.cashierName || 'Staff';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-mono font-bold text-slate-800">${escapeHtml(r.meta.receiptNumber)}</td>
          <td class="py-2.5 px-4 text-slate-600 text-[11px]">${formatHumanDate(r.meta.dateTime)}</td>
          <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">${escapeHtml(cashier)}</span></td>
          <td class="py-2.5 px-4 text-slate-700 font-medium">${escapeHtml(r.customer.name || 'Walk-in')}</td>
          <td class="py-2.5 px-4"><span class="text-[11px] text-slate-600 font-mono">${escapeHtml(r.meta.paymentMode)}</span></td>
          <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${CalculationEngine.formatCurrency(r.billing.grandTotal)}</td>
        `;
        DOM.adminLedgerTbody.appendChild(tr);
      });
    }
  };

  // ============================================================================
  // 16. STORAGE SERVICE
  // ============================================================================
  const StorageService = {
    saveDefaultStore(storeData) {
      try {
        localStorage.setItem(STORAGE_KEYS.STORE_DEFAULT, JSON.stringify(storeData));
        return true;
      } catch { return false; }
    },

    loadDefaultStore() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.STORE_DEFAULT);
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    },

    getHistory() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    },

    initHistorySeed() {
      const history = this.getHistory();
      if (!history || history.length === 0) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        const dToday = `${yyyy}-${mm}-${dd}T10:15`;
        const dWeekAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const strWeekAgo = `${dWeekAgo.getFullYear()}-${String(dWeekAgo.getMonth() + 1).padStart(2, '0')}-${String(dWeekAgo.getDate()).padStart(2, '0')}T14:30`;

        const dMonthAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const strMonthAgo = `${dMonthAgo.getFullYear()}-${String(dMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(dMonthAgo.getDate()).padStart(2, '0')}T16:45`;

        const dYearAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const strYearAgo = `${dYearAgo.getFullYear()}-${String(dYearAgo.getMonth() + 1).padStart(2, '0')}-${String(dYearAgo.getDate()).padStart(2, '0')}T11:20`;

        const seedTransactions = [
          {
            meta: { receiptNumber: `REC-${yyyy}${mm}${dd}-1001`, dateTime: dToday, cashierName: 'Rahul Sharma', currency: '₹', paymentMode: 'UPI QR', paymentStatus: 'PAID' },
            createdBy: { name: 'Rahul Sharma', email: 'rahul@billbuddy.com', role: 'worker' },
            customer: { name: 'Aarav Mehta', contact: '+91 98200 11223' },
            items: [
              { id: 'it_1', name: 'Logitech Wireless Mouse M185', qty: 2, price: 999, total: 1998 },
              { id: 'it_2', name: 'Braided Type-C Fast Cable 1.5m', qty: 1, price: 349, total: 349 }
            ],
            billing: { subtotal: 2347, discountAmount: 0, taxableAmount: 2347, taxRate: 18, taxAmount: 422.46, grandTotal: 2769.46 }
          },
          {
            meta: { receiptNumber: `REC-${yyyy}${mm}${dd}-1002`, dateTime: dToday, cashierName: 'Priya Patel', currency: '₹', paymentMode: 'UPI QR', paymentStatus: 'PAID' },
            createdBy: { name: 'Priya Patel', email: 'priya@billbuddy.com', role: 'worker' },
            customer: { name: 'Ananya Roy', contact: '+91 97110 55443' },
            items: [
              { id: 'it_3', name: 'Keychron K2 Mechanical Keyboard', qty: 1, price: 6999, total: 6999 }
            ],
            billing: { subtotal: 6999, discountAmount: 349.95, taxableAmount: 6649.05, taxRate: 18, taxAmount: 1196.83, grandTotal: 7845.88 }
          },
          {
            meta: { receiptNumber: `REC-${yyyy}${mm}05-2003`, dateTime: strWeekAgo, cashierName: 'Rahul Sharma', currency: '₹', paymentMode: 'UPI QR', paymentStatus: 'PAID' },
            createdBy: { name: 'Rahul Sharma', email: 'rahul@billbuddy.com', role: 'worker' },
            customer: { name: 'Vikram Singh', contact: '+91 98888 22334' },
            items: [
              { id: 'it_4', name: 'SanDisk 128GB Ultra Flash Drive', qty: 3, price: 899, total: 2697 }
            ],
            billing: { subtotal: 2697, discountAmount: 0, taxableAmount: 2697, taxRate: 18, taxAmount: 485.46, grandTotal: 3182.46 }
          },
          {
            meta: { receiptNumber: `REC-${yyyy}${mm}01-3004`, dateTime: strMonthAgo, cashierName: 'Priya Patel', currency: '₹', paymentMode: 'UPI QR', paymentStatus: 'PAID' },
            createdBy: { name: 'Priya Patel', email: 'priya@billbuddy.com', role: 'worker' },
            customer: { name: 'Kavita Nair', contact: '+91 99000 77889' },
            items: [
              { id: 'it_5', name: 'USB-C Multiport 7-in-1 Hub Adapter', qty: 1, price: 2499, total: 2499 },
              { id: 'it_6', name: 'Extended Micro-Weave Deskmat (90x40cm)', qty: 2, price: 799, total: 1598 }
            ],
            billing: { subtotal: 4097, discountAmount: 204.85, taxableAmount: 3892.15, taxRate: 18, taxAmount: 700.58, grandTotal: 4592.73 }
          },
          {
            meta: { receiptNumber: `REC-${yyyy}0115-4005`, dateTime: strYearAgo, cashierName: 'Rahul Sharma', currency: '₹', paymentMode: 'UPI QR', paymentStatus: 'PAID' },
            createdBy: { name: 'Rahul Sharma', email: 'rahul@billbuddy.com', role: 'worker' },
            customer: { name: 'Rohan Deshmukh', contact: '+91 94444 33221' },
            items: [
              { id: 'it_7', name: 'Thermal Receipt Paper Roll 80mm', qty: 5, price: 299, total: 1495 }
            ],
            billing: { subtotal: 1495, discountAmount: 0, taxableAmount: 1495, taxRate: 18, taxAmount: 269.10, grandTotal: 1764.10 }
          }
        ];

        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(seedTransactions));

        const serverLogs = seedTransactions.map((rec, i) => ({
          syncId: `SRV_SYNC_INIT_${i + 1}`,
          receiptNumber: rec.meta.receiptNumber,
          timestamp: rec.meta.dateTime,
          status: 'SAVED_200_OK',
          amount: rec.billing.grandTotal,
          currency: '₹',
          paymentMethod: 'UPI QR',
          utr: 'BANK_VERIFIED_' + Math.floor(100000 + Math.random() * 900000),
          cashier: rec.meta.cashierName,
          customer: rec.customer.name,
          itemsCount: rec.items.length,
          payload: rec
        }));
        localStorage.setItem(STORAGE_KEYS.SERVER_DB, JSON.stringify(serverLogs));
      }
    },

    saveReceiptToHistory(receiptData) {
      const history = this.getHistory();
      const existingIdx = history.findIndex(r => r.meta.receiptNumber === receiptData.meta.receiptNumber);
      if (existingIdx !== -1) {
        history[existingIdx] = receiptData;
      } else {
        history.unshift(receiptData);
      }
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    },

    deleteReceiptFromHistory(receiptNumber) {
      let history = this.getHistory();
      history = history.filter(r => r.meta.receiptNumber !== receiptNumber);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    },

    clearAllHistory() {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
  };

  // ============================================================================
  // 17. HISTORY ARCHIVE (FOR WORKER)
  // ============================================================================
  const HistoryManager = {
    updateBadge() {
      const history = StorageService.getHistory();
      DOM.historyBadge.textContent = history.length;
      DOM.historyTotalCount.textContent = history.length;
    },

    openModal() {
      this.renderHistoryList();
      DOM.historyModal.classList.remove('hidden');
    },

    closeModal() {
      DOM.historyModal.classList.add('hidden');
      DOM.historySearchInput.value = '';
    },

    renderHistoryList(filterQuery = '') {
      const history = StorageService.getHistory();
      DOM.historyTbody.innerHTML = '';
      const query = filterQuery.trim().toLowerCase();

      const filtered = history.filter(item => {
        const recNum = (item.meta.receiptNumber || '').toLowerCase();
        const custName = (item.customer.name || '').toLowerCase();
        const cashier = (item.meta.cashierName || '').toLowerCase();
        return recNum.includes(query) || custName.includes(query) || cashier.includes(query);
      });

      if (filtered.length === 0) {
        DOM.historyListEmpty.classList.remove('hidden');
        return;
      }

      DOM.historyListEmpty.classList.add('hidden');

      filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';

        tr.innerHTML = `
          <td class="py-3 font-mono font-semibold text-slate-800">${escapeHtml(item.meta.receiptNumber)}</td>
          <td class="py-3 text-slate-600 text-xs">${formatHumanDate(item.meta.dateTime)}</td>
          <td class="py-3 font-semibold text-purple-700">${escapeHtml(item.meta.cashierName || 'Staff')}</td>
          <td class="py-3 font-medium text-slate-800">${escapeHtml(item.customer.name || 'Walk-in')}</td>
          <td class="py-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800">${escapeHtml(item.meta.paymentMode)}</span></td>
          <td class="py-3 text-right font-mono font-bold text-slate-900">${CalculationEngine.formatCurrency(item.billing.grandTotal)}</td>
          <td class="py-3 text-center space-x-1.5 whitespace-nowrap">
            <button type="button" class="btn-load-history-item px-2.5 py-1 rounded bg-indigo-50 text-brand-600 hover:bg-brand-600 hover:text-white font-medium text-xs transition-colors" data-rec="${item.meta.receiptNumber}">
              Load Bill
            </button>
            <button type="button" class="btn-delete-history-item text-slate-400 hover:text-rose-600 p-1 rounded" data-rec="${item.meta.receiptNumber}">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </td>
        `;
        DOM.historyTbody.appendChild(tr);
      });
    },

    loadReceiptIntoEditor(receiptNumber) {
      const history = StorageService.getHistory();
      const target = history.find(r => r.meta.receiptNumber === receiptNumber);
      if (!target) return;

      Object.assign(AppState, JSON.parse(JSON.stringify(target)));
      AppState.isBillLocked = false;

      DOM.receiptLockedOverlay.classList.add('hidden');
      DOM.billStatusPill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
      DOM.billStatusPill.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Bill Verified & Loaded</span>`;
      DOM.btnPrint.disabled = false;
      DOM.btnDownloadPdf.disabled = false;

      syncStateToForm();
      ItemManager.renderEditableRows();
      CalculationEngine.recalculate();
      this.closeModal();
      Toast.show(`Loaded verified bill ${receiptNumber}`, 'success');
    }
  };

  // ============================================================================
  // 18. HELPER UTILITIES
  // ============================================================================
  function generateReceiptNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REC-${yyyy}${mm}${dd}-${rand}`;
  }

  function getCurrentDateTimeString() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function formatHumanDate(dateTimeStr) {
    if (!dateTimeStr) return '';
    try {
      const dt = new Date(dateTimeStr);
      if (isNaN(dt.getTime())) return dateTimeStr;

      const day = String(dt.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[dt.getMonth()];
      const year = dt.getFullYear();

      let hours = dt.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutes = String(dt.getMinutes()).padStart(2, '0');

      return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return dateTimeStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function syncStateToForm() {
    DOM.storeNameInput.value = AppState.store.name || '';
    DOM.storeTaxInput.value = AppState.store.taxId || '';
    DOM.storeAddressInput.value = AppState.store.address || '';
    DOM.storePhoneInput.value = AppState.store.phone || '';

    if (AppState.store.logo) {
      DOM.logoPreviewImg.src = AppState.store.logo;
      DOM.logoPreviewImg.classList.remove('hidden');
      DOM.logoPlaceholderIcon.classList.add('hidden');
      DOM.btnRemoveLogo.classList.remove('hidden');
    } else {
      DOM.logoPreviewImg.src = '';
      DOM.logoPreviewImg.classList.add('hidden');
      DOM.logoPlaceholderIcon.classList.remove('hidden');
      DOM.btnRemoveLogo.classList.add('hidden');
    }

    DOM.customerNameInput.value = AppState.customer.name || '';
    DOM.customerContactInput.value = AppState.customer.contact || '';
    DOM.cashierNameInput.value = AppState.meta.cashierName || (AppState.currentUser ? AppState.currentUser.name : 'Staff');

    DOM.receiptNumberInput.value = AppState.meta.receiptNumber;
    DOM.receiptDateInput.value = AppState.meta.dateTime;
    DOM.currencySelect.value = AppState.meta.currency;
    DOM.receiptNotesInput.value = AppState.meta.notes;

    DOM.currencyLabels.forEach(lbl => (lbl.textContent = AppState.meta.currency));
    DOM.discountValueInput.value = AppState.billing.discountValue;

    if (AppState.billing.discountType === 'percent') {
      DOM.btnDiscountPercent.classList.add('active');
      DOM.btnDiscountFlat.classList.remove('active');
      DOM.discountSymbolIndicator.textContent = '%';
    } else {
      DOM.btnDiscountFlat.classList.add('active');
      DOM.btnDiscountPercent.classList.remove('active');
      DOM.discountSymbolIndicator.textContent = AppState.meta.currency;
    }

    const taxRate = AppState.billing.taxRate;
    DOM.taxCustomInput.value = taxRate;
    const standardPresets = ['0', '5', '12', '18', '28'];
    if (standardPresets.includes(String(taxRate))) {
      DOM.taxPresetSelect.value = String(taxRate);
      DOM.taxCustomInput.readOnly = true;
      DOM.taxCustomInput.classList.add('bg-slate-100', 'text-slate-500');
    } else {
      DOM.taxPresetSelect.value = 'custom';
      DOM.taxCustomInput.readOnly = false;
      DOM.taxCustomInput.classList.remove('bg-slate-100', 'text-slate-500');
    }
  }

  // ============================================================================
  // 19. EVENT WIRING & LISTENERS
  // ============================================================================
  function setupEventListeners() {
    // 1. Splash Sign-In Form (Explicit User Entry)
    DOM.btnSplashSignin.addEventListener('click', () => {
      AuthService.login(DOM.splashEmail.value, DOM.splashPassword.value);
    });

    DOM.splashEmail.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        AuthService.login(DOM.splashEmail.value, DOM.splashPassword.value);
      }
    });

    DOM.splashPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        AuthService.login(DOM.splashEmail.value, DOM.splashPassword.value);
      }
    });

    // 2. Logout
    DOM.btnLogout.addEventListener('click', () => AuthService.logout());

    // 3. Worker POS Form Inputs
    DOM.storeNameInput.addEventListener('input', e => { AppState.store.name = e.target.value; ReceiptRenderer.render(); });
    DOM.storeTaxInput.addEventListener('input', e => { AppState.store.taxId = e.target.value; ReceiptRenderer.render(); });
    DOM.storeAddressInput.addEventListener('input', e => { AppState.store.address = e.target.value; ReceiptRenderer.render(); });
    DOM.storePhoneInput.addEventListener('input', e => { AppState.store.phone = e.target.value; ReceiptRenderer.render(); });

    DOM.btnSaveStoreDefault.addEventListener('click', () => {
      StorageService.saveDefaultStore(AppState.store);
      Toast.show('Store configuration saved as default', 'success');
    });

    DOM.logoUploadInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        AppState.store.logo = ev.target.result;
        syncStateToForm();
        ReceiptRenderer.render();
      };
      reader.readAsDataURL(file);
    });

    DOM.btnRemoveLogo.addEventListener('click', () => {
      AppState.store.logo = null;
      syncStateToForm();
      ReceiptRenderer.render();
    });

    DOM.btnRegenReceiptNo.addEventListener('click', () => {
      AppState.meta.receiptNumber = generateReceiptNumber();
      DOM.receiptNumberInput.value = AppState.meta.receiptNumber;
      ReceiptRenderer.render();
      Toast.show('Generated new receipt number', 'info');
    });

    DOM.receiptDateInput.addEventListener('change', e => { AppState.meta.dateTime = e.target.value; ReceiptRenderer.render(); });
    DOM.customerNameInput.addEventListener('input', e => { AppState.customer.name = e.target.value; ReceiptRenderer.render(); });
    DOM.customerContactInput.addEventListener('input', e => { AppState.customer.contact = e.target.value; ReceiptRenderer.render(); });

    // 4. Dynamic Items Table (Adding, editing, autocomplete, custom entries)
    DOM.btnAddItem.addEventListener('click', () => ItemManager.addItem('', 1, 0));
    DOM.btnPickCatalogRow.addEventListener('click', () => CatalogService.openWorkerCatalogModal());
    DOM.btnQuickCatalogPicker.addEventListener('click', () => CatalogService.openWorkerCatalogModal());
    DOM.btnClearItems.addEventListener('click', () => ItemManager.clearAllItems());

    DOM.itemsTbody.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const item = AppState.items.find(i => i.id === tr.dataset.id);
      if (!item) return;

      if (e.target.classList.contains('item-name-input')) {
        item.name = e.target.value;
        const catalog = CatalogService.getCatalog();
        const matched = catalog.find(p => p.name.toLowerCase() === e.target.value.trim().toLowerCase());
        if (matched) {
          item.price = matched.price;
          const pInput = tr.querySelector('.item-price-input');
          if (pInput) pInput.value = matched.price;
        }
      } else if (e.target.classList.contains('item-qty-input')) {
        item.qty = Math.max(1, Number(e.target.value) || 1);
      } else if (e.target.classList.contains('item-price-input')) {
        item.price = Math.max(0, Number(e.target.value) || 0);
      }

      CalculationEngine.recalculate();
    });

    DOM.itemsTbody.addEventListener('click', e => {
      const del = e.target.closest('.btn-delete-row');
      if (del) {
        const tr = del.closest('tr');
        if (tr) ItemManager.removeItem(tr.dataset.id);
        return;
      }
      const saveCat = e.target.closest('.btn-save-item-to-catalog');
      if (saveCat) {
        const tr = saveCat.closest('tr');
        const item = AppState.items.find(i => i.id === tr.dataset.id);
        if (item && item.name.trim()) {
          CatalogService.addProduct(item.name, 'Custom POS Items', item.price);
        } else {
          Toast.show('Please enter item name first', 'warning');
        }
      }
    });

    // 5. Billing, Currency, Tax
    DOM.currencySelect.addEventListener('change', e => {
      AppState.meta.currency = e.target.value;
      DOM.currencyLabels.forEach(lbl => (lbl.textContent = AppState.meta.currency));
      CalculationEngine.recalculate();
    });

    DOM.btnDiscountPercent.addEventListener('click', () => {
      AppState.billing.discountType = 'percent';
      DOM.btnDiscountPercent.classList.add('active');
      DOM.btnDiscountFlat.classList.remove('active');
      DOM.discountSymbolIndicator.textContent = '%';
      CalculationEngine.recalculate();
    });

    DOM.btnDiscountFlat.addEventListener('click', () => {
      AppState.billing.discountType = 'flat';
      DOM.btnDiscountFlat.classList.add('active');
      DOM.btnDiscountPercent.classList.remove('active');
      DOM.discountSymbolIndicator.textContent = AppState.meta.currency;
      CalculationEngine.recalculate();
    });

    DOM.discountValueInput.addEventListener('input', e => {
      AppState.billing.discountValue = Math.max(0, Number(e.target.value) || 0);
      CalculationEngine.recalculate();
    });

    DOM.taxPresetSelect.addEventListener('change', e => {
      const val = e.target.value;
      if (val === 'custom') {
        DOM.taxCustomInput.readOnly = false;
        DOM.taxCustomInput.classList.remove('bg-slate-100', 'text-slate-500');
        DOM.taxCustomInput.focus();
      } else {
        DOM.taxCustomInput.readOnly = true;
        DOM.taxCustomInput.classList.add('bg-slate-100', 'text-slate-500');
        DOM.taxCustomInput.value = val;
        AppState.billing.taxRate = Number(val);
        CalculationEngine.recalculate();
      }
    });

    DOM.taxCustomInput.addEventListener('input', e => {
      AppState.billing.taxRate = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      CalculationEngine.recalculate();
    });

    DOM.receiptNotesInput.addEventListener('input', e => {
      AppState.meta.notes = e.target.value;
      ReceiptRenderer.render();
    });

    // 6. Multi-Option Payment Gateway Triggers & Verification (Worker only)
    DOM.btnProceedToPayment.addEventListener('click', () => PaymentGateway.openModal());
    DOM.btnOverlayOpenPayment.addEventListener('click', () => PaymentGateway.openModal());
    DOM.btnClosePaymentModal.addEventListener('click', () => PaymentGateway.closeModal());
    DOM.btnCancelPayment.addEventListener('click', () => PaymentGateway.closeModal());

    // Payment Mode Tabs
    if (DOM.tabBtnCash) DOM.tabBtnCash.addEventListener('click', () => PaymentGateway.switchTab('Cash'));
    if (DOM.tabBtnCredit) DOM.tabBtnCredit.addEventListener('click', () => PaymentGateway.switchTab('Credit Card'));
    if (DOM.tabBtnDebit) DOM.tabBtnDebit.addEventListener('click', () => PaymentGateway.switchTab('Debit Card'));
    if (DOM.tabBtnUpi) DOM.tabBtnUpi.addEventListener('click', () => PaymentGateway.switchTab('UPI QR'));

    // Cash Mode Listeners
    if (DOM.inputCashTendered) {
      DOM.inputCashTendered.addEventListener('input', () => PaymentGateway.updateCashChange());
    }
    document.querySelectorAll('.btn-cash-preset').forEach(btn => {
      btn.addEventListener('click', () => PaymentGateway.setCashPreset(btn.dataset.preset));
    });
    if (DOM.btnConfirmCash) {
      DOM.btnConfirmCash.addEventListener('click', () => PaymentGateway.verifyCash());
    }

    // Credit Card Mode Listeners
    if (DOM.btnGenerateCreditAuth) {
      DOM.btnGenerateCreditAuth.addEventListener('click', () => {
        DOM.creditAuthCode.value = PaymentGateway.generateAuthCode('CC');
      });
    }
    if (DOM.btnConfirmCredit) {
      DOM.btnConfirmCredit.addEventListener('click', () => PaymentGateway.verifyCreditCard());
    }

    // Debit Card Mode Listeners
    if (DOM.btnGenerateDebitAuth) {
      DOM.btnGenerateDebitAuth.addEventListener('click', () => {
        DOM.debitAuthCode.value = PaymentGateway.generateAuthCode('DB');
      });
    }
    if (DOM.btnConfirmDebit) {
      DOM.btnConfirmDebit.addEventListener('click', () => PaymentGateway.verifyDebitCard());
    }

    // UPI QR Mode Listeners
    if (DOM.btnSimulateCustomerPaid) {
      DOM.btnSimulateCustomerPaid.addEventListener('click', () => PaymentGateway.verifyUpi());
    }
    if (DOM.btnManualVerifyUtr) {
      DOM.btnManualVerifyUtr.addEventListener('click', () => {
        const utr = (DOM.inputPaymentUtr.value || '').trim();
        if (!utr || utr.length < 6) {
          Toast.show('Please enter a valid 12-digit UPI UTR / Reference ID', 'warning');
          return;
        }
        PaymentGateway.verifyUpi(utr);
      });
    }

    // Generate Bill & Commit to Server Database
    DOM.btnCompleteAndUnlock.addEventListener('click', () => {
      PaymentGateway.completeAndGenerateBill();
    });

    DOM.btnResetNewSale.addEventListener('click', () => {
      AppState.customer = { name: 'Walk-in Customer', contact: '' };
      AppState.meta.receiptNumber = generateReceiptNumber();
      AppState.meta.dateTime = getCurrentDateTimeString();
      AppState.items = [{ id: ItemManager.generateItemId(), name: '', qty: 1, price: 0, total: 0 }];
      AppState.isBillLocked = true;

      DOM.receiptLockedOverlay.classList.remove('hidden');
      DOM.billStatusPill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200';
      DOM.billStatusPill.innerHTML = `<i class="fa-solid fa-clock"></i><span>Payment Pending</span>`;
      DOM.btnPrint.disabled = true;
      DOM.btnDownloadPdf.disabled = true;

      syncStateToForm();
      ItemManager.renderEditableRows();
      CalculationEngine.recalculate();
      Toast.show('Started fresh transaction', 'info');
    });

    DOM.btnFormatThermal.addEventListener('click', () => ReceiptRenderer.setFormat('thermal'));
    DOM.btnFormatA4.addEventListener('click', () => ReceiptRenderer.setFormat('a4'));
    DOM.btnPrint.addEventListener('click', () => {
      // 1. Invoke browser print dialog
      window.print();

      // 2. Clear line items & reset POS for the next customer
      AppState.customer = { name: 'Walk-in Customer', contact: '' };
      AppState.meta.receiptNumber = generateReceiptNumber();
      AppState.meta.dateTime = getCurrentDateTimeString();
      AppState.meta.paymentStatus = 'PENDING';
      AppState.meta.paymentDetails = null;
      AppState.items = [{ id: ItemManager.generateItemId(), name: '', qty: 1, price: 0, total: 0 }];
      AppState.isBillLocked = true;

      DOM.receiptLockedOverlay.classList.remove('hidden');
      DOM.billStatusPill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200';
      DOM.billStatusPill.innerHTML = `<i class="fa-solid fa-clock"></i><span>Payment Pending</span>`;
      DOM.btnPrint.disabled = true;
      DOM.btnDownloadPdf.disabled = true;

      syncStateToForm();
      ItemManager.renderEditableRows();
      CalculationEngine.recalculate();
      ReceiptRenderer.render();

      Toast.show('Bill printed! Line items cleared for the next customer.', 'info');
    });

    DOM.btnDownloadPdf.addEventListener('click', () => {
      const opt = {
        margin: AppState.meta.formatMode === 'thermal' ? [4, 4, 4, 4] : [10, 10, 10, 10],
        filename: `${AppState.meta.receiptNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm', format: AppState.meta.formatMode === 'thermal' ? [80, 240] : 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(DOM.receiptPaper).save();
    });

    // 7. Admin Company Profile Settings (Authority to change Company Name)
    if (DOM.btnAdminSaveCompany) {
      DOM.btnAdminSaveCompany.addEventListener('click', () => {
        AdminModule.saveCompanySettings(
          DOM.adminCompanyName.value,
          DOM.adminCompanyTax.value,
          DOM.adminCompanyAddress.value,
          DOM.adminCompanyPhone.value
        );
      });
    }

    // 8. Admin Monthly Pictorial Analytics & Presentation
    DOM.productMonthSelect.addEventListener('change', () => {
      AdminModule.renderMonthlyProductAnalytics();
    });

    DOM.btnOpenSalesPresentation.addEventListener('click', () => {
      AdminModule.openSalesPresentation();
    });

    DOM.btnClosePresentationModal.addEventListener('click', () => {
      AdminModule.closeSalesPresentation();
    });

    DOM.btnClosePresentationModalFooter.addEventListener('click', () => {
      AdminModule.closeSalesPresentation();
    });

    DOM.btnPrintPresentation.addEventListener('click', () => {
      window.print();
    });

    // 9. Admin Add Products to Master Catalog
    DOM.btnAdminAddProduct.addEventListener('click', () => {
      const name = DOM.adminCatNewName.value;
      const cat = DOM.adminCatNewCategory.value;
      const price = DOM.adminCatNewPrice.value;
      if (CatalogService.addProduct(name, cat, price)) {
        DOM.adminCatNewName.value = '';
        DOM.adminCatNewCategory.value = '';
        DOM.adminCatNewPrice.value = '';
      }
    });

    DOM.adminCatalogTbody.addEventListener('click', e => {
      const delBtn = e.target.closest('.btn-admin-delete-product');
      if (delBtn) {
        CatalogService.deleteProduct(delBtn.dataset.id);
      }
    });

    // 10. Admin Worker Provisioning with Worker ID
    DOM.btnCreateWorkerAccount.addEventListener('click', () => {
      const workerId = DOM.newWorkerId ? DOM.newWorkerId.value : '';
      const name = DOM.newWorkerName.value;
      const email = DOM.newWorkerEmail.value;
      const pass = DOM.newWorkerPassword.value;
      const success = AuthService.provisionWorker(workerId, name, email, pass);
      if (success) {
        if (DOM.newWorkerId) DOM.newWorkerId.value = AuthService.getNextWorkerId();
        DOM.newWorkerName.value = '';
        DOM.newWorkerEmail.value = '';
        DOM.newWorkerPassword.value = '';
      }
    });

    if (DOM.btnAutoWorkerId) {
      DOM.btnAutoWorkerId.addEventListener('click', () => {
        DOM.newWorkerId.value = AuthService.getNextWorkerId();
        Toast.show(`New Worker ID generated: ${DOM.newWorkerId.value}`, 'info');
      });
    }

    DOM.workerRosterTbody.addEventListener('click', e => {
      const delBtn = e.target.closest('.btn-delete-worker');
      if (delBtn) {
        const email = delBtn.dataset.email;
        if (confirm(`Are you sure you want to deactivate staff account ${email}?`)) {
          let users = AuthService.getUsers().filter(u => u.email !== email);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          AdminModule.renderWorkerRoster();
          Toast.show(`Account ${email} deactivated`, 'info');
        }
      }
    });

    // 10. Admin QR Settings
    DOM.btnSaveQrConfig.addEventListener('click', () => {
      QrConfigService.saveQrConfig(
        DOM.adminQrUpiId.value,
        DOM.adminQrMerchantName.value,
        DOM.adminQrNotes.value
      );
    });

    DOM.adminCustomQrFile.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        AppState.qrConfig.customQrImage = ev.target.result;
        QrConfigService.renderAdminQrPreview();
        Toast.show('Custom QR image applied!', 'success');
      };
      reader.readAsDataURL(file);
    });

    DOM.btnResetDynamicQr.addEventListener('click', () => {
      AppState.qrConfig.customQrImage = null;
      QrConfigService.renderAdminQrPreview();
      Toast.show('Reset to Dynamic UPI QR Code generator', 'info');
    });

    // 11. Admin Sales Filter
    DOM.adminFilterWorker.addEventListener('change', e => {
      AdminModule.activeWorker = e.target.value;
      AdminModule.renderAnalytics();
    });

    DOM.adminTimeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.adminTimeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AdminModule.activePeriod = btn.dataset.period;
        AdminModule.renderAnalytics();
      });
    });

    // 12. Server DB Export
    DOM.btnExportServerJson.addEventListener('click', () => {
      const db = ServerAPI.getServerDb();
      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
      const a = document.createElement('a');
      a.href = jsonStr;
      a.download = `Server_Database_Dump_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      Toast.show('Server Database exported to JSON', 'success');
    });

    // 13. Worker Catalog Modal
    DOM.btnOpenCatalog.addEventListener('click', () => CatalogService.openWorkerCatalogModal());
    DOM.btnCloseCatalogModal.addEventListener('click', () => CatalogService.closeWorkerCatalogModal());
    DOM.btnCloseCatalogModalFooter.addEventListener('click', () => CatalogService.closeWorkerCatalogModal());
    DOM.catalogSearchInput.addEventListener('input', e => CatalogService.renderWorkerCatalogList(e.target.value));

    DOM.catalogTbody.addEventListener('click', e => {
      const pick = e.target.closest('.btn-catalog-pick-to-receipt');
      if (pick) {
        ItemManager.addItem(pick.dataset.name, 1, Number(pick.dataset.price) || 0);
        Toast.show(`Added "${pick.dataset.name}" to POS`, 'success');
        CatalogService.closeWorkerCatalogModal();
      }
    });

    // 14. History Modal (Worker)
    DOM.btnOpenHistory.addEventListener('click', () => HistoryManager.openModal());
    DOM.btnCloseHistoryModal.addEventListener('click', () => HistoryManager.closeModal());
    DOM.btnCloseHistoryModalFooter.addEventListener('click', () => HistoryManager.closeModal());
    DOM.historySearchInput.addEventListener('input', e => HistoryManager.renderHistoryList(e.target.value));

    DOM.historyTbody.addEventListener('click', e => {
      const load = e.target.closest('.btn-load-history-item');
      if (load) {
        HistoryManager.loadReceiptIntoEditor(load.dataset.rec);
        return;
      }
      const del = e.target.closest('.btn-delete-history-item');
      if (del) {
        StorageService.deleteReceiptFromHistory(del.dataset.rec);
        HistoryManager.updateBadge();
        HistoryManager.renderHistoryList();
      }
    });

    DOM.btnClearAllHistory.addEventListener('click', () => {
      if (confirm('Clear all receipts history?')) {
        StorageService.clearAllHistory();
        HistoryManager.updateBadge();
        HistoryManager.renderHistoryList();
      }
    });

    DOM.btnExportHistoryJson.addEventListener('click', () => {
      const h = StorageService.getHistory();
      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(h, null, 2));
      const a = document.createElement('a');
      a.href = jsonStr;
      a.download = `BillBuddy_History_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    // Backdrop clicks
    [DOM.paymentModal, DOM.catalogModal, DOM.historyModal, DOM.presentationModal].forEach(m => {
      m.addEventListener('click', e => {
        if (e.target === m) m.classList.add('hidden');
      });
    });
  }

  // ============================================================================
  // 20. APPLICATION INITIALIZATION LIFECYCLE
  // ============================================================================
  function migrateLegacyStorage() {
    const legacyKeys = [
      ['SMART_RECEIPT_DEFAULT_STORE', 'BILLBUDDY_DEFAULT_STORE'],
      ['SMART_RECEIPT_HISTORY', 'BILLBUDDY_HISTORY'],
      ['SMART_RECEIPT_USERS', 'BILLBUDDY_USERS'],
      ['SMART_RECEIPT_SESSION', 'BILLBUDDY_SESSION'],
      ['SMART_RECEIPT_CATALOG', 'BILLBUDDY_CATALOG'],
      ['SMART_RECEIPT_QR_CONFIG', 'BILLBUDDY_QR_CONFIG'],
      ['SMART_RECEIPT_SERVER_DB', 'BILLBUDDY_SERVER_DB']
    ];
    legacyKeys.forEach(([oldKey, newKey]) => {
      try {
        const val = localStorage.getItem(oldKey);
        if (val && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
        }
      } catch (e) {}
    });
  }

  function init() {
    migrateLegacyStorage();
    StorageService.initHistorySeed();
    CatalogService.initCatalog();
    QrConfigService.initQrConfig();
    AdminModule.initAdmin();

    const savedStore = StorageService.loadDefaultStore();
    if (savedStore) AppState.store = savedStore;

    AppState.meta.receiptNumber = generateReceiptNumber();
    AppState.meta.dateTime = getCurrentDateTimeString();

    syncStateToForm();
    ItemManager.initDefaultItems();
    HistoryManager.updateBadge();

    setupEventListeners();
    ReceiptRenderer.render();

    // Authenticate / Splash Gate
    AuthService.initUsers();

    console.log('BillBuddy loaded with strict role separation and presentation capabilities.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
