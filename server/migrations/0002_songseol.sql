ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_songseol boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY,
  songseol_min_likes integer NOT NULL DEFAULT 10,
  updated_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO site_settings (id, songseol_min_likes) VALUES (1, 10) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE site_settings TO "user";
