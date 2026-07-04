import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { petApi, type Persona } from "@/lib/pet";

interface Props {
  petName: string;
  initial?: Persona;
  submitLabel: string;
  onSaved: (p: Persona) => void;
}

export function PersonaForm({ petName, initial, submitLabel, onSaved }: Props) {
  const [traits, setTraits] = useState(initial?.traits ?? "");
  const [memories, setMemories] = useState(initial?.memories ?? "");
  const [speaking, setSpeaking] = useState(initial?.speaking ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const saved = await petApi.savePersona({ traits, memories, speaking });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="traits">성격</Label>
        <Textarea
          id="traits"
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
          placeholder={`예: ${petName}는 애교가 많고 겁이 조금 있어요. 간식을 제일 좋아해요.`}
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="memories">함께한 추억</Label>
        <Textarea
          id="memories"
          value={memories}
          onChange={(e) => setMemories(e.target.value)}
          placeholder="함께 산책하던 공원, 좋아하던 장난감, 특별했던 순간들을 적어주세요."
          rows={5}
          maxLength={2000}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="speaking">말투 (선택)</Label>
        <Textarea
          id="speaking"
          value={speaking}
          onChange={(e) => setSpeaking(e.target.value)}
          placeholder="예: 문장 끝에 '냥'을 붙여요. 짧고 귀엽게 말해요."
          rows={2}
          maxLength={200}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={busy || !traits.trim() || !memories.trim()}
        className="w-full"
      >
        {busy ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
