-- 3D 모델 생성 잡/결과 (펫당 1개)
CREATE TABLE IF NOT EXISTS pet_models (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id        uuid UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  meshy_task_id text,
  status        text NOT NULL DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS | DONE | FAILED
  progress      int  NOT NULL DEFAULT 0,
  glb_path      text,
  error         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
