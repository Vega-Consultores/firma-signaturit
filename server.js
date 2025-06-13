// server.js
require('dotenv').config();
const express = require('express');
const sendForSignature = require('./signaturit-send-template');

const app = express();
app.use(express.json());

app.post('/send', async (req, res) => {
    const { name, email } = req.body;
    const requestStartTime = Date.now();
    console.log(`[${new Date(requestStartTime).toISOString()}] Received /send request for Name: ${name}, Email: ${email}`);

    if (!name || !email) {
        const errorMsg = 'Missing name or email in request body';
        console.warn(`[${new Date().toISOString()}] ${errorMsg} for /send request from IP: ${req.ip}`);
        return res.status(400).json({ error: errorMsg });
    }

    try {
        console.log(`[${new Date().toISOString()}] Calling sendForSignature for ${email}...`);
        await sendForSignature(name, email);
        const requestEndTime = Date.now();
        console.log(`[${new Date(requestEndTime).toISOString()}] sendForSignature completed successfully for ${email}. Sending response. Total request time: ${(requestEndTime - requestStartTime) / 1000}s.`);
        res.json({ status: 'sent', to: email });
    } catch (err) {
        const errorTime = Date.now();
        console.error(`[${new Date(errorTime).toISOString()}] Error in /send route after calling sendForSignature for ${email}. Total request time before error: ${(errorTime - requestStartTime) / 1000}s.`);
        console.error(`[${new Date(errorTime).toISOString()}] Error message: ${err.message}`);
        console.error(`[${new Date(errorTime).toISOString()}] Error stack: ${err.stack}`);
        res.status(500).json({ error: err.message || 'Internal server error during signature process' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT} at ${new Date().toISOString()}`);
});

// Optional: Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    // Perform cleanup if necessary, then exit
    // For Express, you might need to close the server instance:
    // server.close(() => {
    //   console.log('HTTP server closed');
    // });
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});