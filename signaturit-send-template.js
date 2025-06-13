// signaturit-send-template.js
const puppeteer = require('puppeteer');
require('dotenv').config();

async function sendForSignature(RECIPIENT_NAME, RECIPIENT_EMAIL) {
    const startTime = Date.now();
    console.log(`[${new Date(startTime).toISOString()}] sendForSignature called for: ${RECIPIENT_EMAIL}, Name: ${RECIPIENT_NAME}`);

    // ─── ENV CHECK ────────────────────────────────────────────────────────
    console.log(`[${new Date().toISOString()}] Checking environment variables...`);
    console.log(`[${new Date().toISOString()}] process.env.SIGNATURIT_EMAIL: "${process.env.SIGNATURIT_EMAIL}"`);
    console.log(`[${new Date().toISOString()}] process.env.SIGNATURIT_PASSWORD: "${process.env.SIGNATURIT_PASSWORD ? '********' : undefined}"`); // Don't log actual password
    const { SIGNATURIT_EMAIL, SIGNATURIT_PASSWORD } = process.env;
    if (!SIGNATURIT_EMAIL || !SIGNATURIT_PASSWORD) {
        const errorMsg = 'Missing SIGNATURIT_EMAIL or SIGNATURIT_PASSWORD in environment';
        console.error(`[${new Date().toISOString()}] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // ─── STATIC CONFIG ─────────────────────────────────────────────────────
    const TEMPLATE_NAME = 'segmento III (fisica - juridica)'; // Kept hardcoded as per original
    const COOKIE_SELECTOR = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'; // Using consistent selector

    let browser = null; // Define browser here to ensure it's in scope for finally

    try {
        console.log(`[${new Date().toISOString()}] Launching Puppeteer...`);
        browser = await puppeteer.launch({
            headless: true,
            devtools: false,
            defaultViewport: null, // Or set a specific one like { width: 1920, height: 1080 }
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Crucial for Docker/CI environments
                '--disable-accelerated-2d-canvas',
                '--disable-gpu', // Often necessary in headless environments
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions'
                // '--single-process', // Try only if other options fail, can have side effects
            ]
        });
        console.log(`[${new Date().toISOString()}] Puppeteer launched. Opening new page...`);
        const page = await browser.newPage();
        console.log(`[${new Date().toISOString()}] Page opened.`);

        // 2. Login + dismiss cookies
        console.log(`[${new Date().toISOString()}] Navigating to Signaturit login: https://app.signaturit.com`);
        await page.goto('https://app.signaturit.com', { waitUntil: 'networkidle2', timeout: 30000 }); // Increased timeout
        console.log(`[${new Date().toISOString()}] Login page loaded. Handling cookies (if present)...`);
        try {
            const btn = await page.waitForSelector(COOKIE_SELECTOR, { timeout: 5000, visible: true });
            await btn.click();
            console.log(`[${new Date().toISOString()}] Cookie banner dismissed.`);
            await page.waitForTimeout(1000); // Small delay after click
        } catch {
            console.log(`[${new Date().toISOString()}] Cookie banner not found or already handled.`);
        }

        console.log(`[${new Date().toISOString()}] Typing email and password...`);
        await page.type('#email', SIGNATURIT_EMAIL);
        await page.type('#password-password-input', SIGNATURIT_PASSWORD);
        console.log(`[${new Date().toISOString()}] Clicking login button...`);
        await page.click('button[data-signa="login-submit-button"]');
        // It's good to wait for some navigation or element indicating successful login
        // For example, waiting for the dashboard URL or a specific dashboard element
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
        console.log(`[${new Date().toISOString()}] Login successful, navigated to dashboard area.`);


        // 3. Open sidebar if needed
        console.log(`[${new Date().toISOString()}] Ensuring sidebar is open (if applicable)...`);
        try {
            await page.waitForSelector('div.icon-burger__container', { timeout: 5000, visible: true });
            await page.click('div.icon-burger__container');
            console.log(`[${new Date().toISOString()}] Sidebar burger icon clicked.`);
        } catch {
            console.log(`[${new Date().toISOString()}] Sidebar burger icon not found or already open.`);
        }

        // 4. Navigate to Templates
        const templatesUrl = 'https://dashboard.signaturit.com/es/#/templates';
        console.log(`[${new Date().toISOString()}] Navigating to Templates page: ${templatesUrl}`);
        await page.goto(templatesUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        console.log(`[${new Date().toISOString()}] Templates page loaded.`);

        // 5. Find and click “Enviar” on your template
        console.log(`[${new Date().toISOString()}] Searching for template: "${TEMPLATE_NAME}"...`);
        let found = false;
        for (let i = 0; i < 15; i++) {
            found = await page.evaluate(name => {
                const wells = document.querySelectorAll('.templates-well');
                for (const card of wells) {
                    if (card.innerText.includes('#' + name)) {
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
            await page.waitForTimeout(1000);
        }
        if (!found) {
            const errorMsg = `Template not found: ${TEMPLATE_NAME}`;
            console.error(`[${new Date().toISOString()}] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        // 6. Wait for the recipients modal to appear
        console.log(`[${new Date().toISOString()}] Waiting for recipients modal (#addBody) to appear...`);
        await page.waitForSelector('#addBody', { timeout: 15000, visible: true }); // Increased timeout slightly
        console.log(`[${new Date().toISOString()}] Recipients modal appeared.`);

        // 7. TYPE INTO THE NAME & EMAIL FIELDS
        const nameInputSelector = '#addBody input[placeholder="Nombre"]';
        console.log(`[${new Date().toISOString()}] Waiting for name input: ${nameInputSelector}`);
        await page.waitForSelector(nameInputSelector, { timeout: 10000, visible: true });
        console.log(`[${new Date().toISOString()}] Clearing and typing name: ${RECIPIENT_NAME}`);
        await page.click(nameInputSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(nameInputSelector, RECIPIENT_NAME);

        const emailInputSelector = '#addBody input[placeholder="Correo"]';
        console.log(`[${new Date().toISOString()}] Waiting for email input: ${emailInputSelector}`);
        await page.waitForSelector(emailInputSelector, { timeout: 10000, visible: true });
        console.log(`[${new Date().toISOString()}] Clearing and typing email: ${RECIPIENT_EMAIL}`);
        await page.click(emailInputSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(emailInputSelector, RECIPIENT_EMAIL);
        console.log(`[${new Date().toISOString()}] Recipient details filled.`);

        // 8. Send it
        const sendButtonSelector = '#send-document:not([disabled])';
        console.log(`[${new Date().toISOString()}] Waiting for send button: ${sendButtonSelector}`);
        await page.waitForSelector(sendButtonSelector, { timeout: 15000, visible: true });
        console.log(`[${new Date().toISOString()}] Clicking final send document button...`);
        await page.click('#send-document'); // Using the non-variable selector directly
        console.log(`[${new Date().toISOString()}] Final send document button clicked.`);

        // --- ADDED CONFIRMATION STEP ---
        console.log(`[${new Date().toISOString()}] Waiting for send confirmation (modal #addBody to disappear)...`);
        try {
            await page.waitForSelector('#addBody', { hidden: true, timeout: 25000 }); // Slightly increased timeout
            console.log(`[${new Date().toISOString()}] Send confirmation: Modal disappeared.`);
        } catch (e) {
            console.warn(`[${new Date().toISOString()}] Did not receive expected send confirmation (modal did not disappear). Details: ${e.message}`);
            // Consider taking a screenshot if possible in the environment
            // try {
            //     const screenshotPath = `confirmation_error_${Date.now()}.png`;
            //     await page.screenshot({ path: screenshotPath });
            //     console.log(`[${new Date().toISOString()}] Screenshot taken: ${screenshotPath}`);
            // } catch (screenshotError) {
            //     console.error(`[${new Date().toISOString()}] Failed to take screenshot: ${screenshotError.message}`);
            // }
        }
        // --- END OF ADDED CONFIRMATION STEP ---
        const endTime = Date.now();
        console.log(`[${new Date(endTime).toISOString()}] Puppeteer actions for ${RECIPIENT_EMAIL} completed. Total time: ${(endTime - startTime) / 1000}s.`);
        return true; // Explicitly return something on success

    } catch (error) {
        const errorTime = Date.now();
        console.error(`[${new Date(errorTime).toISOString()}] Error in sendForSignature puppeteer script for ${RECIPIENT_EMAIL}:`, error.message);
        console.error(`[${new Date(errorTime).toISOString()}] Full error stack:`, error.stack);
        // Consider taking a screenshot on error if possible
        // if (page) {
        //     try {
        //         const errorScreenshotPath = `error_${Date.now()}.png`;
        //         await page.screenshot({ path: errorScreenshotPath });
        //         console.log(`[${new Date().toISOString()}] Error screenshot taken: ${errorScreenshotPath}`);
        //     } catch (screenshotError) {
        //         console.error(`[${new Date().toISOString()}] Failed to take error screenshot: ${screenshotError.message}`);
        //     }
        // }
        throw error; // Re-throw the error to be caught by the server
    } finally {
        if (browser) {
            console.log(`[${new Date().toISOString()}] Closing browser for ${RECIPIENT_EMAIL}...`);
            await browser.close();
            console.log(`[${new Date().toISOString()}] Browser closed for ${RECIPIENT_EMAIL}.`);
        }
        const finalTime = Date.now();
        console.log(`[${new Date(finalTime).toISOString()}] sendForSignature function finished for: ${RECIPIENT_EMAIL}. Total execution time: ${(finalTime - startTime) / 1000}s.`);
    }
}

module.exports = sendForSignature;