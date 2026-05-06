CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  phone TEXT,
  operating_hours TEXT,
  day_pass_price INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TYPE loading_type AS ENUM ('pin', 'plate');

CREATE TABLE IF NOT EXISTS machine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  loading_type loading_type NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID REFERENCES gyms(id),
  template_id UUID REFERENCES machine_templates(id),
  quantity INTEGER DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  custom_name TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_machine_id UUID REFERENCES gym_machines(id),
  user_id UUID REFERENCES users(id),
  photo_url TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_blinded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_votes (
  user_id UUID REFERENCES users(id),
  photo_id UUID REFERENCES machine_photos(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal seed for tests
INSERT INTO brands(id, name) VALUES ('b0000001-0000-0000-0000-000000000001', 'Panatta');
INSERT INTO categories(id, name) VALUES ('c0000001-0000-0000-0000-000000000001', '등');
INSERT INTO gyms(id, name, address, location, is_verified)
  VALUES (
    'a0000001-0000-0000-0000-000000000001',
    '테스트 헬스장',
    '서울 강남구 역삼동 1',
    ST_GeographyFromText('SRID=4326;POINT(127.0276 37.4979)'),
    TRUE
  );
