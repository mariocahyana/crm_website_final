import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});