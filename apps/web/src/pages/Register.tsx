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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">🐾 combackhome</h1>
        <p className="text-muted-foreground mt-1 text-sm">계정 만들기</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">회원가입</CardTitle>
          <CardDescription>아이디와 비밀번호를 정해주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm
            submitLabel="회원가입"
            onSubmit={async (u, p) => {
              await register(u, p);
              navigate("/", { replace: true });
            }}
          />
          <p className="text-muted-foreground mt-4 text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="text-foreground font-medium underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
