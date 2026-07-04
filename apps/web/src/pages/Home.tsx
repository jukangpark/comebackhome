import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { petApi, petImageUrl, type Pet } from "@/lib/pet";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    petApi
      .get()
      .then((p) => {
        // 이미지 없으면 아직 온보딩 미완료 → 이어서
        if (!p.hasImage) {
          navigate("/onboarding", { replace: true });
          return;
        }
        setPet(p);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          navigate("/onboarding", { replace: true });
        } else {
          setLoading(false);
        }
      })
      .finally(() => setLoading(false));
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

      <div className="flex flex-col items-center gap-4">
        <img
          src={petImageUrl()}
          alt={pet.name}
          className="aspect-square w-full max-w-[320px] rounded-2xl object-cover"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {pet.species === "dog" ? "🐶" : "🐱"} {pet.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            다음 단계에서 3D 모델을 만들 거예요
          </p>
        </div>
      </div>
    </div>
  );
}
