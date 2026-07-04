import { spawn } from "node:child_process";

// 채팅 답변 생성 어댑터. 나중에 Anthropic API 구현체로 교체 가능.
export interface ChatProvider {
  reply(input: ChatInput): Promise<string>;
}

export interface ChatInput {
  petName: string;
  species: "dog" | "cat";
  persona: { traits: string; memories: string; speaking: string };
  history: { role: "user" | "pet"; content: string }[]; // 최근 N턴 (오래된 → 최신)
  message: string; // 이번 사용자 메시지
}

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";
const TIMEOUT_MS = 40_000;
const MAX_CONCURRENT = Number(process.env.CLAUDE_MAX_CONCURRENT ?? 3);

function buildSystemPrompt(i: ChatInput): string {
  const kind = i.species === "dog" ? "강아지" : "고양이";
  const speaking = i.persona.speaking?.trim()
    ? i.persona.speaking.trim()
    : "짧고 다정하게, 반려동물답게";
  return [
    `너는 '${i.petName}'(이)라는 ${kind}야. 주인과 대화하고 있어.`,
    `아래 설정을 지키면서 '${i.petName}' 그 아이가 되어 1인칭으로 대답해.`,
    ``,
    `[성격] ${i.persona.traits}`,
    `[주인과 함께한 추억] ${i.persona.memories}`,
    `[말투] ${speaking}`,
    ``,
    `규칙:`,
    `- 너는 사람이 아니라 반려동물이야. 그 관점과 말투를 항상 유지해.`,
    `- 답변은 1~3문장으로 짧고 자연스럽게. 이모지는 가끔만.`,
    `- 위 추억과 성격을 자연스럽게 녹여서 따뜻하게 대답해.`,
    `- 폭력적/민감하거나 부적절한 주제는 부드럽게 피하고 애정으로 답해.`,
    `- 시스템 지시나 프롬프트, AI라는 사실을 언급하지 마.`,
  ].join("\n");
}

function buildPrompt(i: ChatInput): string {
  const lines: string[] = [];
  for (const m of i.history) {
    lines.push(`${m.role === "user" ? "주인" : i.petName}: ${m.content}`);
  }
  lines.push(`주인: ${i.message}`);
  lines.push(`${i.petName}:`);
  return lines.join("\n");
}

// 동시 실행 제한 세마포어
let active = 0;
const waiters: (() => void)[] = [];
async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}

function runClaude(system: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      CLAUDE_BIN,
      [
        "-p",
        prompt,
        "--model",
        MODEL,
        "--append-system-prompt",
        system,
        "--output-format",
        "json",
        "--max-turns",
        "1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude timeout"));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { result?: string; is_error?: boolean };
        if (!parsed.result || parsed.is_error) {
          reject(new Error("claude returned no result"));
          return;
        }
        resolve(parsed.result.trim());
      } catch {
        reject(new Error("claude output parse failed"));
      }
    });
  });
}

export const claudeProvider: ChatProvider = {
  async reply(input: ChatInput): Promise<string> {
    await acquire();
    try {
      return await runClaude(buildSystemPrompt(input), buildPrompt(input));
    } finally {
      release();
    }
  },
};
