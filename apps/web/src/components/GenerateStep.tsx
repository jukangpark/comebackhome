import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { modelApi } from "@/lib/pet";

interface Props {
  onDone: () => void;
}

/** 3D 생성 시작 + 진행률 폴링. 완료되면 onDone 호출. */
export function GenerateStep({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = async () => {
    setFailed(false);
    try {
      const s = await modelApi.start(); // 없으면 시작, 진행중/완료면 현재 상태
      setProgress(s.progress);
      if (s.status === "DONE") return onDone();
      if (s.status === "FAILED") return setFailed(true);
      startPolling();
    } catch {
      setFailed(true);
    }
  };

  const startPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const s = await modelApi.status();
        setProgress(s.progress);
        if (s.status === "DONE") {
          clearInterval(timer.current!);
          onDone();
        } else if (s.status === "FAILED") {
          clearInterval(timer.current!);
          setFailed(true);
        }
      } catch {
        /* 다음 틱에 재시도 */
      }
    }, 3000);
  };

  useEffect(() => {
    run();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-2xl">😢</p>
        <p className="text-sm text-destructive">
          3D 모델 생성에 실패했어요. 다시 시도해주세요.
        </p>
        <Button onClick={run} className="w-full">
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="animate-spin text-5xl">🐾</span>
      </div>
      <div>
        <p className="font-medium">3D 모델을 만드는 중이에요</p>
        <p className="text-muted-foreground mt-1 text-sm">
          보통 30초~2분 정도 걸려요 ({progress}%)
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-primary h-full transition-all duration-500"
          style={{ width: `${Math.max(5, progress)}%` }}
        />
      </div>
    </div>
  );
}
