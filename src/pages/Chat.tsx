import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Mic, MicOff, Archive, Send } from "lucide-react";

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chat, setChat] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [whispers, setWhispers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [rawMessage, setRawMessage] = useState("");
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<any>(null);
  const [refinementComment, setRefinementComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChatData();
    
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, () => loadMessages())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chats',
        filter: `chat_id=eq.${chatId}`
      }, () => loadChat())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  const loadChatData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/auth");
    
    setCurrentUser(user);
    await loadChat();
    await loadParticipants();
    await loadMessages();
    await loadWhispers(user.id);
  };

  const loadChat = async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("chat_id", chatId)
      .single();
    
    if (error || !data) {
      toast.error("Chat não encontrado");
      navigate("/dashboard");
      return;
    }
    
    setChat(data);
    setHasMicrophone(data.current_speaker_user_id === currentUser?.id);
  };

  const loadParticipants = async () => {
    const { data } = await supabase
      .from("chat_participants")
      .select("user_id, users(username, email)")
      .eq("chat_id", chatId);
    
    if (data) setParticipants(data);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select(`
        *,
        message_versions(*),
        users(username)
      `)
      .eq("chat_id", chatId)
      .eq("status", "published")
      .order("created_at", { ascending: true });
    
    if (data) setMessages(data);
  };

  const loadWhispers = async (userId: string) => {
    const { data } = await supabase
      .from("whispers")
      .select("*")
      .eq("chat_id", chatId)
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false });
    
    if (data) setWhispers(data);
  };

  const requestMicrophone = async () => {
    if (!currentUser) return;
    
    const { error } = await supabase
      .from("microphone_requests")
      .insert({
        chat_id: chatId,
        user_id: currentUser.id,
        status: "pending"
      });
    
    if (error) {
      toast.error("Erro ao pedir microfone");
    } else {
      toast.success("Pedido de microfone registrado");
    }
  };

  const submitRawMessage = async () => {
    if (!rawMessage.trim() || !currentUser) return;
    
    setLoading(true);
    
    try {
      // Insert raw message
      const { data: message, error: msgError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          author_user_id: currentUser.id,
          raw_content: rawMessage,
          status: "pending_review"
        })
        .select()
        .single();
      
      if (msgError) throw msgError;

      // Call edge function to process
      const { data: functionData, error: functionError } = await supabase.functions.invoke('process-message', {
        body: { message_id: message.message_id, raw_content: rawMessage }
      });
      
      if (functionError) throw functionError;
      
      // Load the generated version
      const { data: version } = await supabase
        .from("message_versions")
        .select("*")
        .eq("message_id", message.message_id)
        .order("version_number", { ascending: false })
        .single();
      
      setPendingVersion(version);
      setRawMessage("");
      toast.success("Mensagem analisada pela IA");
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar mensagem");
    } finally {
      setLoading(false);
    }
  };

  const submitRefinement = async () => {
    if (!refinementComment.trim() || !pendingVersion) return;
    
    setLoading(true);
    
    try {
      await supabase
        .from("message_refinements")
        .insert({
          message_version_id: pendingVersion.message_version_id,
          author_user_id: currentUser.id,
          comment_text: refinementComment
        });
      
      // Reprocess with refinement
      const { data: functionData } = await supabase.functions.invoke('process-message', {
        body: { 
          message_id: pendingVersion.message_id,
          version_id: pendingVersion.message_version_id,
          refinement: refinementComment
        }
      });
      
      // Reload version
      const { data: newVersion } = await supabase
        .from("message_versions")
        .select("*")
        .eq("message_id", pendingVersion.message_id)
        .order("version_number", { ascending: false })
        .single();
      
      setPendingVersion(newVersion);
      setRefinementComment("");
      toast.success("Nova versão gerada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao refinar");
    } finally {
      setLoading(false);
    }
  };

  const approveMessage = async () => {
    if (!pendingVersion) return;
    
    setLoading(true);
    
    try {
      // Update message status
      await supabase
        .from("messages")
        .update({ 
          status: "published",
          published_version_id: pendingVersion.message_version_id
        })
        .eq("message_id", pendingVersion.message_id);
      
      // Generate whispers
      await supabase.functions.invoke('generate-whispers', {
        body: { 
          message_id: pendingVersion.message_id,
          chat_id: chatId
        }
      });
      
      // Release microphone
      await supabase
        .from("chats")
        .update({ current_speaker_user_id: null })
        .eq("chat_id", chatId);
      
      setPendingVersion(null);
      toast.success("Mensagem publicada!");
      loadMessages();
    } catch (error: any) {
      toast.error(error.message || "Erro ao publicar");
    } finally {
      setLoading(false);
    }
  };

  const revealWhisper = async (whisperId: string) => {
    const { error } = await supabase
      .from("whispers")
      .update({ is_visible_to_group: true })
      .eq("whisper_id", whisperId);
    
    if (error) {
      toast.error("Erro ao revelar sussurro");
    } else {
      toast.success("Sussurro revelado ao grupo");
      loadWhispers(currentUser.id);
    }
  };

  if (!chat) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-foreground">{chat.topic}</h1>
            <p className="text-sm text-muted-foreground">
              {participants.length} participantes
            </p>
          </div>
          <Button variant="outline" size="icon">
            <Archive className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Info */}
        <Card className="p-6 lg:col-span-1">
          <h3 className="font-semibold mb-4">Participantes</h3>
          <div className="space-y-3">
            {participants.map((p: any) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-alchemy flex items-center justify-center text-sm">
                  {p.users?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm">{p.users?.username || p.users?.email}</span>
                {chat.current_speaker_user_id === p.user_id && (
                  <Mic className="h-4 w-4 text-primary ml-auto" />
                )}
              </div>
            ))}
          </div>
          
          {!hasMicrophone && (
            <Button 
              onClick={requestMicrophone}
              className="w-full mt-4"
              variant="outline"
            >
              <MicOff className="h-4 w-4 mr-2" />
              Pedir Microfone
            </Button>
          )}
        </Card>

        {/* Center Panel - Messages */}
        <Card className="p-6 lg:col-span-2 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="space-y-6">
            {messages.map((msg: any) => {
              const version = msg.message_versions?.find((v: any) => v.message_version_id === msg.published_version_id);
              return (
                <div key={msg.message_id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-alchemy flex items-center justify-center text-sm">
                      {msg.users?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-semibold text-sm">{msg.users?.username}</span>
                  </div>
                  
                  {version && (
                    <div className="ml-10 space-y-2 text-sm">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-semibold text-xs text-primary mb-1">Sinopse (Espírito)</p>
                        <p>{version.content_synopsis}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-xs text-primary mb-1">Resumo (Corpo)</p>
                        <p>{version.content_summary}</p>
                      </div>
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <p className="font-semibold text-xs text-primary mb-1">Debate (Sal)</p>
                        <p>{version.content_debate}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Panel - Input/Whispers */}
        <Card className="p-6 lg:col-span-1">
          {hasMicrophone && !pendingVersion && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Seu Turno
              </h3>
              <Textarea
                value={rawMessage}
                onChange={(e) => setRawMessage(e.target.value)}
                placeholder="Escreva sua mensagem bruta..."
                className="min-h-[150px]"
              />
              <Button 
                onClick={submitRawMessage} 
                disabled={loading || !rawMessage.trim()}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar para IA
              </Button>
            </div>
          )}

          {hasMicrophone && pendingVersion && (
            <div className="space-y-4">
              <h3 className="font-semibold">Revisão da IA</h3>
              
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-muted/50 rounded">
                  <p className="font-semibold text-primary">Sinopse</p>
                  <p>{pendingVersion.content_synopsis}</p>
                </div>
                <div className="p-2 bg-muted/30 rounded">
                  <p className="font-semibold text-primary">Resumo</p>
                  <p>{pendingVersion.content_summary}</p>
                </div>
                <div className="p-2 bg-muted/20 rounded">
                  <p className="font-semibold text-primary">Debate</p>
                  <p>{pendingVersion.content_debate}</p>
                </div>
              </div>

              <Textarea
                value={refinementComment}
                onChange={(e) => setRefinementComment(e.target.value)}
                placeholder="Comentários de refinamento..."
                className="min-h-[80px]"
              />
              
              <div className="flex gap-2">
                <Button 
                  onClick={submitRefinement}
                  disabled={loading || !refinementComment.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  Refinar
                </Button>
                <Button 
                  onClick={approveMessage}
                  disabled={loading}
                  className="flex-1"
                >
                  Aprovar
                </Button>
              </div>
            </div>
          )}

          {whispers.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-sm">Sussurros da IA</h3>
              {whispers.map((w: any) => (
                <div key={w.whisper_id} className="p-3 bg-primary/10 rounded-lg text-xs space-y-2">
                  <p>{w.content}</p>
                  {!w.is_visible_to_group && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => revealWhisper(w.whisper_id)}
                      className="text-xs h-auto py-1"
                    >
                      Tornar Visível
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
