import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function App() {
  const [health, setHealth] = useState<string>("확인 중...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? "정상 ✅" : "이상"))
      .catch(() => setHealth("연결 실패 ❌"));
  }, []);

  return (
    // 모바일 퍼스트: 화면 중앙, 데스크톱은 max-width 로 가운데 정렬
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">🐾 combackhome</h1>
      <p className="text-muted-foreground text-sm">반려동물 3D 채팅 웹앱 (P0 스켈레톤)</p>
      <p className="text-sm">API 상태: {health}</p>
      <Button>shadcn 버튼 렌더 확인</Button>
    </div>
  );
}
