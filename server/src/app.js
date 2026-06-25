const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const ticketsRouter = require('./routes/tickets');

function makeApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const origin = process.env.CORS_ORIGIN;
  app.use(
    cors({
      origin: origin || true,
      credentials: false
    })
  );

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/api/tickets', ticketsRouter);

  // 프로덕션: Vite build 결과물을 Express가 서빙 (Render 1서비스 배포용)
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}

module.exports = { makeApp };
