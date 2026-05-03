import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Leaf, Globe, Plus, Share2, History, Download,
  ChevronDown, Loader2, Check, Trash2, X, LogIn, LogOut, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Msg[]; updatedAt: number; language: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORAGE_KEY = "wildguard.conversations.v1";
const LANG_KEY = "wildguard.language";

// SSR-safe storage helpers
const isBrowser = typeof window !== "undefined";
const safeGet = (k: string) => (isBrowser ? window.localStorage.getItem(k) : null);
const safeSet = (k: string, v: string) => { if (isBrowser) window.localStorage.setItem(k, v); };

const LANGUAGES = [
  "English", "हिन्दी (Hindi)", "বাংলা (Bengali)", "తెలుగు (Telugu)",
  "मराठी (Marathi)", "தமிழ் (Tamil)", "ગુજરાતી (Gujarati)", "ಕನ್ನಡ (Kannada)",
  "മലയാളം (Malayalam)", "ਪੰਜਾਬੀ (Punjabi)", "ଓଡ଼িଆ (Odia)", "اردو (Urdu)",
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
  { headline: "They can't call 112. You can.", sub: "Report cruelty. I'll handle the law." },
  { headline: "One witness. One law. One life saved.", sub: "Tell me what you saw — I'll do the rest." },
  { headline: "Silence is the poacher's best friend.", sub: "Break it. I'll guide every step." },
  { headline: "The voiceless need a voice with teeth.", sub: "India's wildlife laws, decoded for you." },
  { headline: "Be the reason they make it to morning.", sub: "Cruelty reported here moves fast." },
  { headline: "Justice doesn't speak Latin. It speaks your language.", sub: "Ask me in any of 22 Indian languages." },
  { headline: "Every chain has a section. Every cage has a clause.", sub: "I know them all. Let's use them." },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Law = { icon: string; code: string; desc: string; year: string; penalty: string; covers: string; funFact: string; color: string };

const LAWS: Law[] = [
  { icon: "📜", code: "WPA 1972", desc: "Wild Life (Protection) Act", year: "1972 · Amended 2022", penalty: "Up to 7 yrs jail + ₹25,000 fine (Sec 51)", covers: "4 schedules · 900+ species · Tiger, elephant, leopard absolutely protected", funFact: "After the 2022 amendment, India dropped from 6 to 4 schedules — simpler but stricter.", color: "from-emerald-500/20 to-emerald-500/5" },
  { icon: "🐾", code: "PCA Act 1960", desc: "Prevention of Cruelty to Animals", year: "1960", penalty: "Sec 11 — fine ₹50 to ₹100 (under reform)", covers: "Every domestic and captive animal · AWBI enforces", funFact: "India was one of the first countries in Asia to legally recognize animal cruelty as a crime.", color: "from-amber-500/20 to-amber-500/5" },
  { icon: "⚖️", code: "BNS Sec 325", desc: "Bharatiya Nyaya Sanhita 2024", year: "Effective July 1, 2024", penalty: "Up to 5 years imprisonment + fine", covers: "Mischief by killing/maiming any animal — replaces IPC 428 & 429", funFact: "BNS modernised colonial-era laws — animal cruelty now sits beside other serious crimes.", color: "from-rose-500/20 to-rose-500/5" },
  { icon: "🌳", code: "FCA 1980", desc: "Forest Conservation Act", year: "1980", penalty: "Imprisonment + Net Present Value (NPV) recovery", covers: "Diversion of forest land · Central clearance required", funFact: "No state can convert forest land for non-forest use without Centre's nod — saved millions of hectares.", color: "from-green-700/20 to-green-700/5" },
  { icon: "🌿", code: "BD Act 2002", desc: "Biological Diversity Act", year: "2002", penalty: "Up to 5 yrs jail + ₹10 lakh fine", covers: "Bio-resources, traditional knowledge · NBA approval for access", funFact: "It made India one of the first to legally protect indigenous knowledge from biopiracy.", color: "from-teal-500/20 to-teal-500/5" },
  { icon: "🏛️", code: "Articles 48A & 51A(g)", desc: "Constitution of India", year: "1976 (42nd Amendment)", penalty: "Fundamental duty — not punitive, but courts cite it", covers: "State & every citizen MUST protect environment & wildlife", funFact: "The Supreme Court has used 51A(g) to grant legal personhood to rivers and animals.", color: "from-indigo-500/20 to-indigo-500/5" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function loadConvs(): Conversation[] {
  try { return JSON.parse(safeGet(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveConvs(c: Conversation[]) { safeSet(STORAGE_KEY, JSON.stringify(c)); }

export default function WildGuardChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<string>("English");
  const [langOpen, setLangOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [rotateKey, setRotateKey] = useState(0);
  const [slogan, setSlogan] = useState(() => SLOGAN_POOL[0]);
  const [scenarios, setScenarios] = useState(() => SCENARIO_POOL.slice(0, 6));
  const [flashLaw, setFlashLaw] = useState<Law | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const prevUserRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserSendRef = useRef<number>(0);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;

  useEffect(() => {
    setConversations(loadConvs());
    setLanguage(safeGet(LANG_KEY) || "English");
    setSlogan(SLOGAN_POOL[Math.floor(Math.random() * SLOGAN_POOL.length)]);
    setScenarios(pickRandom(SCENARIO_POOL, 6));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      prevUserRef.current = data.session?.user?.id ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (next && prevUserRef.current !== next.id) {
        const name = next.user_metadata?.name?.split(" ")[0] || next.email?.split("@")[0] || "friend";
        setWelcome(name);
        setTimeout(() => setWelcome(null), 3000);
      }
      prevUserRef.current = next?.id ?? null;
      if (session?.user) {
        setTimeout(async () => {
          const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .order("updated_at", { ascending: false });
          if (!error && data) {
            const cloud: Conversation[] = data.map((r: any) => ({
              id: r.id, title: r.title, language: r.language,
              messages: (r.messages as Msg[]) ?? [],
              updatedAt: new Date(r.updated_at).getTime(),
            }));
            setConversations(cloud);
          }
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (!user) saveConvs(conversations); }, [conversations, user]);
  useEffect(() => { safeSet(LANG_KEY, language); }, [language]);
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

  useEffect(() => {
    const onDoc = () => { setLangOpen(false); setPastOpen(false); setUserMenu(false); };
    if (langOpen || pastOpen || userMenu) {
      window.addEventListener("click", onDoc);
      return () => window.removeEventListener("click", onDoc);
    }
  }, [langOpen, pastOpen, userMenu]);

  async function signInGoogle() {
    setAuthLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Sign-in failed"); setAuthLoading(false); return; }
    if (result.redirected) return;
    setAuthLoading(false);
  }
  async function signOut() {
    await supabase.auth.signOut();
    setConversations(loadConvs());
    setActiveId(null);
    toast.success("Signed out");
  }

  function newChat() { setActiveId(null); setInput(""); rotatePrompts(); }

  async function deleteConv(id: string) {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    if (user) await supabase.from("conversations").delete().eq("id", id);
    toast.success("Chat deleted");
  }

  function shareChat() {
    if (!active || active.messages.length === 0) { toast.error("Nothing to share yet."); return; }
    const text = `WildGuard Chat — ${active.title}\n\n` + active.messages.map((m) => `${m.role === "user" ? "You" : "WildGuard"}:\n${m.content}`).join("\n\n");
    if (navigator.share) navigator.share({ title: "WildGuard Chat", text }).catch(() => {});
    else { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
  }

  function downloadChat() {
    if (!active || active.messages.length === 0) { toast.error("Nothing to download yet."); return; }
    const text = `WildGuard — Animal Protection AI for India\nConversation: ${active.title}\nDate: ${new Date(active.updatedAt).toLocaleString()}\nLanguage: ${active.language}\n${"=".repeat(60)}\n\n` +
      active.messages.map((m) => `${m.role === "user" ? "YOU" : "WILDGUARD"}\n${"-".repeat(20)}\n${m.content}\n`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `wildguard-${active.id}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  async function persistConv(conv: Conversation) {
    if (!user) return;
    await supabase.from("conversations").upsert({
      id: conv.id, user_id: user.id, title: conv.title, language: conv.language,
      messages: conv.messages as any,
    });
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    lastUserSendRef.current = Date.now();
    let convId = activeId;
    let convTitle = active?.title;
    const userMsg: Msg = { role: "user", content: text.trim() };

    if (!convId) {
      convId = user ? crypto.randomUUID() : uid();
      convTitle = text.trim().slice(0, 48);
      const newConv: Conversation = { id: convId, title: convTitle, messages: [userMsg], updatedAt: Date.now(), language };
      setConversations((cs) => [newConv, ...cs]);
      setActiveId(convId);
      if (user) await persistConv(newConv);
    } else {
      setConversations((cs) => cs.map((c) => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
    }

    setInput(""); setLoading(true);
    const updateAssistant = (full: string) => {
      setConversations((cs) => cs.map((c) => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: full };
        else msgs.push({ role: "assistant", content: full });
        return { ...c, messages: msgs, updatedAt: Date.now() };
      }));
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
        if (resp.status === 429) msg = "Too many requests. Please wait a moment.";
        else if (resp.status === 402) msg = "AI credits ran out. Please add funds.";
        updateAssistant(msg); toast.error(msg); setLoading(false); return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) { assistantSoFar += c; updateAssistant(assistantSoFar); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
      if (user && convId) {
        const finalConv = { id: convId, title: convTitle ?? text.slice(0, 48),
          messages: [...history, { role: "assistant" as const, content: assistantSoFar }],
          updatedAt: Date.now(), language };
        await persistConv(finalConv);
      }
    } catch (e) {
      console.error(e);
      updateAssistant("Connection error. Please check your network and try again.");
      toast.error("Connection error");
    } finally { setLoading(false); }
  }

  return (
    <div className="h-dvh overflow-hidden bg-background bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="flex h-dvh max-w-[1500px] mx-auto p-2 sm:p-5 gap-3 sm:gap-4">
        <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-5 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Leaf className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <div>
                  <div className="font-display text-xl leading-none">WildGuard</div>
                  <div className="text-[10px] tracking-[0.18em] text-muted-foreground mt-1 font-medium">INDIA WILDLIFE AI</div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground mt-3">
                Compassionate guide to India's wildlife laws — in any Indian language.
              </p>
            </div>
            <div className="p-3 flex-1 flex flex-col min-h-0">
              <div className="px-2 pt-1 pb-2 text-[10px] tracking-[0.18em] font-semibold text-muted-foreground">KEY LAWS — TAP TO FLIP</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {LAWS.map((l) => (
                  <button key={l.code} onClick={() => setFlashLaw(l)}
                    className="w-full flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left hover:bg-background hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 group">
                    <span className="text-base leading-none mt-0.5 transition-transform group-hover:scale-125 group-hover:rotate-6">{l.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{l.code}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{l.desc}</span>
                    </span>
                    <span className="text-[9px] tracking-widest text-muted-foreground/50 group-hover:text-primary mt-1 font-semibold">FLIP</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 gap-3 sm:gap-4">
          <header className="rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-sm px-4 sm:px-5 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-xl leading-tight truncate flex items-center gap-2">
                <span className="lg:hidden">🌿</span>
                <span>WildGuard AI</span>
                <span className="hidden sm:inline text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-sans font-semibold ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">Free</span>
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Powered by Gemini · 22 Indian languages</p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <IconBtn onClick={() => { setPastOpen((v) => !v); setLangOpen(false); setUserMenu(false); }}
                  icon={History} active={pastOpen} label="History" />
                {pastOpen && (
                  <Popover>
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-semibold">Past chats</span>
                      <button onClick={() => setPastOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    {conversations.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No past chats yet.</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto py-1">
                        {conversations.map((c) => (
                          <div key={c.id}
                            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary ${activeId === c.id ? "bg-secondary" : ""}`}
                            onClick={() => { setActiveId(c.id); setPastOpen(false); }}>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{c.title}</div>
                              <div className="text-[10px] text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString()} · {c.messages.length} msgs</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Popover>
                )}
              </div>

              <IconBtn onClick={shareChat} icon={Share2} label="Share" disabled={!active || messages.length === 0} />
              <IconBtn onClick={downloadChat} icon={Download} label="Download" disabled={!active || messages.length === 0} />

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setLangOpen((v) => !v); setPastOpen(false); setUserMenu(false); }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 h-9 text-xs font-medium hover:border-primary/40 hover:bg-background transition">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">{language.split(" ")[0]}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {langOpen && (
                  <Popover className="right-0">
                    <div className="max-h-72 overflow-y-auto py-1">
                      {LANGUAGES.map((l) => (
                        <button key={l} onClick={() => { setLanguage(l); setLangOpen(false); toast.success(`Language: ${l}`); }}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-secondary text-left">
                          <span>{l}</span>
                          {language === l && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </Popover>
                )}
              </div>

              {user ? (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setUserMenu((v) => !v); setLangOpen(false); setPastOpen(false); }}
                    className="flex items-center gap-2 rounded-full border border-border bg-background/60 pl-1 pr-3 h-9 text-xs font-medium hover:border-primary/40 transition">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">
                        {(user.email?.[0] ?? "U").toUpperCase()}
                      </div>
                    )}
                    <span className="hidden md:inline max-w-[100px] truncate">{user.user_metadata?.name || user.email?.split("@")[0]}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                  {userMenu && (
                    <Popover className="right-0 w-56">
                      <div className="px-3 py-2 border-b border-border">
                        <div className="text-xs font-medium truncate">{user.user_metadata?.name || "Signed in"}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <button onClick={signOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-left">
                        <LogOut className="h-3.5 w-3.5" /> Sign out
                      </button>
                    </Popover>
                  )}
                </div>
              ) : (
                <button onClick={signInGoogle} disabled={authLoading}
                  className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 h-9 text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition">
                  {authLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Sign in</span>
                </button>
              )}
            </div>
          </header>

          <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 sm:px-8 py-8">
                {empty ? (
                  <div className="space-y-5">
                    <div key={`slogan-${rotateKey}`} className="wg-slogan text-center px-2 pt-4">
                      <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.22em] font-semibold text-primary/70 mb-3">
                        <Sparkles className="h-3 w-3" /> A MESSAGE FOR YOU
                      </div>
                      <h2 className="font-display text-[1.7rem] sm:text-[2.3rem] leading-[1.1] text-primary">
                        {slogan.headline}
                      </h2>
                      <p className="text-foreground/70 text-[13px] sm:text-sm leading-relaxed mt-3 max-w-md mx-auto">{slogan.sub}</p>
                    </div>

                    <div key={`scen-${rotateKey}`}>
                      <div className="flex items-center justify-between px-1 mb-2.5">
                        <div className="text-[10px] tracking-[0.22em] font-semibold text-muted-foreground">TRY ONE OF THESE</div>
                        <button onClick={rotatePrompts}
                          className="text-[10px] tracking-wider font-semibold text-primary/80 hover:text-primary transition">SHUFFLE ↻</button>
                      </div>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                        {scenarios.map((s, idx) => (
                          <button key={s.title} onClick={() => send(s.desc)}
                            style={{ animationDelay: `${idx * 50}ms` }}
                            className="wg-card-pop flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                            <span className="text-xl leading-none mt-0.5 transition-transform group-hover:scale-110">{s.emoji}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{s.title}</span>
                              <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{s.desc}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 wg-fade-up" style={{ animationDelay: "300ms" }}>
                      <a href="tel:112" className="inline-flex items-center gap-1.5 rounded-full bg-emergency px-3 py-1.5 text-xs font-medium text-emergency-foreground hover:opacity-90 hover:scale-105 transition wg-pulse-soft">🚨 Emergency 112</a>
                      <a href="tel:1926" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70 hover:scale-105 transition">🌳 Forest 1926</a>
                      <a href="tel:+91-22-40727382" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70 hover:scale-105 transition">🐾 PETA India</a>
                    </div>

                    {!user && (
                      <div className="text-center text-[11px] text-muted-foreground italic">
                        💡 <button onClick={signInGoogle} className="underline hover:text-primary">Sign in with Google</button> to save your chats across devices.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((m, i) => <Bubble key={i} msg={m} isLast={i === messages.length - 1} />)}
                    {loading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex items-center gap-2 wg-fade-up">
                        <span className="wg-thinking-dot" />
                        <span className="wg-thinking-dot" />
                        <span className="wg-thinking-dot" />
                        <span className="wg-shimmer-text text-sm font-medium ml-1">WildGuard is thinking…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-background/30 backdrop-blur-md relative">
              <button onClick={newChat}
                className="absolute -top-5 right-4 sm:right-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 hover:-translate-y-0.5 transition">
                <Plus className="h-3.5 w-3.5" /> New Chat
              </button>
              <div className="mx-auto max-w-3xl px-4 sm:px-8 py-4">
                <form onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition shadow-sm">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Describe what you witnessed, or ask about wildlife laws…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground max-h-40"
                    style={{ minHeight: 40 }} />
                  <button type="submit" disabled={!input.trim() || loading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
                <p className="text-[11px] text-muted-foreground text-center mt-2.5">
                  Free · All 22 Indian languages · Replies in your selected language
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {flashLaw && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm wg-fade-up" onClick={() => setFlashLaw(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden wg-flash-pop bg-gradient-to-br ${flashLaw.color}`}>
            <button onClick={() => setFlashLaw(null)} className="absolute top-3 right-3 rounded-full bg-background/70 hover:bg-background p-1.5 transition"><X className="h-4 w-4" /></button>
            <div className="p-6 sm:p-7">
              <div className="text-5xl mb-3 wg-pulse-soft inline-block">{flashLaw.icon}</div>
              <div className="text-[10px] tracking-[0.2em] font-semibold text-muted-foreground">FLASHCARD</div>
              <h3 className="font-display text-2xl sm:text-3xl text-primary mt-1 leading-tight">{flashLaw.code}</h3>
              <p className="text-sm text-foreground/80 mt-1">{flashLaw.desc}</p>
              <p className="text-[11px] text-muted-foreground mt-1 italic">{flashLaw.year}</p>
              <div className="mt-5 space-y-3">
                <FlashRow label="What it covers" value={flashLaw.covers} />
                <FlashRow label="Penalty" value={flashLaw.penalty} />
                <FlashRow label="Did you know?" value={flashLaw.funFact} highlight />
              </div>
              <button onClick={() => { const law = flashLaw; setFlashLaw(null); send(`Tell me more about ${law.code} — ${law.desc}, in detail.`); }}
                className="mt-6 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-2">
                Ask WildGuard about this law →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlashRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-accent/40 bg-accent/5" : "border-border bg-background/60"}`}>
      <div className="text-[10px] tracking-[0.18em] font-semibold text-muted-foreground">{label.toUpperCase()}</div>
      <div className="text-sm text-foreground/90 mt-1 leading-relaxed">{value}</div>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-xl bg-background/50 border border-border/60 px-2 py-2.5 text-center">
      <div className="font-display text-xl text-primary leading-none">{big}</div>
      <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{small}</div>
    </div>
  );
}

function IconBtn({
  onClick, icon: Icon, label, active, disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string; active?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`flex items-center gap-1.5 rounded-full border h-9 px-3 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "border-primary/40 bg-primary/10 text-primary"
               : "border-border bg-background/60 text-foreground hover:border-primary/40 hover:bg-background"
      }`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function Popover({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute top-full mt-2 w-72 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function Bubble({ msg, isLast }: { msg: Msg; isLast?: boolean }) {
  const isUser = msg.role === "user";
  const animClass = isUser ? "wg-fade-up" : "wg-float-in";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} ${animClass}`}>
      <div className={
        isUser
          ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap"
          : `max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 text-[15px] text-card-foreground shadow-md wg-prose ${isLast ? "ring-1 ring-primary/10" : ""}`
      }>
        {isUser ? msg.content : <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>}
      </div>
    </div>
  );
}
