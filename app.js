const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', version: process.env.APP_VERSION || '1.0.0' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ healthy: true });
});

// Only start the server if this file is run directly (node app.js)
// If it's required by Jest, it won't start the listener.
if (require.main === module) {
    app.listen(PORT, () => console.log(`Running on ${PORT}`));
}