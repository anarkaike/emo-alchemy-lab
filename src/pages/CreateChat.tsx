import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const CreateChat = () => {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: chat, error: chatError } = await (supabase as any)
        .from("chats")
        .insert({
          topic,
          created_by: user.id,
          status: "active",
        })
        .select()
        .single();

      if (chatError) throw chatError;
      if (!chat) throw new Error("Failed to create chat");

      const { error: participantError } = await (supabase as any)
        .from("chat_participants")
        .insert({
          chat_id: chat.chat_id,
          user_id: user.id,
        });

      if (participantError) throw participantError;

      toast.success("Laboratório criado com sucesso!");
      navigate(`/chat/${chat.chat_id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="shadow-alchemy">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-gradient-alchemy flex items-center justify-center text-3xl shadow-glow">
                🧪
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Novo Laboratório de Alquimia Emocional
            </CardTitle>
            <CardDescription className="text-center">
              Defina o tema ou intenção clara para esta sessão
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreate}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Tema Alvo *</Label>
                <Textarea
                  id="topic"
                  placeholder="Ex: Melhorar a comunicação sobre responsabilidades domésticas..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  rows={4}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  O tema deve ser claro e específico para guiar a conversa de forma focada.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar Laboratório"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateChat;
