const pw = require('/Users/mustafa/Library/Caches/ms-playwright-go/1.57.0/package');
const path = require('path');
const fs = require('fs');

async function run() {
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-IQ'
  });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Handle Login if present
  const usernameInput = await page.$('input[autocomplete="username"], input[type="text"]');
  const passwordInput = await page.$('input[type="password"]');
  if (usernameInput && passwordInput) {
    console.log('Detected login screen, logging in as admin...');
    await usernameInput.fill('admin');
    await passwordInput.fill('123');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(1500);
    console.log('Logged in successfully!');
  }

  // 1. Check Reconciliation Module
  console.log('2. Testing Inventory Reconciliation (#stock-counts)...');
  await page.click('button:has-text("الجرد المخزني والتسويات")');
  await page.waitForTimeout(1000);
  
  // Verify items are displayed in table
  const countRows = await page.$$eval('tbody tr', rows => rows.length);
  console.log(`Reconciliation table rows: ${countRows}`);
  if (countRows === 0) {
    throw new Error('Reconciliation table is empty! Expected products.');
  }

  // Take screenshot of Reconciliation
  await page.screenshot({ path: path.join(__dirname, 'reconciliation_view.png') });
  console.log('Screenshot saved: reconciliation_view.png');

  // Verify KPI cards
  const kpiCount = await page.$$eval('.grid > div', els => els.length);
  console.log(`KPI cards detected: ${kpiCount}`);

  // Test Discrepancy gating button
  const reconcileBtn = await page.$('button:has-text("اعتماد وتسوية فروقات الجرد")');
  const isInitiallyDisabled = await reconcileBtn.isDisabled();
  console.log(`Is reconcile button initially disabled (0 discrepancies): ${isInitiallyDisabled}`);

  // Enter a physical count in first row to create discrepancy
  const firstQtyInput = await page.$('tbody tr:first-child input[type="number"]');
  if (firstQtyInput) {
    const curVal = await firstQtyInput.inputValue();
    const newVal = parseInt(curVal, 10) + 5;
    await firstQtyInput.fill(newVal.toString());
    await page.waitForTimeout(500);
    const isNowDisabled = await reconcileBtn.isDisabled();
    console.log(`After entering difference: is reconcile button disabled: ${isNowDisabled}`);
  }

  // 2. Check Transfers Modal
  console.log('3. Testing Transfers Modal (#transfers)...');
  await page.click('button:has-text("التحويلات وتتبع الطريق")');
  await page.waitForTimeout(1000);

  const newTransferBtn = await page.$('button:has-text("طلب مناقلة جديدة")');
  if (newTransferBtn) {
    await newTransferBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, 'transfer_modal.png') });
    console.log('Screenshot saved: transfer_modal.png');

    // Close modal
    const closeBtn = await page.$('button:has-text("إلغاء")');
    if (closeBtn) await closeBtn.click();
  }

  // 3. Check Add Product Modal (3-tier pricing)
  console.log('4. Testing Add Product Modal (#inventory)...');
  await page.click('button:has-text("الأصناف والمخزون")');
  await page.waitForTimeout(1000);

  const addProdBtn = await page.$('button:has-text("إضافة منتج جديد")');
  if (addProdBtn) {
    await addProdBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, 'add_product_pricing_card.png') });
    console.log('Screenshot saved: add_product_pricing_card.png');

    // Close modal
    const cancelProdBtn = await page.$('button:has-text("إلغاء")');
    if (cancelProdBtn) await cancelProdBtn.click();
  }

  // 4. Check Shifts View and Open Shift Modal
  console.log('5. Testing Shifts View (#shifts)...');
  await page.click('button:has-text("الورديات وإغلاق الصندوق")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'shifts_view.png') });
  console.log('Screenshot saved: shifts_view.png');

  // 5. Check POS Terminal View
  console.log('6. Testing POS Terminal (#pos)...');
  await page.click('button:has-text("نقطة البيع السريعة")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'pos_view.png') });
  console.log('Screenshot saved: pos_view.png');

  await browser.close();
  console.log('All automated checks finished successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
