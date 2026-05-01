import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Leaf, Globe, Plus, Share2, History, Download,
  ChevronDown, ScrollText, Loader2, Check, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Msg[]; updatedAt: number; language: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORAGE_KEY = "wildguard.conversations.v1";
const LANG_KEY = "wildguard.language";

const LANGUAGES = [
  "English", "हिन्दी (Hindi)", "বাংলা (Bengali)", "తెలుగు (Telugu)",
  "मराठी (Marathi)", "தமிழ் (Tamil)", "ગુજરાતી (Gujarati)", "ಕನ್ನಡ (Kannada)",
  "മലയാളം (Malayalam)", "ਪੰਜਾਬੀ (Punjabi)", "ଓଡ଼ିଆ (Odia)", "اردو (Urdu)",
  "অসমীয়া (Assamese)", "मैथिली (Maithili)", "संस्कृतम् (Sanskrit)",
  "नेपाली (Nepali)", "कोंकणी (Konkani)", "मणिपुरी (Manipuri)",
  "བོད་སྐད (Bodo)", "डोगरी (Dogri)", "कश्मीरी (Kashmiri)",
  "संथाली (Santali)", "सिन्धी (Sindhi)",
];

const SCENARIO_POOL = [
  { emoji: "🐓", title: "Cockfighting", desc: "Illegal cockfight happening in my area" },
  { emoji: "🦋", title: "Butterfly/insect trade", desc: "Someone is selling rare butterflies online" },
  { emoji: "🐢", title: "Star tortoise as pet", desc: "My neighbour keeps a star tortoise at home" },
  { emoji: "🐔", title: "Factory farm cruelty", desc: "Terrible conditions in a poultry/pig farm" },
  { emoji: "🎪", title: "Animals in circus", desc: "Wild animals being used in a travelling circus" },
  { emoji: "🐚", title: "Coral/marine trade", desc: "Someone selling coral and sea shells" },
  { emoji: "🐘", title: "Temple elephant abuse", desc: "An elephant chained and beaten at a temple" },
  { emoji: "🐕", title: "Stray dog cruelty", desc: "Someone is poisoning stray dogs in my colony" },
  { emoji: "🐅", title: "Tiger skin / parts", desc: "I saw tiger skin being sold in a market" },
  { emoji: "🦜", title: "Caged exotic birds", desc: "Parrots and macaws caged in a pet shop" },
  { emoji: "🐍", title: "Snake charmer", desc: "Snake charmer with defanged cobras on the street" },
  { emoji: "🦌", title: "Deer poaching", desc: "Suspected deer poaching near a forest area" },
  { emoji: "🐒", title: "Monkey performer", desc: "Performing monkey being used for begging" },
  { emoji: "🐎", title: "Horse-drawn carriage", desc: "Overworked horse pulling a heavy carriage in summer" },
  { emoji: "🦏", title: "Rhino horn trade", desc: "Heard whispers about rhino horn being smuggled" },
  { emoji: "🐄", title: "Illegal slaughter", desc: "Unlicensed slaughterhouse operating nearby" },
  { emoji: "🐬", title: "Dolphin show", desc: "A dolphinarium opening in my city — is it legal?" },
  { emoji: "🦅", title: "Kite injured by manjha", desc: "Bird tangled in glass-coated kite string" },
];

