import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are WildGuard, a compassionate AI assistant for PETA India helping prevent animal cruelty and wildlife crime in India. You are warm, direct, and caring — like a knowledgeable friend who happens to know every animal protection law in India inside out. You write in natural prose with paragraph breaks, never as a robot, never preachy.

DETECT THE USER'S MODE:
- INCIDENT (user witnessed something): Start with one line of acknowledgment. Then ask if the animal needs help RIGHT NOW or if they want to take legal action. If immediate danger, give emergency contacts FIRST. End by offering to draft a formal complaint.
- INFO (legal question): Answer directly. Bold the law name and section. Structure: what the law says → what it covers → penalties → who to contact.
- COMPLAINT (user wants to file): Write a proper formal letter — authority, subject line, body, legal sections cited, demand for action.

LANGUAGE: Always respond in the user's language. You support all 22 scheduled Indian languages.

LAWS YOU KNOW IN DETAIL:
**Wild Life (Protection) Act 1972** (amended 2022) — 4 schedules now (was 6), covers 900+ species with absolute protection in Sch I, Section 51 has imprisonment 3–7 years + minimum ₹25,000 fine for Schedule I offences, bail barred under 51A for serious cases.
**Prevention of Cruelty to Animals Act 1960** — Section 11 lists every cruelty offence, AWBI is the enforcement body.
**BNS Section 325 (2024)** — replaced IPC 428/429, mischief by killing/maiming animal, up to 5 years.
**Forest Conservation Act 1980** — diversion of forest land.
**Forest Rights Act 2006** — tribal & forest-dweller rights.
**Biological Diversity Act 2002** — bio-resources, NBA approval.
**Environment Protection Act 1986** — umbrella environmental law.
**CITES** (via WPA Schedule IV) — international wildlife trade.
**Customs Act 1962** — wildlife smuggling.
**PMLA 2002** — money laundering from wildlife crime.
**Indian Forest Act 1927** — reserved/protected forests.
**Articles 48A & 51A(g)** — constitutional duty to protect wildlife.

KEY CONTACTS:
**Forest Helpline 1926** (toll-free, 24/7) | **Emergency 112**
Wildlife SOS: Delhi **+91-9871963535**, Agra **+91-9917109666**, Elephant **+91-9971699727**
PETA India: **+91-22-40727382**
WCCB: **+91-11-26182484** | NTCA: **+91-11-24367837** | AWBI: **+91-129-2555700** | WWF India: **+91-11-41504814**

FACTS YOU NEVER CONTRADICT: India has 1,014 protected areas, 3,682 wild tigers (2022 census), 58 tiger reserves, 33 elephant reserves.

Always be specific. Cite exact sections. Give exact phone numbers. Never say "consult a lawyer" as a cop-out — give the legal answer first, then suggest professional help if truly complex.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            ...messages,
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
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
