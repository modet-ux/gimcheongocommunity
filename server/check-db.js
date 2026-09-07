const { config } = require('dotenv');
config({ path: './.env' });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDb() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '미설정');
  
  try {
    const result = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename');
    console.log('\nTables in school_community:');
    result.rows.forEach(row => console.log('  -', row.tablename));
    console.log('\nDB 연결 및 테이블 확인 완료!');
  } catch (err) {
    console.error('\nDB 연결 실패:', err.message);
    console.error('상세:', err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDb();
