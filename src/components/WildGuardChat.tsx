import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Shield, AlertTriangle, Phone, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const QUICK_ACTIONS = [
  { icon: AlertTriangle, label: "Report an incident", prompt: "I just witnessed something happening to an animal and I need help." },
  { icon: Shield, label: "Ask about a law", prompt: "Can you explain the Wild Life (Protection) Act 1972 to me?" },
  { icon: Phone, label: "Draft a complaint", prompt: "I want to file a formal complaint about animal cruelty." },
];

const EMERGENCY = [
  { name: "Emergency", num: "112" },
  { name: "Forest Helpline", num: "1926" },
  { name: "Wildlife SOS Delhi", num: "+91-9871963535" },
  { name: "PETA India", num: "+91-22-40727382" },
];

export default function WildGuardChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          upsert("I'm getting a lot of requests right now. Please try again in a moment.");
        } else if (resp.status === 402) {
          upsert("AI credits have run out. Please add funds to continue.");
        } else {
          upsert("Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      upsert("Connection error. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <h1 className="font-display text-lg leading-none">WildGuard</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Animal protection · India · 12 laws · 22 languages
              </p>
            </div>
          </div>
          <a
            href="tel:112"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emergency px-3 py-1.5 text-xs font-medium text-emergency-foreground hover:opacity-90 transition"
          >
            <Phone className="h-3.5 w-3.5" /> Emergency 112
          </a>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {empty ? (
            <div className="space-y-8 pt-6">
              <div className="text-center space-y-3">
                <h2 className="font-display text-3xl sm:text-4xl text-foreground">
                  Every animal deserves a voice.
                </h2>
                <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
                  Report cruelty, learn the law, or draft a formal complaint.
                  I'll help in any of India's 22 languages.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => send(a.prompt)}
                    className="group rounded-xl border border-border bg-card/60 p-4 text-left hover:border-primary/40 hover:bg-card transition"
                  >
                    <a.icon className="h-5 w-5 text-accent mb-2" strokeWidth={2.25} />
                    <div className="text-sm font-medium text-foreground">{a.label}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Emergency contacts
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EMERGENCY.map((c) => (
                    <a
                      key={c.num}
                      href={`tel:${c.num}`}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary transition text-sm"
                    >
                      <span className="text-foreground">{c.name}</span>
                      <span className="font-mono text-primary font-medium">{c.num}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} />
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/40 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Describe what happened, ask about a law, or request a complaint…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground max-h-40"
              style={{ minHeight: 42 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            WildGuard provides guidance, not legal advice. In emergencies, call <a href="tel:112" className="text-primary font-medium">112</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm"
            : "max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 text-[15px] text-card-foreground shadow-sm wg-prose"
        }
      >
        {isUser ? (
          msg.content
        ) : (
          <ReactMarkdown
            components={{
              a: ({ href, children }) => {
                const isPhone = href?.startsWith("tel:") || /^[+\d][\d\s\-()]+$/.test(String(children));
                return (
                  <a href={href} className={isPhone ? "font-mono" : undefined}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {msg.content || "…"}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
