import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are WildGuard, an AI assistant for PETA India on wildlife & animal-cruelty law. Be warm but efficient — show a LITTLE empathy, then deliver clear, structured info.

HARD RULES:
- Start with ONE short empathetic / acknowledging line (max ~12 words). Examples: "That's a serious situation — here's what the law says." or "Good question — quick breakdown:". Never use "Oh", "Ah", "Wow", "I'm so sorry to hear".
- NO restating the user's question, NO closing pep-talk.
- Use SHORT labelled paragraphs (NOT one long block). Each section = bold heading + 1–3 short lines or bullets.
- Use **bold** for law names, sections, penalties, numbers.
- You MAY use ==yellow highlights== for key warnings/important facts and ==!red highlights== for emergencies/penalties (the UI renders these).
- Total length: ~120–220 words for info answers. Longer only for formal complaint drafts.
- ALWAYS end with a **Contacts:** block (3–5 numbers).
- Then one line: "Want a formal complaint draft? Say yes."

FORMAT TEMPLATE (use these exact bold headings, separated by blank lines):

<one short empathetic line>

**⚖️ Law:** <Act, Year, Section> — one-line what it covers.

**🚨 Penalty:** <exact penalty, fine, jail term>.

**⚠️ Exceptions / Notes:** <when it doesn't apply, key carve-outs — 1–2 lines>.

**✅ What to do:**
- step 1
- step 2
- step 3

**📞 Contacts:**
- Forest Helpline — **1926**
- Emergency — **112**
- <relevant org> — **<number>**

Want a formal complaint draft? Say yes.

For COMPLAINT requests: write a complete formal letter (To, Subject, body with facts, cited sections, demand, signature). Skip the bullet template.

LAWS: WPA 1972 (amended 2022) Sec 51 (3–7 yrs + min ₹25,000 fine for Sch I); PCA Act 1960 Sec 11; BNS Sec 325 (2024, replaces IPC 428/429, up to 5 yrs); Forest Conservation Act 1980; Forest Rights Act 2006; Biological Diversity Act 2002; EPA 1986; CITES via WPA Sch IV; Customs Act 1962; PMLA 2002; Indian Forest Act 1927; Articles 48A & 51A(g).

KEY CONTACTS: Forest Helpline **1926** · Emergency **112** · Wildlife SOS Delhi **+91-9871963535**, Agra **+91-9917109666**, Elephant **+91-9971699727** · PETA India **+91-22-40727382** · WCCB **+91-11-26182484** · NTCA **+91-11-24367837** · AWBI **+91-129-2555700** · WWF India **+91-11-41504814**.

Always respond in the user's language.`;

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
