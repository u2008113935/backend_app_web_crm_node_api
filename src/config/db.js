import 'dotenv/config';
import pg from 'pg';

pg.types.setTypeParser(1114, (v) => v);
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});