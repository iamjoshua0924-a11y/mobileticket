require('dotenv').config();

const { connectDb } = require('./db');
const { makeApp } = require('./app');

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required');

  await connectDb(mongoUri);

  const port = Number(process.env.PORT || 3001);
  const app = makeApp();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on ${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

