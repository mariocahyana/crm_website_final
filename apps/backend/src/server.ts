import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const DEFAULT_PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Try to start server, with simple retry on EADDRINUSE (try up to 5 ports)
function startServer(port: number, attemptsLeft = 5) {
  const server = app.listen(port, HOST, () => {
    console.log(`API listening on http://${HOST}:${port}`);
  });

  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} already in use.`);
      if (attemptsLeft > 1) {
        const nextPort = port + 1;
        console.warn(`Trying next port ${nextPort} (${attemptsLeft - 1} attempts left)...`);
        // give a short delay before retrying
        setTimeout(() => startServer(nextPort, attemptsLeft - 1), 200);
        return;
      }
      console.error(`All retry attempts exhausted. Please free port ${port} or set PORT env var.`);
      process.exit(1);
    }
    // rethrow other errors
    throw err;
  });
}

startServer(DEFAULT_PORT);