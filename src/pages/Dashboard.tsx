import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "@supabase/supabase-js";
import { Plus, MessageSquare, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadChats();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadChats = async () => {
    const { data, error } = await (supabase as any)
      .from("chat_participants")
      .select(`
        chat_id,
        chats (
          chat_id,
          topic,
          status,
          created_at
        )
      `)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error loading chats:", error);
      return;
    }

    setChats(data?.map((p: any) => p.chats).filter(Boolean) || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-alchemy flex items-center justify-center text-xl shadow-glow">
              🧪
            </div>
            <h1 className="text-2xl font-bold bg-gradient-alchemy bg-clip-text text-transparent">
              EmoLab
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="shadow-card hover:shadow-alchemy transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Laboratórios Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {chats.filter((c) => c.status === "active").length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-alchemy transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Conexões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">0</div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-alchemy transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-alchemy bg-clip-text text-transparent">
                0
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Seus Laboratórios</h2>
          <Button
            onClick={() => navigate("/chat/new")}
            className="shadow-alchemy"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Laboratório
          </Button>
        </div>

        {chats.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <div className="mb-4 text-6xl">🧪</div>
              <CardTitle className="mb-2">Nenhum laboratório ainda</CardTitle>
              <CardDescription className="mb-4">
                Crie seu primeiro laboratório de alquimia emocional
              </CardDescription>
              <Button onClick={() => navigate("/chat/new")}>
                Criar Laboratório
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {chats.map((chat) => (
              <Card
                key={chat.chat_id}
                className="shadow-card hover:shadow-alchemy transition-all cursor-pointer"
                onClick={() => navigate(`/chat/${chat.chat_id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{chat.topic}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={chat.status === "active" ? "default" : "secondary"}>
                          {chat.status === "active" ? "Ativo" : "Arquivado"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(chat.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
