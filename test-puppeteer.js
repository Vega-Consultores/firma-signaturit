const puppeteer = require('puppeteer');

(async () => {
  // Launch Chromium without sandbox
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Get and print version
  const version = await browser.version();
  console.log('Browser version:', version);

  await browser.close();
})();
