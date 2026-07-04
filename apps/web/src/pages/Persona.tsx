import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { petApi, type Pet, type Persona } from "@/lib/pet";
import { PersonaForm } from "@/components/PersonaForm";

export default function PersonaPage() {
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await petApi.get();
        setPet(p);
        const per = await petApi.getPersona().catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        });
        setPersona(per);
      } catch {
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }
  if (!pet) return null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">페르소나 수정</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          닫기
        </Button>
      </div>
      <PersonaForm
        petName={pet.name}
        initial={persona ?? undefined}
        submitLabel="저장"
        onSaved={() => navigate("/", { replace: true })}
      />
    </div>
  );
}
