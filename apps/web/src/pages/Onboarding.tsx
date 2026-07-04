import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { petApi, modelApi, type Species } from "@/lib/pet";
import { GenerateStep } from "@/components/GenerateStep";
import { PersonaForm } from "@/components/PersonaForm";

type Step = "loading" | "info" | "image" | "generate" | "persona";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 폼 상태
  const [name, setName] = useState("");
  const [petName, setPetName] = useState(""); // 페르소나 단계용
  const [species, setSpecies] = useState<Species | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // 현재 진행 상태에 맞는 스텝으로 진입
  useEffect(() => {
    (async () => {
      try {
        const pet = await petApi.get();
        setPetName(pet.name);
        if (!pet.hasImage) {
          setStep("image");
          return;
        }
        // 이미지까지 있음 → 모델 상태로 분기
        try {
          const m = await modelApi.status();
          if (m.status !== "DONE") {
            setStep("generate"); // IN_PROGRESS or FAILED → 이어서/재시도
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            setStep("generate");
            return;
          }
          setError("불러오는 중 문제가 발생했어요");
          return;
        }
        // 모델 완료 → 페르소나 유무로 분기
        if (pet.hasPersona) navigate("/", { replace: true });
        else setStep("persona");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setStep("info");
        else setError("불러오는 중 문제가 발생했어요");
      }
    })();
  }, [navigate]);

  const submitInfo = async () => {
    if (!name.trim() || !species) return;
    setError(null);
    setBusy(true);
    try {
      await petApi.create(name.trim(), species);
      setPetName(name.trim());
      setStep("image");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "등록에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submitImage = async () => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await petApi.uploadImage(file);
      setStep("generate"); // 3D 생성 단계로
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-6 px-6 py-10">
      {step !== "generate" && (
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {step === "info"
              ? "우리 아이를 소개해주세요"
              : step === "image"
                ? "사진 한 장 올려주세요"
                : `${petName ? petName + "는" : "우리 아이는"} 어떤 아이였나요?`}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {step === "info"
              ? "이름과 종류를 알려주세요"
              : step === "image"
                ? "얼굴이 잘 보이는 정면 사진이 좋아요"
                : "성격과 추억을 적으면 그 아이처럼 대화해요"}
          </p>
        </div>
      )}

      {step === "generate" && (
        <GenerateStep onDone={() => setStep("persona")} />
      )}

      {step === "persona" && (
        <PersonaForm
          petName={petName || "우리 아이"}
          submitLabel="완료하고 만나러 가기"
          onSaved={() => navigate("/", { replace: true })}
        />
      )}

      {step === "info" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 콩이"
              maxLength={20}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>종류</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["dog", "cat"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecies(s)}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors",
                    species === s
                      ? "border-primary bg-accent"
                      : "border-input hover:bg-accent/50"
                  )}
                >
                  <span className="text-2xl">{s === "dog" ? "🐶" : "🐱"}</span>
                  {s === "dog" ? "강아지" : "고양이"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={submitInfo}
            disabled={busy || !name.trim() || !species}
            className="w-full"
          >
            {busy ? "저장 중..." : "다음"}
          </Button>
        </div>
      )}

      {step === "image" && (
        <div className="flex flex-col gap-5">
          <label className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-input bg-muted/30">
            {preview ? (
              <img
                src={preview}
                alt="미리보기"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-sm">
                눌러서 사진 선택 (jpg/png)
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={onPickFile}
            />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submitImage} disabled={busy || !file} className="w-full">
            {busy ? "업로드 중..." : "완료"}
          </Button>
        </div>
      )}
    </div>
  );
}
