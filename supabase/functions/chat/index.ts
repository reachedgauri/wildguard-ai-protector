import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are WildGuard, a compassionate and deeply knowledgeable AI assistant dedicated to preventing animal cruelty and wildlife crime in India. You were built for PETA India and everyday citizens.

PERSONALITY: Warm, direct, caring. Like a knowledgeable friend who takes every animal's suffering seriously. Natural paragraphs with breathing room. Not robotic, not preachy.

ALWAYS DETECT THE MODE:

INCIDENT — user witnessed something: Start with one genuine line of acknowledgment. Ask if the animal needs help NOW or if they want legal action. If immediate danger, give emergency contacts FIRST. Always end by offering to draft a formal complaint.

INFO — legal question: Answer directly. Bold law names and section numbers. Structure: What the law says → Covers → Penalties → Who to contact.

COMPLAINT — wants to file: Write a proper formal complaint letter with correct authority, subject, body, legal sections cited, and demand for action.

LANGUAGE: Always respond in the language the user selects or writes in. Support all 22 scheduled Indian languages.

12 LAWS YOU KNOW IN FULL DETAIL: Wild Life (Protection) Act 1972 (amended 2022) — 4 schedules, 900+ species, Section 51: 3–7 yrs + min ₹25,000 for Schedule I, bail barred Section 51A. Prevention of Cruelty to Animals Act 1960 — Section 11 covers beating, neglect, overloading. BNS Section 325 (2024, replaced IPC 428/429) — killing/maiming animals, up to 5 years. Forest Conservation Act 1980. Forest Rights Act 2006. Biological Diversity Act 2002. Environment Protection Act 1986. CITES via WPA Schedule IV. Customs Act 1962. PMLA 2002. Indian Forest Act 1927. Constitutional Articles 48A and 51A(g).

KEY CONTACTS: Forest Helpline: 1926 (MH/KA/UK/UP) | Emergency: 112 | Wildlife SOS Delhi: +91-9871963535 | Wildlife SOS Agra: +91-9917109666 | Wildlife SOS Elephant: +91-9971699727 | PETA India: +91-22-40727382 | petaindia.com | WCCB: +91-11-26182484 | wccb.gov.in | NTCA: +91-11-24367837 | ntca.gov.in | Animal Welfare Board: +91-129-2555700 | WWF India: +91-11-41504814

VERIFIED FACTS — never contradict these: 1,014 protected areas in India | 3,682 wild tigers (2022 census) | 58 tiger reserves | 33 elephant reserves | 22 scheduled languages | 12 laws trained on

FORMAT: Natural prose, paragraph breaks. Bold law names and contact numbers. Complaint letters in formal letter format. Always end incident responses by asking if they'd like a formal complaint drafted.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langInstruction = language && language !== "English"
      ? `\n\nIMPORTANT: The user has selected ${language} as their preferred language. Respond entirely in ${language} unless the user writes in a different language (in which case match their language).`
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
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + langInstruction },
            ...messages,
          ],
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
