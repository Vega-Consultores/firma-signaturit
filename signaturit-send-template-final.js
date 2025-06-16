// signaturit-send-template-final.js

const puppeteer = require('puppeteer');

(async () => {
    const startTime = Date.now();
    let browser = null; // Define browser in the outer scope for the finally block

    // ─── ARG PARSING ────────────────────────────────────────────────
    // Usage: node signaturit-send-template-final.js "<Name>" "<Email>" "<Template Name>"
    const [, , RECIPIENT_NAME, RECIPIENT_EMAIL, TEMPLATE_NAME] = process.argv;
    console.log(`[${new Date(startTime).toISOString()}] Script called with Name: ${RECIPIENT_NAME}, Email: ${RECIPIENT_EMAIL}, Template: ${TEMPLATE_NAME}`);

    if (!RECIPIENT_NAME || !RECIPIENT_EMAIL || !TEMPLATE_NAME) {
        console.error(`[${new Date().toISOString()}] Usage: node signaturit-send-template-final.js "<Name>" "<Email>" "<Template Name>"`);
        console.error(`[${new Date().toISOString()}] Received: Name=${RECIPIENT_NAME}, Email=${RECIPIENT_EMAIL}, Template=${TEMPLATE_NAME}`);
        process.exitCode = 1; // Set exit code for error
        return; // Exit if args are missing
    }

    // ─── STATIC CONFIG ─────────────────────────────────────────────
    const EMAIL = 'victorortin@vegaconsultores.es'; // Hardcoded as per your script
    const PASSWORD = 'luigivega95'; // Hardcoded as per your script
    const COOKIE_SELECTOR = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
    // ─────────────────────────────────────────────────────────────────

    try {
        console.log(`[${new Date().toISOString()}] Launching Puppeteer...`);
        browser = await puppeteer.launch({
            headless: true, // MUST be true for server environments like Railway
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Uses Chromium from Dockerfile
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Crucial for Docker/CI environments
                '--disable-accelerated-2d-canvas',
                '--disable-gpu', // Often necessary in headless environments
                '--window-size=1920,1080' // Define a consistent window size
            ]
        });
        console.log(`[${new Date().toISOString()}] Puppeteer launched. Opening new page...`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 }); // Ensure viewport is set
        console.log(`[${new Date().toISOString()}] Page opened.`);

        // 2. Login + dismiss cookies
        console.log(`[${new Date().toISOString()}] Navigating to Signaturit login: https://app.signaturit.com`);
        await page.goto('https://app.signaturit.com', { waitUntil: 'networkidle2', timeout: 30000 });
        console.log(`[${new Date().toISOString()}] Login page loaded. Handling cookies (if present)...`);
        try {
            const btn = await page.waitForSelector(COOKIE_SELECTOR, { timeout: 7000, visible: true }); // Increased timeout slightly
            await btn.click();
            console.log(`[${new Date().toISOString()}] Cookie banner dismissed.`);
            await page.waitForTimeout(1000); // Puppeteer's built-in wait
        } catch {
            console.log(`[${new Date().toISOString()}] Cookie banner not found or timed out.`);
        }

        console.log(`[${new Date().toISOString()}] Typing email and password...`);
        await page.type('#email', EMAIL);
        await page.type('#password-password-input', PASSWORD);
        console.log(`[${new Date().toISOString()}] Clicking login button...`);
        await page.click('button[data-signa="login-submit-button"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
        console.log(`[${new Date().toISOString()}] Login successful, navigated to dashboard area.`);

        // 3. Open sidebar if needed
        console.log(`[${new Date().toISOString()}] Ensuring sidebar is open (if applicable)...`);
        try {
            // It's possible the sidebar is already open or the burger doesn't exist on all pages
            // Wait for it to be visible before clicking
            await page.waitForSelector('div.icon-burger__container', { timeout: 5000, visible: true });
            await page.click('div.icon-burger__container');
            console.log(`[${new Date().toISOString()}] Sidebar burger icon clicked.`);
        } catch {
            console.log(`[${new Date().toISOString()}] Sidebar burger icon not found/visible or already open.`);
        }

        // 4. Navigate to Templates
        const templatesUrl = 'https://dashboard.signaturit.com/es/#/templates';
        console.log(`[${new Date().toISOString()}] Navigating to Templates page: ${templatesUrl}`);
        await page.goto(templatesUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        console.log(`[${new Date().toISOString()}] Templates page loaded.`);

        // 5. Click “Enviar” on the passed-in template
        console.log(`[${new Date().toISOString()}] Searching for template: "${TEMPLATE_NAME}"...`);
        let found = false;
        for (let i = 0; i < 15; i++) { // Retry loop
            found = await page.evaluate(tmplName => {
                const wells = document.querySelectorAll('.templates-well');
                for (const card of wells) {
                    if (card.innerText.includes('#' + tmplName)) {
                        const btn = Array.from(card.querySelectorAll('button'))
                            .find(b => b.innerText.trim() === 'Enviar');
                        if (btn) { btn.click(); return true; }
                    }
                }
                return false;
            }, TEMPLATE_NAME);
            if (found) {
                console.log(`[${new Date().toISOString()}] Found and clicked "Enviar" for template "${TEMPLATE_NAME}".`);
                break;
            }
            console.log(`[${new Date().toISOString()}] Template not found on attempt ${i + 1}, retrying...`);
            await page.waitForTimeout(1000); // Puppeteer's built-in wait
        }
        if (!found) {
            const errorMsg = `Template not found: ${TEMPLATE_NAME}`;
            console.error(`[${new Date().toISOString()}] ${errorMsg}`);
            process.exitCode = 1; // Set exit code for error
            throw new Error(errorMsg); // Throw error to be caught by the script's catch block
        }

        // 6. Wait for the recipients modal to appear
        console.log(`[${new Date().toISOString()}] Waiting for recipients modal (#addBody) to appear...`);
        await page.waitForSelector('#addBody', { timeout: 15000, visible: true });
        console.log(`[${new Date().toISOString()}] Recipients modal appeared.`);

        // 7. Fill in the "Nombre" and "Correo" fields
        const nameInputSelector = '#addBody input[placeholder="Nombre"]';
        console.log(`[${new Date().toISOString()}] Waiting for name input: ${nameInputSelector}`);
        await page.waitForSelector(nameInputSelector, { timeout: 10000, visible: true });
        console.log(`[${new Date().toISOString()}] Clearing and typing name: ${RECIPIENT_NAME}`);
        await page.click(nameInputSelector, { clickCount: 3 }); // Select existing text
        await page.keyboard.press('Backspace'); // Delete it
        await page.type(nameInputSelector, RECIPIENT_NAME);

        const emailInputSelector = '#addBody input[placeholder="Correo"]';
        console.log(`[${new Date().toISOString()}] Waiting for email input: ${emailInputSelector}`);
        await page.waitForSelector(emailInputSelector, { timeout: 10000, visible: true });
        console.log(`[${new Date().toISOString()}] Clearing and typing email: ${RECIPIENT_EMAIL}`);
        await page.click(emailInputSelector, { clickCount: 3 }); // Select existing text
        await page.keyboard.press('Backspace'); // Delete it
        await page.type(emailInputSelector, RECIPIENT_EMAIL);
        console.log(`[${new Date().toISOString()}] Recipient details filled.`);

        // 8. Click “Enviar documento”
        const sendButtonSelector = '#send-document:not([disabled])';
        console.log(`[${new Date().toISOString()}] Waiting for send button: ${sendButtonSelector}`);
        await page.waitForSelector(sendButtonSelector, { timeout: 15000, visible: true });
        console.log(`[${new Date().toISOString()}] Clicking final send document button...`);
        await page.click('#send-document');
        console.log(`[${new Date().toISOString()}] Final send document button clicked.`);

        // Add confirmation step (e.g., modal disappears)
        console.log(`[${new Date().toISOString()}] Waiting for send confirmation (modal #addBody to disappear)...`);
        try {
            await page.waitForSelector('#addBody', { hidden: true, timeout: 25000 });
            console.log(`[${new Date().toISOString()}] Send confirmation: Modal disappeared.`);
        } catch (e) {
            console.warn(`[${new Date().toISOString()}] Did not receive expected send confirmation (modal did not disappear). Details: ${e.message}`);
            // This is a warning, script will still consider it a success if it reaches here
        }

        const endTime = Date.now();
        console.log(`[${new Date(endTime).toISOString()}] Hola ${RECIPIENT_NAME} 👋, tu documento basado en plantilla “${TEMPLATE_NAME}” ha sido enviado a ${RECIPIENT_EMAIL}. Duration: ${(endTime - startTime) / 1000}s.`);
        process.exitCode = 0; // Explicitly set success code

    } catch (error) {
        const errorTime = Date.now();
        console.error(`[${new Date(errorTime).toISOString()}] Error in script for ${RECIPIENT_EMAIL}:`, error.message);
        console.error(`[${new Date(errorTime).toISOString()}] Full error stack:`, error.stack);
        process.exitCode = 1; // Set exit code to indicate failure
    } finally {
        if (browser) {
            console.log(`[${new Date().toISOString()}] Closing browser...`);
            await browser.close();
            console.log(`[${new Date().toISOString()}] Browser closed.`);
        }
        const scriptEndTime = Date.now();
        console.log(`[${new Date(scriptEndTime).toISOString()}] Script finished. Total execution time: ${(scriptEndTime - startTime) / 1000}s. Exit code: ${process.exitCode || 0}`);
        process.exit(process.exitCode || 0); // Ensure the script exits with the correct code
    }
})();