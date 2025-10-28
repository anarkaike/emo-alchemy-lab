import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message_id, raw_content, version_id, refinement } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get current version number
    const { data: versions } = await supabase
      .from("message_versions")
      .select("version_number")
      .eq("message_id", message_id)
      .order("version_number", { ascending: false })
      .limit(1);
    
    const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;
    
    // Build prompt
    let prompt = `Você é o Chef Alquimista do EmoLab. Analise esta mensagem e destile-a em 3 níveis:

MENSAGEM BRUTA:
${raw_content}`;

    if (refinement) {
      prompt += `\n\nCOMENTÁRIO DE REFINAMENTO DO AUTOR:
${refinement}

Por favor, ajuste a análise com base no feedback do autor.`;
    }

    prompt += `\n\nResponda EXATAMENTE neste formato JSON:
{
  "synopsis": "A essência emocional e intenção central em 1-2 frases",
  "summary": "Os argumentos lógicos e pontos factuais de forma estruturada",
  "debate": "Os pontos de atrito, palavras-gatilho e emoções que podem gerar reação"
}`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em comunicação não-violenta e mediação de conflitos. Sua função é destilar mensagens em suas essências mais puras."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Error:", errorText);
      throw new Error(`AI Error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response not in expected format");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Insert new version
    const { data: newVersion, error: versionError } = await supabase
      .from("message_versions")
      .insert({
        message_id: message_id,
        version_number: nextVersion,
        content_synopsis: parsed.synopsis,
        content_summary: parsed.summary,
        content_debate: parsed.debate,
        is_approved_by_author: false
      })
      .select()
      .single();
    
    if (versionError) throw versionError;
    
    return new Response(
      JSON.stringify({ success: true, version: newVersion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
