-- school_community 데이터베이스 초기화 SQL
-- WSL PostgreSQL에서 실행: sudo -u postgres psql -d school_community -f /tmp/init.sql

-- 기존 테이블이 있으면 삭제 (개발 환경 리셋용)
DROP TABLE IF EXISTS admin_logs;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS post_images;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- users 테이블
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  nickname varchar(50) NOT NULL,
  profile_image_url text,
  role varchar(50) NOT NULL DEFAULT 'USER',
  status varchar(50) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- sessions 테이블
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- posts 테이블
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  content json NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- post_images 테이블
CREATE TABLE post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  r2_key varchar(500) NOT NULL,
  url text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  uploaded_at timestamp NOT NULL DEFAULT NOW()
);

-- comments 테이블
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid,
  content text NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- likes 테이블
CREATE TABLE likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type varchar(50) NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- reports 테이블
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type varchar(50) NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'PENDING',
  resolved_by_admin_id uuid,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- admin_logs 테이블
CREATE TABLE admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  target_type varchar(50),
  target_id uuid,
  details text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_reports_status ON reports(status);

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
