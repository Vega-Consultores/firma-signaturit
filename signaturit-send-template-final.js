// signaturit-send-template.js

const puppeteer = require('puppeteer');

(async () => {
    // ─── ARG PARSING ────────────────────────────────────────────────
    // Usage: node signaturit-send-template.js "<Name>" "<Email>" "<Template Name>"
    const [, , RECIPIENT_NAME, RECIPIENT_EMAIL, TEMPLATE_NAME] = process.argv;
    if (!RECIPIENT_NAME || !RECIPIENT_EMAIL || !TEMPLATE_NAME) {
        console.error('Usage: node signaturit-send-template.js "<Name>" "<Email>" "<Template Name>"');
        process.exit(1);
    }

    // ─── STATIC CONFIG ─────────────────────────────────────────────
    const EMAIL = 'victorortin@vegaconsultores.es';
    const PASSWORD = 'luigivega95';
    const COOKIE_SELECTOR = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
    // ─────────────────────────────────────────────────────────────────

    // 1. Launch browser
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 2. Login + dismiss cookies
    await page.goto('https://app.signaturit.com', { waitUntil: 'networkidle2' });
    try {
        const btn = await page.waitForSelector(COOKIE_SELECTOR, { timeout: 5000 });
        await btn.click();
        await new Promise(r => setTimeout(r, 1000));
    } catch { }
    await page.type('#email', EMAIL);
    await page.type('#password-password-input', PASSWORD);
    await page.click('button[data-signa="login-submit-button"]');

    // 3. Open sidebar if needed
    try {
        await page.waitForSelector('div.icon-burger__container', { timeout: 5000 });
        await page.click('div.icon-burger__container');
    } catch { }

    // 4. Navigate to Templates
    await page.goto('https://dashboard.signaturit.com/es/#/templates', { waitUntil: 'networkidle2' });

    // 5. Click “Enviar” on the passed-in template
    let found = false;
    for (let i = 0; i < 15; i++) {
        found = await page.evaluate(name => {
            const wells = document.querySelectorAll('.templates-well');
            for (const card of wells) {
                // look for the # prefix in the UI text
                if (card.innerText.includes('#' + name)) {
                    const btn = Array.from(card.querySelectorAll('button'))
                        .find(b => b.innerText.trim() === 'Enviar');
                    if (btn) { btn.click(); return true; }
                }
            }
            return false;
        }, TEMPLATE_NAME);
        if (found) break;
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!found) {
        console.error('❌ Template not found:', TEMPLATE_NAME);
        await browser.close();
        process.exit(1);
    }

    // 6. Wait for the recipients modal
    await page.waitForSelector('#addBody', { timeout: 10000 });

    // 7. Fill in the "Nombre" and "Correo" fields
    await page.waitForSelector('#addBody input[placeholder="Nombre"]', { timeout: 10000 });
    await page.type('#addBody input[placeholder="Nombre"]', RECIPIENT_NAME);

    await page.waitForSelector('#addBody input[placeholder="Correo"]', { timeout: 10000 });
    await page.type('#addBody input[placeholder="Correo"]', RECIPIENT_EMAIL);

    // 8. Click “Enviar documento”
    await page.waitForSelector('#send-document:not([disabled])', { timeout: 15000 });
    await page.click('#send-document');

    console.log(`Hola ${RECIPIENT_NAME} 👋, tu documento basado en plantilla “${TEMPLATE_NAME}” ha sido enviado a ${RECIPIENT_EMAIL}.`);

    await browser.close();
})();