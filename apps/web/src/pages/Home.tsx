import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">🐾 반가워요, {user?.username}님</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          곧 우리 아이를 3D로 만들 수 있어요. (다음 단계: 펫 등록)
        </p>
      </div>
      <Button
        variant="outline"
        onClick={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      >
        로그아웃
      </Button>
    </div>
  );
}
