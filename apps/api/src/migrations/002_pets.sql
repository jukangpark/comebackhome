-- 반려동물 (유저당 1마리 → user_id UNIQUE)
CREATE TABLE IF NOT EXISTS pets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  species    text NOT NULL CHECK (species IN ('dog','cat')),
  created_at timestamptz DEFAULT now()
);

-- 업로드 이미지 (펫당 1장이므로 pet_id UNIQUE)
CREATE TABLE IF NOT EXISTS pet_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id     uuid UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  file_path  text NOT NULL,
  created_at timestamptz DEFAULT now()
);
