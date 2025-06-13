// signaturit-send-template.js
const puppeteer = require('puppeteer');
require('dotenv').config();

async function sendForSignature(RECIPIENT_NAME, RECIPIENT_EMAIL) {
    // ─── ENV CHECK ────────────────────────────────────────────────────────
    const { SIGNATURIT_EMAIL, SIGNATURIT_PASSWORD } = process.env;
    if (!SIGNATURIT_EMAIL || !SIGNATURIT_PASSWORD) {
        throw new Error('Missing SIGNATURIT_EMAIL or SIGNATURIT_PASSWORD in environment');
    }

    // ─── STATIC CONFIG ─────────────────────────────────────────────────────
    const TEMPLATE_NAME = 'segmento III (fisica - juridica)'; // Kept hardcoded as per original
    const COOKIE_SELECTOR = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'; // Using consistent selector

    // 1. Launch browser
    const browser = await puppeteer.launch({
        headless: false, // Kept false for observation, change to true for production
        devtools: true,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized'
        ]
    });
    const page = await browser.newPage();

    try {
        // 2. Login + dismiss cookies
        await page.goto('https://app.signaturit.com', { waitUntil: 'networkidle2' });
        try {
            const btn = await page.waitForSelector(COOKIE_SELECTOR, { timeout: 5000 });
            await btn.click();
            await page.waitForTimeout(1000); // Small delay after click
        } catch { /* no cookie banner or timeout */ }

        await page.type('#email', SIGNATURIT_EMAIL);
        await page.type('#password-password-input', SIGNATURIT_PASSWORD);
        await page.click('button[data-signa="login-submit-button"]');

        // 3. Open sidebar if needed
        try {
            // Wait for the burger icon to be present before clicking
            await page.waitForSelector('div.icon-burger__container', { timeout: 5000, visible: true });
            await page.click('div.icon-burger__container');
        } catch { /* already open or not found, proceed */ }

        // 4. Navigate to Templates
        await page.goto('https://dashboard.signaturit.com/es/#/templates', { waitUntil: 'networkidle2' });

        // 5. Find and click “Enviar” on your template
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
            if (found) break;
            await page.waitForTimeout(1000);
        }
        if (!found) {
            throw new Error(`Template not found: ${TEMPLATE_NAME}`);
        }

        // 6. Wait for the recipients modal to appear
        await page.waitForSelector('#addBody', { timeout: 10000, visible: true });

        // 7. TYPE INTO THE NAME & EMAIL FIELDS
        const nameInputSelector = '#addBody input[placeholder="Nombre"]'; // Specific selector
        await page.waitForSelector(nameInputSelector, { timeout: 10000, visible: true });
        await page.click(nameInputSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(nameInputSelector, RECIPIENT_NAME);

        const emailInputSelector = '#addBody input[placeholder="Correo"]'; // Specific selector
        await page.waitForSelector(emailInputSelector, { timeout: 10000, visible: true });
        await page.click(emailInputSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(emailInputSelector, RECIPIENT_EMAIL);

        // 8. Send it
        await page.waitForSelector('#send-document:not([disabled])', { timeout: 15000, visible: true });
        await page.click('#send-document');
        // --- ADDED CONFIRMATION STEP ---
        console.log('Waiting for send confirmation (e.g., modal to disappear)...');
        try {
            // Option 1: Wait for the modal to disappear/hide.
            // This assumes the modal #addBody is removed or hidden upon successful send.
            await page.waitForSelector('#addBody', { hidden: true, timeout: 20000 });
            console.log('Send confirmation: Modal disappeared.');

            // Option 2: If a specific success message appears, wait for that instead.
            // You'll need to inspect the page to find the selector for this message.
            // const successMessageSelector = '.signaturit-success-toast'; // Replace with actual selector
            // await page.waitForSelector(successMessageSelector, { visible: true, timeout: 20000 });
            // console.log('Send confirmation: Success message appeared.');

            // Option 3: If the page navigates, wait for navigation.
            // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            // console.log('Send confirmation: Page navigated.');

        } catch (e) {
            console.warn('Did not receive expected send confirmation from UI (e.g., modal did not disappear or success message not found). The email might still have been sent, or there might have been an issue on Signaturit\'s side.');
            // You might want to take a screenshot here for debugging if confirmation fails
            // await page.screenshot({ path: 'send_confirmation_error.png' });
        }
        // --- END OF ADDED CONFIRMATION STEP ---
        // }
        console.log(`Puppeteer actions for ${RECIPIENT_EMAIL} completed. Signaturit should be sending the email.`);


    } catch (error) {
        console.error('Error in sendForSignature puppeteer script:', error);
        throw error; // Re-throw the error to be caught by the server
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = sendForSignature;