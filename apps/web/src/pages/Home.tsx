import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { petApi, modelApi, petGlbUrl, type Pet } from "@/lib/pet";
import { PetViewer } from "@/components/PetViewer";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await petApi.get();
        if (!p.hasImage) {
          navigate("/onboarding", { replace: true });
          return;
        }
        // 3D 모델이 완료되지 않았으면 온보딩(생성 단계)로
        try {
          const m = await modelApi.status();
          if (m.status !== "DONE") {
            navigate("/onboarding", { replace: true });
            return;
          }
        } catch {
          navigate("/onboarding", { replace: true });
          return;
        }
        // 페르소나 미작성이면 온보딩(페르소나 단계)로
        if (!p.hasPersona) {
          navigate("/onboarding", { replace: true });
          return;
        }
        setPet(p);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          navigate("/onboarding", { replace: true });
          return;
        }
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
        <span className="text-muted-foreground text-sm">{user?.username}님</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        >
          로그아웃
        </Button>
      </div>

      <PetViewer url={petGlbUrl()} />

      <div className="text-center">
        <h1 className="text-2xl font-bold">
          {pet.species === "dog" ? "🐶" : "🐱"} {pet.name}
        </h1>
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => navigate("/chat")}>
          💬 {pet.name}와 대화하기
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/persona")}
        >
          페르소나 수정
        </Button>
      </div>
    </div>
  );
}
