const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', version: process.env.APP_VERSION || '1.0.0' });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ healthy: true });
});

// Only start listening if this file is run directly
// When imported by tests, skip this — supertest handles the port
if (require.main === module) {
  app.listen(PORT, () => console.log(`Running on ${PORT}`));
}

module.exports = app;  // export the app, not the server