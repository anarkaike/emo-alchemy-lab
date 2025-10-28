import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Check, X, Ban } from "lucide-react";

export default function Contacts() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newEmail, setNewEmail] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);

  useEffect(() => {
    loadUserAndContacts();
  }, []);

  const loadUserAndContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/auth");
    
    setCurrentUser(user);
    await loadContacts(user.id);
  };

  const loadContacts = async (userId: string) => {
    // Accepted contacts
    const { data: acceptedData } = await supabase
      .from("user_connections")
      .select(`
        *,
        requester:requester_user_id(user_id, username, email),
        recipient:recipient_user_id(user_id, username, email)
      `)
      .eq("status", "accepted")
      .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`);
    
    if (acceptedData) {
      const formatted = acceptedData.map((c: any) => ({
        ...c,
        otherUser: c.requester_user_id === userId ? c.recipient : c.requester
      }));
      setContacts(formatted);
    }

    // Pending requests
    const { data: pendingData } = await supabase
      .from("user_connections")
      .select(`
        *,
        requester:requester_user_id(user_id, username, email)
      `)
      .eq("status", "pending")
      .eq("recipient_user_id", userId);
    
    if (pendingData) setPending(pendingData);

    // Blocked users
    const { data: blockedData } = await supabase
      .from("user_connections")
      .select(`
        *,
        recipient:recipient_user_id(user_id, username, email)
      `)
      .eq("status", "blocked")
      .eq("requester_user_id", userId);
    
    if (blockedData) setBlocked(blockedData);
  };

  const sendRequest = async () => {
    if (!newEmail.trim() || !currentUser) return;
    
    // Find user by email
    const { data: targetUser } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", newEmail.trim())
      .single();
    
    if (!targetUser) {
      toast.error("Utilizador não encontrado");
      return;
    }
    
    if (targetUser.user_id === currentUser.id) {
      toast.error("Não pode adicionar-se a si mesmo");
      return;
    }

    const { error } = await supabase
      .from("user_connections")
      .insert({
        requester_user_id: currentUser.id,
        recipient_user_id: targetUser.user_id,
        status: "pending"
      });
    
    if (error) {
      if (error.code === "23505") {
        toast.error("Pedido já existe");
      } else {
        toast.error("Erro ao enviar pedido");
      }
    } else {
      toast.success("Pedido enviado!");
      setNewEmail("");
    }
  };

  const acceptRequest = async (connectionId: string) => {
    const { error } = await supabase
      .from("user_connections")
      .update({ status: "accepted" })
      .eq("connection_id", connectionId);
    
    if (error) {
      toast.error("Erro ao aceitar pedido");
    } else {
      toast.success("Contacto adicionado!");
      loadContacts(currentUser.id);
    }
  };

  const rejectRequest = async (connectionId: string) => {
    const { error } = await supabase
      .from("user_connections")
      .delete()
      .eq("connection_id", connectionId);
    
    if (error) {
      toast.error("Erro ao recusar pedido");
    } else {
      toast.success("Pedido recusado");
      loadContacts(currentUser.id);
    }
  };

  const blockUser = async (userId: string) => {
    const { error } = await supabase
      .from("user_connections")
      .insert({
        requester_user_id: currentUser.id,
        recipient_user_id: userId,
        status: "blocked"
      });
    
    if (error) {
      toast.error("Erro ao bloquear");
    } else {
      toast.success("Utilizador bloqueado");
      loadContacts(currentUser.id);
    }
  };

  const unblockUser = async (connectionId: string) => {
    const { error } = await supabase
      .from("user_connections")
      .delete()
      .eq("connection_id", connectionId);
    
    if (error) {
      toast.error("Erro ao desbloquear");
    } else {
      toast.success("Utilizador desbloqueado");
      loadContacts(currentUser.id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Gestão de Contactos</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Adicionar Novo Contacto</h2>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Email do utilizador..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendRequest()}
            />
            <Button onClick={sendRequest}>
              <UserPlus className="h-4 w-4 mr-2" />
              Enviar Pedido
            </Button>
          </div>
        </Card>

        <Tabs defaultValue="contacts">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contacts">Contactos ({contacts.length})</TabsTrigger>
            <TabsTrigger value="pending">Pedidos ({pending.length})</TabsTrigger>
            <TabsTrigger value="blocked">Bloqueados ({blocked.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-3 mt-4">
            {contacts.map((c: any) => (
              <Card key={c.connection_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-alchemy flex items-center justify-center">
                    {c.otherUser?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold">{c.otherUser?.username || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{c.otherUser?.email}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => blockUser(c.otherUser.user_id)}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            {contacts.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum contacto ainda</p>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {pending.map((p: any) => (
              <Card key={p.connection_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-alchemy flex items-center justify-center">
                    {p.requester?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold">{p.requester?.username || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{p.requester?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="icon" 
                    variant="default"
                    onClick={() => acceptRequest(p.connection_id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => rejectRequest(p.connection_id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {pending.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum pedido pendente</p>
            )}
          </TabsContent>

          <TabsContent value="blocked" className="space-y-3 mt-4">
            {blocked.map((b: any) => (
              <Card key={b.connection_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {b.recipient?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold">{b.recipient?.username || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{b.recipient?.email}</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => unblockUser(b.connection_id)}
                >
                  Desbloquear
                </Button>
              </Card>
            ))}
            {blocked.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum utilizador bloqueado</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
