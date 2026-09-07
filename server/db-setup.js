const { config } = require('dotenv');
config({ path: './.env' });

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTables() {
  console.log('테이블 생성 시작...');

  // users 테이블
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  profile_image_url TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('users 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('sessions 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content JSON NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('posts 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  r2_key VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('post_images 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID,
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('comments 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('likes 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  resolved_by_admin_id UUID,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('reports 테이블 생성 완료');

  await pool.query(`
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);`  );
  console.log('admin_logs 테이블 생성 완료');

  // 인덱스 생성
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);`  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);`  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);`  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);`  );
  console.log('인덱스 생성 완료');

  console.log('모든 테이블과 인덱스 생성 완료!');
  await pool.end();
}

createTables().catch(err => {
  console.error('테이블 생성 실패:', err);
  process.exit(1);
});
