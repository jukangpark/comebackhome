-- 페르소나 (펫당 1개)
CREATE TABLE IF NOT EXISTS personas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id     uuid UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  traits     text NOT NULL,           -- 성격
  memories   text NOT NULL,           -- 함께한 추억/일들
  speaking   text NOT NULL DEFAULT '', -- 말투 (선택)
  updated_at timestamptz DEFAULT now()
);
