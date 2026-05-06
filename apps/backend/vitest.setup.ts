import dotenv from 'dotenv';

// Load environment variables for tests
process.env.NODE_ENV = 'test';

dotenv.config({ path: '.env' });

// Set test-specific environment variables
if (!process.env.DB_NAME) {
  process.env.DB_NAME = 'tubes_rpll_test';
}