const SLOGAN_POOL = [
  {
    headline: "Every animal. Every right. Every time.",
    lines: ["Saw something cruel? Report it.", "Don't know the law? Ask.", "Need to file a complaint? I'll write it for you."],
  },
  {
    headline: "Their voice. Your courage. India's law.",
    lines: ["A witness can stop a crime.", "A complaint can save a species.", "I'll guide you through every step."],
  },
  {
    headline: "Silence helps the cruel. Speak up.",
    lines: ["Tell me what you saw.", "I'll tell you which law was broken.", "Together we'll get them help."],
  },
  {
    headline: "From a chained elephant to a caged parrot —",
    lines: ["Every species is protected by some law.", "Every cruelty has a remedy.", "Let's find yours, right now."],
  },
  {
    headline: "Be the reason they survive tonight.",
    lines: ["One call. One complaint. One rescue.", "I know every helpline in India.", "Ask me anything — I'm here."],
  },
  {
    headline: "Justice for the voiceless starts with you.",
    lines: ["No legal jargon. No judgement.", "Just clear, caring guidance.", "In any of India's 22 languages."],
  },
  {
    headline: "Witness today. Save a life tomorrow.",
    lines: ["Cruelty thrives in silence.", "Your report breaks that silence.", "And I'll write the complaint for you."],
  },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const LAWS = [
  { icon: "📜", code: "WPA 1972 (Amended 2022)", desc: "4 schedules · 2,600+ species · Sec 51" },
  { icon: "🐾", code: "PCA Act 1960", desc: "Animal welfare · AWBI · Sec 11" },
  { icon: "⚖️", code: "BNS Section 325 (2024)", desc: "Replaces IPC 428/429 · Up to 5 yrs" },
  { icon: "🌳", code: "Forest Conservation Act 1980", desc: "Diversion · clearance · NPV" },
  { icon: "🌿", code: "Biological Diversity Act 2002", desc: "Bio-resources · NBA · access" },
  { icon: "🏛️", code: "Constitutional Articles", desc: "48A & 51A(g) — duty to protect" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function loadConvs(): Conversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveConvs(c: Conversation[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

export default function WildGuardChat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConvs());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<string>(() => localStorage.getItem(LANG_KEY) || "English");
  const [langOpen, setLangOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [rotateKey, setRotateKey] = useState(0);
  const [slogan, setSlogan] = useState(() => SLOGAN_POOL[Math.floor(Math.random() * SLOGAN_POOL.length)]);
  const [scenarios, setScenarios] = useState(() => pickRandom(SCENARIO_POOL, 6));
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserSendRef = useRef<number>(0);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;

  useEffect(() => { saveConvs(conversations); }, [conversations]);
  useEffect(() => { localStorage.setItem(LANG_KEY, language); }, [language]);
  // Only auto-scroll when the user just sent a message (not on every assistant token).
  useEffect(() => {
    if (!lastUserSendRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    lastUserSendRef.current = 0;
  }, [messages.length]);

  function rotatePrompts() {
    setSlogan((prev) => {
      const others = SLOGAN_POOL.filter((s) => s.headline !== prev.headline);
      return others[Math.floor(Math.random() * others.length)];
    });
    setScenarios(pickRandom(SCENARIO_POOL, 6));
    setRotateKey((k) => k + 1);
  }


  // close popovers on outside click
  useEffect(() => {
    const onDoc = () => { setLangOpen(false); setPastOpen(false); };
    if (langOpen || pastOpen) {
      window.addEventListener("click", onDoc);
      return () => window.removeEventListener("click", onDoc);
    }
  }, [langOpen, pastOpen]);

  function newChat() {
    setActiveId(null);
    setInput("");
  }

  function deleteConv(id: string) {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success("Chat deleted");
  }

  function shareChat() {
    if (!active || active.messages.length === 0) {
      toast.error("Nothing to share yet — start a conversation first.");
      return;
    }
    const text = `WildGuard Chat — ${active.title}\n\n` +
      active.messages.map((m) => `${m.role === "user" ? "You" : "WildGuard"}:\n${m.content}`).join("\n\n");
    if (navigator.share) {
      navigator.share({ title: "WildGuard Chat", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Chat copied to clipboard");
    }
  }

  function downloadChat() {
    if (!active || active.messages.length === 0) {
      toast.error("Nothing to download yet.");
      return;
    }
    const text = `WildGuard — Animal Protection AI for India\n` +
      `Conversation: ${active.title}\n` +
      `Date: ${new Date(active.updatedAt).toLocaleString()}\n` +
      `Language: ${active.language}\n` +
      `${"=".repeat(60)}\n\n` +
      active.messages.map((m) =>
        `${m.role === "user" ? "YOU" : "WILDGUARD"}\n${"-".repeat(20)}\n${m.content}\n`,
      ).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wildguard-${active.id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Chat downloaded");
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;

    let convId = activeId;
    let convTitle = active?.title;
    const userMsg: Msg = { role: "user", content: text.trim() };

    if (!convId) {
      convId = uid();
      convTitle = text.trim().slice(0, 48);
      const newConv: Conversation = {
        id: convId, title: convTitle, messages: [userMsg],
        updatedAt: Date.now(), language,
      };
      setConversations((cs) => [newConv, ...cs]);
      setActiveId(convId);
    } else {
      setConversations((cs) =>
        cs.map((c) => c.id === convId
          ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
          : c),
      );
    }

    setInput("");
    setLoading(true);

    const updateAssistant = (full: string) => {
      setConversations((cs) =>
        cs.map((c) => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: full };
          else msgs.push({ role: "assistant", content: full });
          return { ...c, messages: msgs, updatedAt: Date.now() };
        }),
      );
    };

    let assistantSoFar = "";
    try {
      const history = [...(active?.messages ?? []), userMsg];
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ messages: history, language }),
      });

      if (!resp.ok || !resp.body) {
        let msg = "Something went wrong. Please try again.";
        if (resp.status === 429) msg = "I'm getting a lot of requests right now. Please try again in a moment.";
        else if (resp.status === 402) msg = "AI credits have run out. Please add funds to continue.";
        updateAssistant(msg);
        toast.error(msg);
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
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) { assistantSoFar += c; updateAssistant(assistantSoFar); }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      updateAssistant("Connection error. Please check your network and try again.");
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh bg-background">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Leaf className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <div className="font-display text-xl leading-none">WildGuard</div>
            <div className="text-[10px] tracking-[0.18em] text-muted-foreground mt-1 font-medium">
              INDIA WILDLIFE AI
            </div>
          </div>
        </div>

        <div className="mx-4 mb-4 rounded-md border-l-4 border-primary/70 bg-card/70 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your compassionate guide to India's wildlife laws. Report cruelty, seek help, or learn your rights — in any Indian language.
          </p>
        </div>

        <div className="mx-4 grid grid-cols-2 gap-2">
          <Stat big="12" small="Laws trained on" />
          <Stat big="22" small="Languages it responds in" />
          <Stat big="900+" small="Protected species it knows" />
          <Stat big="3" small="Modes — empathy, legal, complaint" />
        </div>

        <div className="mt-5 px-5 text-[10px] tracking-[0.18em] font-semibold text-muted-foreground">
          KEY LAWS COVERED
        </div>

        <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
          {LAWS.map((l) => (
            <button
              key={l.code}
              onClick={() => send(`Tell me about ${l.code} in detail.`)}
              className="w-full flex items-start gap-2.5 rounded-md border border-border bg-card/50 px-3 py-2 text-left hover:bg-card hover:border-primary/30 transition group"
            >
              <span className="text-base leading-none mt-0.5">{l.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-foreground truncate">{l.code}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{l.desc}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground/60 group-hover:text-primary mt-1" />
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card/40 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl leading-none truncate">
              <span className="lg:hidden mr-1.5">🌿</span>WildGuard AI
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              Powered by Gemini · India Wildlife &amp; Animal Cruelty Laws
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Past Chats */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <TopBtn
                onClick={() => { setPastOpen((v) => !v); setLangOpen(false); }}
                icon={History}
                label="Past Chats"
                sub="your saved conversations"
                active={pastOpen}
              />
              {pastOpen && (
                <Popover>
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-semibold">Past chats</span>
                    <button onClick={() => setPastOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {conversations.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No past chats yet.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto py-1">
                      {conversations.map((c) => (
                        <div key={c.id}
                          className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary ${activeId === c.id ? "bg-secondary" : ""}`}
                          onClick={() => { setActiveId(c.id); setPastOpen(false); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{c.title}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(c.updatedAt).toLocaleDateString()} · {c.messages.length} msgs
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Popover>
              )}
            </div>

            <TopBtn
              onClick={shareChat}
              icon={Share2}
              label="Share Chat"
              sub="available after first message"
              disabled={!active || messages.length === 0}
            />

            <TopBtn
              onClick={downloadChat}
              icon={Download}
              label="Download"
              sub="save as .txt"
              disabled={!active || messages.length === 0}
            />

            {/* Language */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setLangOpen((v) => !v); setPastOpen(false); }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/40 transition"
              >
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Language: <span className="text-primary">{language.split(" ")[0]}</span></span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="absolute right-0 top-full mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap italic">
                bot always replies in this lang
              </p>
              {langOpen && (
                <Popover className="right-0">
                  <div className="max-h-72 overflow-y-auto py-1">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        onClick={() => { setLanguage(l); setLangOpen(false); toast.success(`Language: ${l}`); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-secondary text-left"
                      >
                        <span>{l}</span>
                        {language === l && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </Popover>
              )}
            </div>
          </div>
        </header>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            {empty ? (
              <div className="space-y-7 pt-4">
                <div className="text-center space-y-3">
                  <h2 className="font-display text-3xl sm:text-[2.6rem] leading-tight text-primary">
                    Every animal. Every right. Every time.
                  </h2>
                  <div className="text-foreground/80 text-[15px] leading-relaxed space-y-0.5">
                    <p>Saw something cruel? Report it.</p>
                    <p>Don't know the law? Ask.</p>
                    <p>Need to file a complaint? I'll write it for you.</p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.title}
                      onClick={() => send(s.desc)}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/40 hover:shadow-sm transition group"
                    >
                      <span className="text-2xl leading-none mt-0.5">{s.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{s.title}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <a href="tel:112" className="inline-flex items-center gap-1.5 rounded-full bg-emergency px-3 py-1.5 text-xs font-medium text-emergency-foreground hover:opacity-90">
                    🚨 Emergency 112
                  </a>
                  <a href="tel:1926" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70">
                    🌳 Forest 1926
                  </a>
                  <a href="tel:+91-22-40727382" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70">
                    🐾 PETA India
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m, i) => <Bubble key={i} msg={m} />)}
                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card/40 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 relative">
            <button
              onClick={newChat}
              className="absolute -top-12 right-4 sm:right-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition"
            >
              <Plus className="h-3.5 w-3.5" /> New Chat
            </button>

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-xl border border-border bg-card/80 p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                placeholder="Describe what you witnessed, or ask about wildlife laws…"
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground max-h-40"
                style={{ minHeight: 40 }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              <ScrollText className="inline h-3 w-3 mr-1" />
              WildGuard · Free · All 22 Indian languages · Responds in your selected language
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-3 py-2.5 text-center">
      <div className="font-display text-2xl text-primary leading-none">{big}</div>
      <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{small}</div>
    </div>
  );
}

function TopBtn({
  onClick, icon: Icon, label, sub, active, disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string; sub: string; active?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`hidden md:flex flex-col items-end gap-0 group disabled:opacity-50 disabled:cursor-not-allowed ${disabled ? "" : "hover:opacity-100"}`}
    >
      <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-primary/40 bg-primary/10 text-primary"
               : "border-border bg-card text-foreground group-hover:border-primary/40"
      } ${disabled ? "" : ""}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-[10px] text-muted-foreground italic mt-0.5">{sub}</span>
    </button>
  );
}

function Popover({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute top-full mt-2 w-72 rounded-lg border border-border bg-popover shadow-xl z-50 ${className}`}>
      {children}
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={
        isUser
          ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap"
          : "max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 text-[15px] text-card-foreground shadow-sm wg-prose"
      }>
        {isUser ? msg.content : <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>}
      </div>
    </div>
  );
}
