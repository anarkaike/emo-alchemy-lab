import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message_id, chat_id } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get message details
    const { data: message } = await supabase
      .from("messages")
      .select(`
        *,
        message_versions(*),
        author:author_user_id(username, email)
      `)
      .eq("message_id", message_id)
      .single();
    
    if (!message) throw new Error("Message not found");
    
    const version = message.message_versions.find((v: any) => 
      v.message_version_id === message.published_version_id
    );
    
    // Get all participants except author
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id, users(username, email)")
      .eq("chat_id", chat_id)
      .neq("user_id", message.author_user_id);
    
    if (!participants) return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
    // Generate whispers for each participant
    for (const participant of participants) {
      const participantData = participant.users as any;
      const prompt = `Você é o mediador alquímico do EmoLab. ${message.author.username} acabou de publicar esta mensagem:

SINOPSE: ${version.content_synopsis}
RESUMO: ${version.content_summary}
DEBATE: ${version.content_debate}

Agora você deve criar um "sussurro" privado para ${participantData.username}, ajudando-o a:
1. Compreender a intenção profunda do autor
2. Identificar possíveis gatilhos emocionais
3. Sugerir uma perspectiva construtiva

Responda em 2-4 frases, de forma empática e clara. Foque na construção de pontes, não em críticas.`;

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
              content: "Você é um mediador especializado em criar empatia e compreensão entre pessoas."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.8
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const whisperContent = aiData.choices[0].message.content;
        
        await supabase
          .from("whispers")
          .insert({
            chat_id: chat_id,
            recipient_user_id: participant.user_id,
            related_message_id: message_id,
            content: whisperContent,
            is_visible_to_group: false
          });
      }
    }
    
    return new Response(
      JSON.stringify({ success: true }),
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
