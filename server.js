// server.js
require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process'); // Import spawn
const path = require('path'); // To correctly resolve script path

// Log crucial env vars at startup (these are for the server, the script uses hardcoded ones for now)
console.log(`[${new Date().toISOString()}] Server starting. Checking initial ENV VARS:`);
console.log(`[${new Date().toISOString()}] Initial process.env.SIGNATURIT_EMAIL (for server): "${process.env.SIGNATURIT_EMAIL}"`);
console.log(`[${new Date().toISOString()}] Initial process.env.SIGNATURIT_PASSWORD (for server): "${process.env.SIGNATURIT_PASSWORD ? '********' : undefined}"`);
console.log(`[${new Date().toISOString()}] Initial process.env.PORT: "${process.env.PORT}"`);

const app = express();
app.use(express.json());

// Define the template name - the new script expects it as an argument
// You might want to make this configurable via request body or env var later
const HARDCODED_TEMPLATE_NAME = 'segmento III (fisica - juridica)';

app.post('/send', (req, res) => { // Removed async from here as spawn is event-driven
    const { name, email } = req.body;
    const requestStartTime = Date.now();
    console.log(`[${new Date(requestStartTime).toISOString()}] Received /send request for Name: ${name}, Email: ${email}, Template: ${HARDCODED_TEMPLATE_NAME}`);

    if (!name || !email) {
        const errorMsg = 'Missing name or email in request body';
        console.warn(`[${new Date().toISOString()}] ${errorMsg} for /send request from IP: ${req.ip}`);
        return res.status(400).json({ error: errorMsg });
    }

    try {
        console.log(`[${new Date().toISOString()}] Spawning signaturit-send-template-final.js for ${email}...`);

        const scriptPath = path.join(__dirname, 'signaturit-send-template-final.js');
        // Ensure arguments are passed as separate strings
        const child = spawn('node', [scriptPath, name, email, HARDCODED_TEMPLATE_NAME], { stdio: 'pipe' });

        let scriptOutput = ''; // To collect stdout
        let scriptErrorOutput = ''; // To collect stderr

        child.stdout.on('data', (data) => {
            const output = data.toString();
            scriptOutput += output;
            process.stdout.write(`[SCRIPT STDOUT] ${output}`); // Log script output to server logs in real-time
        });

        child.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            scriptErrorOutput += errorOutput;
            process.stderr.write(`[SCRIPT STDERR] ${errorOutput}`); // Log script error to server logs in real-time
        });

        child.on('close', (code) => {
            const requestEndTime = Date.now();
            console.log(`[${new Date(requestEndTime).toISOString()}] signaturit-send-template-final.js finished with code ${code}. Total request time: ${(requestEndTime - requestStartTime) / 1000}s.`);
            if (code === 0) {
                console.log(`[${new Date().toISOString()}] Script executed successfully for ${email}. Sending response.`);
                res.json({ status: 'sent', to: email, output: scriptOutput });
            } else {
                console.error(`[${new Date().toISOString()}] Script execution failed for ${email} with code ${code}.`);
                // scriptErrorOutput might contain more details than just the last error message
                res.status(500).json({
                    error: 'Failed to process signature request.',
                    details: `Script exited with code ${code}.`,
                    scriptError: scriptErrorOutput || "No stderr output from script. Check script's console.log for errors."
                });
            }
        });

        child.on('error', (err) => { // This event is for errors in spawning the process itself
            const errorTime = Date.now();
            console.error(`[${new Date(errorTime).toISOString()}] Failed to start subprocess for ${email}. Total request time before error: ${(errorTime - requestStartTime) / 1000}s.`);
            console.error(`[${new Date(errorTime).toISOString()}] Subprocess error message: ${err.message}`);
            console.error(`[${new Date(errorTime).toISOString()}] Subprocess error stack: ${err.stack}`);
            // Ensure response is sent if this error occurs
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start signature process.', details: err.message });
            }
        });

    } catch (err) { // This catch is for synchronous errors in the try block itself, less likely with spawn
        const errorTime = Date.now();
        console.error(`[${new Date(errorTime).toISOString()}] Unexpected synchronous error in /send route for ${email}. Total request time before error: ${(errorTime - requestStartTime) / 1000}s.`);
        console.error(`[${new Date(errorTime).toISOString()}] Error message: ${err.message}`);
        console.error(`[${new Date(errorTime).toISOString()}] Error stack: ${err.stack}`);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal server error during signature process' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT} at ${new Date().toISOString()}`);
});

// Optional: Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});