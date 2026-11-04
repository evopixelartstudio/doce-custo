'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CakeSlice, Lock, Mail, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const supabaseConfigured = isSupabaseConfigured();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!supabaseConfigured) {
        // Modo demonstração
        toast.success('Entrando no modo demonstração...');
        router.push('/dashboard');
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Cliente Supabase indisponível');

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error('Credenciais inválidas: ' + error.message);
        return;
      }

      toast.success('Bem-vinda de volta!');
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryEmail) {
      toast.error('Informe seu e-mail cadastrado');
      return;
    }

    setRecoveryLoading(true);
    try {
      if (!supabaseConfigured) {
        toast.info('Instruções simuladas de recuperação enviadas para seu e-mail.');
        setShowRecovery(false);
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Cliente Supabase indisponível');

      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/configuracoes`,
      });

      if (error) {
        toast.error('Erro ao solicitar recuperação: ' + error.message);
        return;
      }

      toast.success('Link de recuperação enviado para o seu e-mail!');
      setShowRecovery(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro na recuperação');
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleDemoAccess() {
    toast.success('Acessando o sistema com dados de exemplo da confeitaria.');
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-14 w-14 rounded-3xl bg-[#6D8576] flex items-center justify-center text-white shadow-md shadow-[#6D8576]/30">
            <CakeSlice className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#35483E]">
            DoceCusto
          </h1>
          <p className="text-sm text-[#65736B]">
            Gestão profissional de receitas, custos e precificação
          </p>
        </div>

        {/* Card */}
        <Card className="border-[#E5E0D8] shadow-sm bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-[#35483E]">
              {showRecovery ? 'Recuperar Senha' : 'Acesso ao Sistema'}
            </CardTitle>
            <CardDescription className="text-xs text-[#6A7870]">
              {showRecovery
                ? 'Digite o e-mail cadastrado para receber o link de redefinição de senha.'
                : 'Uso individual. Insira suas credenciais de confeiteira.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!showRecovery ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#404D45] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#6D8576]" />
                    E-mail
                  </label>
                  <Input
                    type="email"
                    placeholder="confeiteira@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#404D45] flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#6D8576]" />
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRecovery(true)}
                      className="text-xs text-[#6D8576] hover:underline font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-medium"
                  size="lg"
                >
                  {loading ? 'Entrando...' : 'Entrar no DoceCusto'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#404D45] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#6D8576]" />
                    E-mail cadastrado
                  </label>
                  <Input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRecovery(false)}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={recoveryLoading}
                    className="flex-1"
                  >
                    {recoveryLoading ? 'Enviando...' : 'Enviar Link'}
                  </Button>
                </div>
              </form>
            )}

            {/* Quick Demo Access Button */}
            <div className="pt-2 border-t border-[#EAE5DC] flex flex-col space-y-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDemoAccess}
                className="w-full text-xs font-medium text-[#35483E]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#6D8576] mr-1.5" />
                Acessar Demonstração (Sem Login)
              </Button>
              <p className="text-[11px] text-center text-[#7A8780] leading-tight">
                Sistema seguro com isolamento por usuário e proteção RLS. Não há auto-cadastro público.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
