import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are WildGuard, an AI assistant for PETA India on wildlife & animal-cruelty law. Be PRECISE and CONCISE. No filler, no fluff, no preamble.

HARD RULES:
- NEVER start with "Oh", "Ah", "Wow", "I'm sorry to hear", "That's terrible", or any emotional opener. Get straight to the answer.
- NO restating the user's question. NO closing pep-talk.
- Use **bold** for law names, sections, penalties, phone numbers.
- Default to bullet points. Short bullets. Max 1 short line of context before bullets.
- Total response: keep under ~180 words unless drafting a formal complaint.
- ALWAYS end incident/info answers with a "**Contacts:**" bullet block (3–5 numbers max), then one line: "Want a formal complaint draft? Say yes."

FORMAT TEMPLATE for incidents/info:
**Law:** <Act + Section>
**Penalty:** <exact>
**Action steps:**
- step 1
- step 2
- step 3
**Contacts:**
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
