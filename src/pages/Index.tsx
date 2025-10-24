import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="flex items-center justify-center mb-8">
          <div className="h-24 w-24 rounded-full bg-gradient-alchemy flex items-center justify-center text-5xl shadow-glow animate-pulse">
            🧪
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-alchemy bg-clip-text text-transparent mb-4">
          EmoLab
        </h1>
        
        <p className="text-xl md:text-2xl text-foreground mb-4">
          Laboratório de Alquimia Emocional
        </p>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Uma plataforma de comunicação mediada por IA, projetada para facilitar a expansão da consciência
          individual e coletiva através do apaziguamento interno e compreensão mútua profunda.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="shadow-alchemy text-lg px-8 py-6"
          >
            Iniciar Jornada
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
          <div className="p-6 rounded-lg bg-card border border-border shadow-card">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Destilação Tripla</h3>
            <p className="text-sm text-muted-foreground">
              A IA processa suas mensagens em três níveis: Sinopse, Resumo e Debate, garantindo clareza total.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-border shadow-card">
            <div className="text-3xl mb-3">🤝</div>
            <h3 className="font-bold mb-2">Mediação Socrática</h3>
            <p className="text-sm text-muted-foreground">
              Sussurros privados da IA ajudam cada participante a compreender as perspectivas dos outros.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-border shadow-card">
            <div className="text-3xl mb-3">✨</div>
            <h3 className="font-bold mb-2">Consciência Expandida</h3>
            <p className="text-sm text-muted-foreground">
              Insights personalizados sobre padrões, necessidades e valores emocionais ao longo do tempo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
