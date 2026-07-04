-- 채팅 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id     uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','pet')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pet_time ON chat_messages(pet_id, created_at);
