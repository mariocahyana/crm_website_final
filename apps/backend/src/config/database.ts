import dotenv from 'dotenv';

dotenv.config();

type DbConfig = {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  dialect: 'postgres';
};

type DbConfigByEnv = {
  development: DbConfig;
  production: DbConfig;
};

const config: DbConfigByEnv = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'Mobakoknipu1',
    database: process.env.DB_NAME || 'tubes_rpll',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5433,
    dialect: 'postgres',
  },
  production: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT) || 5433,
    dialect: 'postgres',
  },
};

export default config;