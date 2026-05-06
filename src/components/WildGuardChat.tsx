import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Globe, Plus, Share2, History, Download,
  ChevronDown, Loader2, Check, Trash2, X, LogIn, LogOut, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";
import leavesBg from "@/assets/leaves-bg.jpg";
import rhinoHero from "@/assets/rhino-hero.jpg";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Msg[]; updatedAt: number; language: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORAGE_KEY = "wildguard.conversations.v1";
const LANG_KEY = "wildguard.language";
const ENTERED_KEY = "wildguard.entered";

const isBrowser = typeof window !== "undefined";
const safeGet = (k: string) => (isBrowser ? window.localStorage.getItem(k) : null);
const safeSet = (k: string, v: string) => { if (isBrowser) window.localStorage.setItem(k, v); };

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
  { title: "Cockfighting", desc: "Illegal cockfight happening in my area" },
  { title: "Butterfly/insect trade", desc: "Someone is selling rare butterflies online" },
  { title: "Star tortoise as pet", desc: "My neighbour keeps a star tortoise at home" },
  { title: "Factory farm cruelty", desc: "Terrible conditions in a poultry/pig farm" },
  { title: "Animals in circus", desc: "Wild animals being used in a travelling circus" },
  { title: "Coral/marine trade", desc: "Someone selling coral and sea shells" },
  { title: "Temple elephant abuse", desc: "An elephant chained and beaten at a temple" },
  { title: "Stray dog cruelty", desc: "Someone is poisoning stray dogs in my colony" },
  { title: "Tiger skin / parts", desc: "I saw tiger skin being sold in a market" },
  { title: "Caged exotic birds", desc: "Parrots and macaws caged in a pet shop" },
  { title: "Snake charmer", desc: "Snake charmer with defanged cobras on the street" },
  { title: "Deer poaching", desc: "Suspected deer poaching near a forest area" },
];

const SLOGAN_POOL = [
  "EVERY ANIMAL. EVERY RIGHT. EVERY TIME.",
  "THEIR VOICE. YOUR ACTION.",
  "BREAK THE SILENCE. END THE CRUELTY.",
  "ONE WITNESS. ONE LAW. ONE LIFE SAVED.",
  "JUSTICE FOR THE VOICELESS.",
  "THEY CAN'T CALL 112. YOU CAN.",
];

