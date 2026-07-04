import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { ApiError } from "@/lib/api";
import { petApi, chatApi, type Pet, type ChatMessage } from "@/lib/pet";

export default function Chat() {
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await petApi.get();
        if (!p.hasPersona) {
          navigate("/", { replace: true });
          return;
        }
        setPet(p);
        setMessages(await chatApi.history());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) navigate("/login");
        else navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(scrollToBottom, [messages, sending]);

  const emoji = pet?.species === "dog" ? "🐶" : "🐱";

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // 낙관적으로 사용자 메시지 표시
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const { userMessage, petMessage } = await chatApi.send(text);
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        userMessage,
        petMessage,
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "pet",
          content: "지금 잠깐 낮잠 자나봐요… 조금 있다 다시 불러줄래요? 💤",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col">
      {/* 헤더 */}
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          ←
        </Button>
        <span className="font-semibold">
          {emoji} {pet?.name}
        </span>
      </header>

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {pet?.name}에게 말을 걸어보세요 🐾
            </p>
          )}
          {messages.map((m) => (
            <Message key={m.id} align={m.role === "user" ? "end" : "start"}>
              {m.role === "pet" && (
                <MessageAvatar className="text-lg">{emoji}</MessageAvatar>
              )}
              <MessageContent>
                <Bubble
                  variant={m.role === "user" ? "default" : "muted"}
                  align={m.role === "user" ? "end" : "start"}
                >
                  <BubbleContent className="whitespace-pre-wrap">
                    {m.content}
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ))}
          {sending && (
            <Message align="start">
              <MessageAvatar className="text-lg">{emoji}</MessageAvatar>
              <MessageContent>
                <Bubble variant="muted" align="start">
                  <BubbleContent className="text-muted-foreground">
                    <span className="animate-pulse">···</span>
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          )}
        </div>
      </div>

      {/* 입력창 (하단 고정) */}
      <form onSubmit={send} className="flex items-center gap-2 border-t px-4 py-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${pet?.name}에게 메시지...`}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
