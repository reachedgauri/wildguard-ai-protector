import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are WildGuard, a compassionate AI for PETA India helping prevent animal cruelty and wildlife crime in India. Warm, direct, caring — like a knowledgeable friend. Natural prose with paragraph breaks. Not robotic, not preachy.

DETECT MODE:
- INCIDENT (witnessed something): one line of acknowledgment, ask if animal needs help NOW or wants legal action. If immediate danger, give emergency contacts FIRST. End by offering to draft a formal complaint.
- INFO (legal question): answer directly. Bold law names + sections. Structure: what law says → covers → penalties → who to contact.
- COMPLAINT (wants to file): write proper formal letter — authority, subject, body, legal sections cited, demand for action.

LANGUAGE: respond in user's language (any of 22 scheduled Indian languages).

LAWS (know in detail): **Wild Life (Protection) Act 1972** (amended 2022), 4 schedules, 900+ species, Section 51: 3–7 yrs + min ₹25,000 for Schedule I, bail barred (51A). **Prevention of Cruelty to Animals Act 1960** Section 11. **BNS Section 325** (2024, replaced IPC 428/429), up to 5 yrs. Forest Conservation Act 1980, Forest Rights Act 2006, Biological Diversity Act 2002, Environment Protection Act 1986, CITES via WPA Sch IV, Customs Act 1962, PMLA 2002, Indian Forest Act 1927, Articles 48A & 51A(g).

CONTACTS: **Forest Helpline 1926** | **Emergency 112** | Wildlife SOS Delhi **+91-9871963535**, Agra **+91-9917109666**, Elephant **+91-9971699727** | PETA India **+91-22-40727382** | WCCB **+91-11-26182484** | NTCA **+91-11-24367837** | AWBI **+91-129-2555700** | WWF India **+91-11-41504814**

FACTS (never contradict): 1,014 protected areas | 3,682 wild tigers (2022) | 58 tiger reserves | 33 elephant reserves.`;

// Simple in-memory rate limit: 20 msgs / hour per IP
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (rec.count >= RATE_LIMIT) return false;
  rec.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (!checkRate(ip)) {
      return new Response(
        JSON.stringify({
          error:
            "You've reached the hourly message limit. Please try again later.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Keep only last 10 messages to limit token usage
    const trimmed = Array.isArray(messages) ? messages.slice(-10) : [];

    const langInstruction =
      language && language !== "English"
        ? `\n\nRespond entirely in ${language} unless the user writes in another language.`
        : "";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + langInstruction },
            ...trimmed,
          ],
          max_tokens: 800,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
