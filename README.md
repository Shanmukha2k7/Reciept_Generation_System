# BillBuddy - Enterprise POS & Sales Intelligence System
**Academic Project for BTech Software Engineering**

BillBuddy is an enterprise-grade Point of Sale (POS) and Sales Intelligence web application. Built using **HTML5, Tailwind CSS / CSS3, Vanilla JavaScript, Chart.js, and QRCode.js**, it incorporates strict Role-Based Access Control (RBAC), an initial brand splash sign-in gate with manual credential entry (supports Worker ID or Email), dynamic multi-method payment verification (Cash, Credit Card, Debit Card, UPI QR), monthly pictorial product analytics, company name branding management, worker ID provisioning, auto-clearing line items upon printing, and persistent server database logging.

---

## 🌟 Key Architecture & Strict Role Isolation

### 1. Initial Splash & Mandatory Manual Sign-In Gate
- **No Pre-Filled Default Credentials:** The input fields for **User ID / Worker ID / Email** and **Password** are completely blank. The user enters their credentials directly without any CAPTCHA roadblock.
- **Worker ID or Email Login:** Staff can sign in quickly using their assigned Worker ID (e.g. `ADM-001`, `WRK-101`) or their email address.
- **Strict Role Routing:** Upon authentication, the system automatically redirects the user exclusively to their designated portal:
  - **Workers** are routed directly to the **Worker POS Billing Console**.
  - **Administrators** are routed directly to the **Admin Executive Management Console**.

### 2. Strict Portal Separation (No Cross-Over)
- **Workers CANNOT See Admin Portal:**
  - The worker terminal contains zero admin controls, zero admin links, and no dashboard switchers.
  - Workers focus exclusively on customer billing, custom/catalog item additions, payment verification, and official bill generation.
  - **Auto-Clearing Line Items:** Upon clicking "Print Bill", the current receipt prints, line items are instantly cleared, and the POS automatically resets with a fresh receipt number for the next customer.
- **Admin CANNOT Switch to Worker Portal & Does NOT Do Bill Payment:**
  - The administrator is restricted exclusively to executive oversight and business management.
  - The administrator cannot switch to the cashier portal or generate customer bills.
  - Admin has five explicit core powers:
    1. **Change Company Name & Store Profile:** Update Store/Company Name, Tax/GSTIN ID, Address, and Phone number with instant live preview synchronization.
    2. **Provision Workers with New Worker IDs:** Assign staff new worker IDs (e.g., `WRK-103`), names, emails, and passwords without exposing credentials.
    3. **Make Presentations on Product Sales:** High-impact monthly pictorial presentations with KPI cards, Chart.js visual distributions, and inventory takeaways.
    4. **Add & Manage Products:** Full control over the Master Product Catalog, setting categories, descriptions, and default unit prices.
    5. **Configure Store QR Code:** Configure the merchant UPI ID / VPA, merchant display name, and custom QR images.

### 3. Multi-Option Payment Gateway & Verification Check
- **Four Integrated Payment Methods:**
  1. **Cash:** Input Cash Received (Tendered) by customer, quick denomination preset buttons (Exact Due, ₹100, ₹200, ₹500, ₹1000, ₹2000), real-time calculation of **Change to Return**, and shortage alerts if insufficient.
  2. **Credit Card:** Select card network (Visa, Mastercard, RuPay, Amex), input Cardholder Name & last 4 digits, simulate POS EDC Terminal Authorization with approval code / RRN generator.
  3. **Debit Card:** Select issuing bank (SBI, HDFC, ICICI, Axis, PNB, Kotak, RuPay), input last 4 digits, simulate PIN Pad terminal verification and auth code.
  4. **UPI QR Code:** Dynamic UPI QR Code (`upi://pay?pa=...&am=...&tn=...`) matching exact payable total and receipt number, with manual 12-digit UTR verification and bank simulation.
- **Strict Bill Locking ("After payment bill must be generated"):**
  - The live receipt preview is blurred and locked behind a security overlay while payment is pending.
  - The official bill is unlocked, generated, stamped with verified payment metadata, and made available for printing and PDF export **strictly after payment verification is confirmed across whichever payment method was chosen**.

### 4. Admin Provisioning of Worker Credentials & Store Settings
- Administrators can onboard new employees in the **Provision Workers** tab by specifying Worker ID (or click "Auto ID"), Full Name, Email, and Initial Password.
- **Zero-Knowledge Privacy:**
  - Passwords are one-way hashed using **SHA-256** prior to storage.
  - In the Staff Roster table, plain-text passwords are never exposed (`•••••••••••••••• (SHA-256 Hidden)`).

### 5. Admin Monthly Product Sales Presentation & Pictorial Charts
- Under the **"Product Sales & Presentation"** tab in the Admin Portal:
  - **Month Selector:** Switch between months (e.g., November 2026, October 2026, September 2026, etc.).
  - **Pictorial Visualizations (Chart.js):**
    - **Bar Chart:** Displays units sold per product in descending order.
    - **Doughnut / Pie Chart:** Displays percentage revenue contribution per product.
  - **"Make Sales Presentation" Action Button:**
    - Opens a full-screen, slide-deck presentation view summarizing:
      - Top Revenue Product & Highest Volume Product.
      - Total Monthly Verified Catalog Revenue.
      - Pictorial sales distribution graph.
      - Executive takeaways and inventory procurement recommendations.
      - 1-click printable presentation deck.

### 6. Permanent Server Database Persistence ("Definitely Save in Server")
- Every verified payment is permanently committed to the server database (`BILLBUDDY_SERVER_DB`).
- Includes Server Sync IDs (`SRV_SYNC_...`), exact timestamps, status `SAVED_200_OK`, transaction IDs, cashier attribution, and itemized payloads.
- Includes a dedicated **Server Database** tab in the Admin panel and a 1-click button to export the entire server database as a JSON audit dump.

---

## 🔑 Login Credentials for Testing & Evaluation

Please enter these credentials manually on the initial splash login screen:

### Administrator Account (Executive Console Only)
- **Worker ID:** `ADM-001` (or Email: `admin@billbuddy.com`)
- **Password:** `Admin@123`
- *Access:* Company Profile, Provision Workers, Monthly Product Sales Presentation, Add Products, Configure QR Code, and Server Database.

### Worker / Cashier Accounts (POS Billing Only)
- **Cashier 1:**
  - **Worker ID:** `WRK-101` (or Email: `rahul@billbuddy.com`)
  - **Password:** `Worker@123`
- **Cashier 2:**
  - **Worker ID:** `WRK-102` (or Email: `priya@billbuddy.com`)
  - **Password:** `Worker@123`
- *Access:* POS cashier desk, dynamic item entry, multi-option payment verification, and bill printing with auto-clearing.

---

## 🚀 How to Run the Project

1. Navigate to:
   `C:\Users\shanm\.gemini\antigravity\scratch\receipt-generator\`
2. Double-click **`index.html`** to launch the web application in Google Chrome, Microsoft Edge, Brave, or Firefox.
3. The initial splash screen will prompt you to enter your User ID / Worker ID and Password.
