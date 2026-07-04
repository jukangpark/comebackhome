import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CredentialsForm } from "@/components/CredentialsForm";
import { useAuth } from "@/auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">🐾 combackhome</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          다시 만난 우리 아이와 대화해요
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>아이디와 비밀번호를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm
            submitLabel="로그인"
            onSubmit={async (u, p) => {
              await login(u, p);
              navigate("/", { replace: true });
            }}
          />
          <p className="text-muted-foreground mt-4 text-center text-sm">
            아직 계정이 없으신가요?{" "}
            <Link to="/register" className="text-foreground font-medium underline">
              회원가입
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
