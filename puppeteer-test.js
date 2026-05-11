const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5174/login');

  // Try to interact or see if there are any immediate errors.
  console.log('Navigated to login...');

  // Close
  await new Promise(resolve => setTimeout(resolve, 5000));
  await browser.close();
})();
