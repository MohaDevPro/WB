import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pool } from './db';

async function main() {
  const sqlPath = resolve(dirname(__filename), '../../../../database/migrations/001_v0.sql');
  const sql = await readFile(sqlPath, 'utf8');
  await pool.query(sql);
  await pool.end();
  console.log('V0 migration applied');
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
