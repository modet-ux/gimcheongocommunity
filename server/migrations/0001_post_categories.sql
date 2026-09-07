DO $$ BEGIN
  CREATE TYPE post_category AS ENUM ('FREE', 'QUESTION', 'STUDY', 'SCHOOL', 'CLUB', 'CAREER', 'INFO', 'SUGGESTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS category post_category NOT NULL DEFAULT 'FREE';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_notice boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS notice_priority integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_category_created_at ON posts(category, created_at DESC);
