const request = require('supertest');
const app = require('./app'); // export app from app.js

test('GET / returns status ok', async () => {
  const res = await request(app).get('/');
  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('GET /health returns healthy', async () => {
  const res = await request(app).get('/health');
  expect(res.statusCode).toBe(200);
  expect(res.body.healthy).toBe(true);
});