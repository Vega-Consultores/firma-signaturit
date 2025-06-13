// server.js
require('dotenv').config();
const express = require('express');
const sendForSignature = require('./signaturit-send-template');

const app = express();
app.use(express.json());

app.post('/send', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'Missing name or email in request body' });
    }
    try {
        await sendForSignature(name, email);
        res.json({ status: 'sent', to: email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