const KEY_LAWS = [
  { code: "WPA 1972 (Amended 2022)", sub: "4 schedules · 2,600+ species" },
  { code: "PCA Act 1960", sub: "Animal welfare · AWBI · Sec 11" },
  { code: "BNS Section 325 (2024)", sub: "Replaces IPC 428/429" },
  { code: "Forest Conservation Act", sub: "Diversion · clearance · NPV" },
  { code: "Biological Diversity Act", sub: "Bio-resources · NBA · access" },
  { code: "BD Act / EPA 1986", sub: "Environment umbrella law" },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function loadConvs(): Conversation[] {
  try { return JSON.parse(safeGet(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveConvs(c: Conversation[]) { safeSet(STORAGE_KEY, JSON.stringify(c)); }

export default function WildGuardChat() {
  const [entered, setEntered] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<string>("English");
  const [langOpen, setLangOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [rotateKey, setRotateKey] = useState(0);
  const [slogan, setSlogan] = useState(SLOGAN_POOL[0]);
  const [scenarios, setScenarios] = useState(() => SCENARIO_POOL.slice(0, 6));
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
    setEntered(safeGet(ENTERED_KEY) === "1");
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
            .from("conversations").select("*").order("updated_at", { ascending: false });
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
      const others = SLOGAN_POOL.filter((s) => s !== prev);
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

  // ============== INTRO LANDING ==============
  // FIX 1: Removed the double-layered text. Now only ONE clean text layer on the right.
  if (!entered) {
    return (
      <div className="relative h-dvh w-full overflow-hidden bg-black">
        <img src={rhinoHero} alt="Indian rhinoceros" className="absolute inset-0 h-full w-full object-cover" />
        {/* Gradient only on the right side where text sits — no left overlay to keep rhino visible */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/40 to-transparent" />

        {/* Logo top-left */}
        <div className="absolute top-6 left-6 flex items-center gap-2 text-white/95 z-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-sm font-display">◐</div>
          <div>
            <div className="font-display text-lg leading-none">WildGuard</div>
            <div className="text-[9px] tracking-[0.25em] mt-1 font-semibold opacity-80">INDIA WILDLIFE AI</div>
          </div>
        </div>

        {/* Bottom-anchored minimal text — avoids overlapping any text in the hero image */}
        <div className="relative h-full flex flex-col justify-end items-center sm:items-end px-6 sm:px-16 pb-10 sm:pb-16 z-10">
          <div className="text-white text-center sm:text-right max-w-xl wg-fade-up">
            <p className="text-[10px] sm:text-xs tracking-[0.35em] font-semibold text-white/80 uppercase">
              India Wildlife &amp; Animal Protection AI
            </p>
            <p className="mt-3 text-white/85 text-sm sm:text-base tracking-wide max-w-sm sm:ml-auto mx-auto">
              Report cruelty. Know the law. Protect wildlife.
            </p>
            <button
              onClick={() => { safeSet(ENTERED_KEY, "1"); setEntered(true); }}
              className="mt-6 inline-flex items-center gap-3 border border-white/70 px-6 py-3 text-sm tracking-[0.2em] font-semibold hover:bg-white hover:text-black transition-all duration-300"
            >
              ENTER <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============== MAIN APP ==============
  return (
    <>
      {/* FIX 2: Inject scrollbar styles for the sidebar */}
      <style>{`
        .wg-sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .wg-sidebar-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
        }
        .wg-sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.45);
          border-radius: 3px;
        }
        .wg-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.7);
        }
        .wg-sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.45) rgba(255,255,255,0.05);
        }
      `}</style>

      <div className="h-dvh overflow-hidden bg-background flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex relative w-[280px] shrink-0 flex-col text-white overflow-hidden">
          <img src={leavesBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/75" />
          {/* FIX 2: Added wg-sidebar-scroll class for bright scrollbar */}
          <div className="relative flex flex-col h-full p-6 overflow-y-auto wg-sidebar-scroll">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 text-base font-display">◐</div>
              <div>
                <div className="font-display text-xl leading-none">WildGuard</div>
                <div className="text-[9px] tracking-[0.25em] mt-1.5 font-semibold opacity-80">INDIA WILDLIFE AI</div>
              </div>
            </div>

            <div className="mt-10">
              <div className="text-[10px] tracking-[0.25em] font-semibold opacity-80 mb-3">STATS TODAY</div>
              <div className="grid grid-cols-2 gap-2">
                <StatTile big="12" small="Laws trained on" />
                <StatTile big="22" small="Languages" />
                <StatTile big="900+" small="Protected species" />
                <StatTile big="3" small="Response modes" />
              </div>
            </div>

            <div className="mt-8 flex-1">
              <div className="text-[10px] tracking-[0.25em] font-semibold opacity-80 mb-3">KEY LAWS COVERED</div>
              <div className="space-y-2">
                {KEY_LAWS.map((l) => (
                  <div key={l.code} className="rounded-md bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 px-3.5 py-2.5 transition">
                    <div className="text-[12px] font-semibold leading-tight">{l.code}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{l.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#f4f1e8]">
          {/* Header */}
          <header className="px-4 sm:px-8 pt-4 sm:pt-5 pb-3 flex items-start gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl sm:text-2xl leading-tight text-primary">WildGuard AI</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Powered by AI · India Wildlife &amp; Animal Cruelty Laws</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* FIX 3: Past Chats button — fully functional */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <PillBtn icon={History} title="Past Chats" sub="your saved conversations"
                  onClick={() => { setPastOpen((v) => !v); setLangOpen(false); setUserMenu(false); }} active={pastOpen} />
                {pastOpen && (
                  <Popover>
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-semibold">Past chats</span>
                      <button onClick={() => setPastOpen(false)}><X className="h-3.5 w-3.5" /></button>
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

              {/* FIX 3: Share Chat — enabled, shows toast if no messages */}
              <PillBtn
                icon={Share2}
                title="Share Chat"
                sub={active && messages.length > 0 ? "share this conversation" : "available after first message"}
                onClick={shareChat}
                disabled={false}
              />

              {/* FIX 3: Download — enabled, shows toast if no messages */}
              <PillBtn
                icon={Download}
                title="Download"
                sub={active && messages.length > 0 ? "save as .txt" : "available after first message"}
                onClick={downloadChat}
                disabled={false}
              />

              {/* Language selector */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setLangOpen((v) => !v); setPastOpen(false); setUserMenu(false); }}
                  className="flex flex-col items-start rounded-md border border-border bg-card/70 px-3 py-1.5 hover:border-primary/40 transition text-left">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <span>Language: {language.split(" ")[0]}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">bot always replies in this lang</div>
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

              {/* Auth */}
              {user ? (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setUserMenu((v) => !v); setLangOpen(false); setPastOpen(false); }}
                    className="flex items-center gap-2 rounded-full border border-border bg-card/70 pl-1 pr-3 h-9 text-xs font-medium hover:border-primary/40 transition">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">
                        {(user.email?.[0] ?? "U").toUpperCase()}
                      </div>
                    )}
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                  {userMenu && (
                    <Popover className="right-0 w-56">
                      <div className="px-3 py-2 border-b border-border">
                        <div className="text-xs font-medium truncate">{user.user_metadata?.name || "Signed in"}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-left">
                        <LogOut className="h-3.5 w-3.5" /> Sign out
                      </button>
                    </Popover>
                  )}
                </div>
              ) : (
                <button onClick={signInGoogle} disabled={authLoading}
                  className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 h-9 text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition">
                  {authLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  Sign in
                </button>
              )}
            </div>
          </header>

          {/* Body */}
          <section className="flex-1 flex flex-col min-h-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-4 sm:px-10 py-6 sm:py-8">
                {empty ? (
                  <div>
                    <div key={`slogan-${rotateKey}`} className="wg-slogan text-center">
                      <h2 className="font-display font-bold text-primary leading-[0.95] tracking-tight text-[2rem] sm:text-[3.4rem]">
                        {slogan}
                      </h2>
                      <div className="mt-7 space-y-1.5 text-[13px] sm:text-[15px] text-foreground/70">
                        <p>Saw something cruel? Report it.</p>
                        <p>Don't know the law? Ask.</p>
                        <p>Need to file a complaint? I'll write it for you.</p>
                      </div>
                    </div>

                    <div key={`scen-${rotateKey}`} className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2">
                      {scenarios.map((s, idx) => (
                        <button key={s.title} onClick={() => send(s.desc)}
                          style={{ animationDelay: `${idx * 40}ms` }}
                          className="wg-card-pop rounded-lg border border-border bg-card/80 px-4 py-3 text-left hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                          <div className="text-[13px] font-semibold text-foreground">{s.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                      <a href="tel:112" className="rounded-full bg-emergency text-emergency-foreground px-4 py-2 text-[12px] font-semibold hover:opacity-90 transition wg-pulse-soft">Emergency 112</a>
                      <a href="tel:1926" className="rounded-full bg-card border border-border px-4 py-2 text-[12px] font-semibold hover:border-primary/40 transition">Forest 1926</a>
                      <a href="tel:+91-22-40727382" className="rounded-full bg-card border border-border px-4 py-2 text-[12px] font-semibold hover:border-primary/40 transition">PETA India</a>
                      <button onClick={newChat} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-[12px] font-semibold hover:bg-primary/90 transition inline-flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> New Chat
                      </button>
                    </div>

                    {!user && (
                      <div className="mt-5 text-center text-[11px] text-muted-foreground italic">
                        <button onClick={signInGoogle} className="underline hover:text-primary">Sign in with Google</button> to save your chats across devices.
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

            {/* Input bar */}
            <div className="px-4 sm:px-10 pb-5 pt-2">
              <div className="mx-auto max-w-4xl">
                {!empty && (
                  <div className="flex justify-end mb-2">
                    <button onClick={newChat} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition">
                      <Plus className="h-3 w-3" /> New Chat
                    </button>
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-end gap-2 rounded-full border border-border bg-card px-2 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition shadow-sm">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Describe what you witnessed, or ask about wildlife laws…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
                    style={{ minHeight: 36 }} />
                  <button type="submit" disabled={!input.trim() || loading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </form>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  WildGuard · Free · All 22 Indian languages · Responds in your selected language
                </p>
              </div>
            </div>
          </section>
        </main>

        {welcome && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm wg-fade-up">
            <div className="wg-flash-pop rounded-2xl border border-primary/30 bg-card shadow-2xl px-8 py-7 text-center max-w-sm w-full">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mb-3">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
              <div className="text-[10px] tracking-[0.22em] font-semibold text-primary/70">WELCOME</div>
              <h3 className="font-display text-2xl text-primary mt-1">Hi {welcome} 🌿</h3>
              <p className="text-sm text-foreground/70 mt-2">Loading your saved chats…</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatTile({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/5 backdrop-blur-sm px-3 py-2.5">
      <div className="font-display text-2xl leading-none">{big}</div>
      <div className="text-[10px] opacity-75 mt-1.5 leading-tight">{small}</div>
    </div>
  );
}

function PillBtn({
  icon: Icon, title, sub, onClick, active, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; sub: string; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-start rounded-md border bg-card/70 px-3 py-1.5 text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40"
      }`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
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
