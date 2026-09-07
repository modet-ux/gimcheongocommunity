import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const statements = [
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
  "DO $$ BEGIN CREATE TYPE user_role AS ENUM ('USER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN CREATE TYPE report_status AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN CREATE TYPE like_target_type AS ENUM ('POST', 'COMMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN CREATE TYPE reaction_type AS ENUM ('LIKE', 'DISLIKE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN CREATE TYPE post_category AS ENUM ('FREE', 'QUESTION', 'STUDY', 'SCHOOL', 'CLUB', 'CAREER', 'INFO', 'SUGGESTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL, nickname varchar(50) NOT NULL,
    profile_image_url text, status_message varchar(160), role user_role NOT NULL DEFAULT 'USER',
    status user_status NOT NULL DEFAULT 'ACTIVE', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL, content json NOT NULL, category post_category NOT NULL DEFAULT 'FREE',
    is_anonymous boolean NOT NULL DEFAULT false, is_notice boolean NOT NULL DEFAULT false,
    notice_priority integer NOT NULL DEFAULT 0, is_songseol boolean NOT NULL DEFAULT false,
    is_songseol_excluded boolean NOT NULL DEFAULT false, view_count integer NOT NULL DEFAULT 0,
    like_count integer NOT NULL DEFAULT 0, dislike_count integer NOT NULL DEFAULT 0,
    comment_count integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS site_settings (id integer PRIMARY KEY, songseol_min_likes integer NOT NULL DEFAULT 10, updated_at timestamp NOT NULL DEFAULT now())`,
  "INSERT INTO site_settings (id, songseol_min_likes) VALUES (1, 10) ON CONFLICT (id) DO NOTHING",
  `CREATE TABLE IF NOT EXISTS post_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    r2_key varchar(500) NOT NULL, url text NOT NULL, width integer NOT NULL, height integer NOT NULL, uploaded_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id uuid, content text NOT NULL,
    like_count integer NOT NULL DEFAULT 0, dislike_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type like_target_type NOT NULL, target_id uuid NOT NULL, reaction reaction_type NOT NULL DEFAULT 'LIKE', created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type like_target_type NOT NULL, target_id uuid NOT NULL, reason text NOT NULL,
    status report_status NOT NULL DEFAULT 'PENDING', resolved_by_admin_id uuid, resolved_at timestamp, created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS admin_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(100) NOT NULL, target_type varchar(50), target_id uuid, details text, created_at timestamp NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_posts_category_created_at ON posts(category, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)",
  "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
];

try {
  for (const statement of statements) await sql.unsafe(statement);
  const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('users','posts','comments','site_settings') order by table_name`;
  console.log(JSON.stringify({ tables: tables.map((row) => row.table_name) }));
} finally {
  await sql.end();
}
