const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto(`file://${path.resolve('index.html')}`);
  await page.waitForTimeout(3000); // Wait for async DB init
  
  await browser.close();
})();
