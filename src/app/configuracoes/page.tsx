'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  Save,
  Building,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  Lock,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUserSettings, saveUserSettings } from '@/lib/data-service';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { UserSettings, PricingMethod } from '@/lib/types';
import { toast } from 'sonner';

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Business and Pricing Defaults
  const [businessName, setBusinessName] = useState('');
  const [defaultPricingMethod, setDefaultPricingMethod] = useState<PricingMethod>('margin');
  const [defaultMarkup, setDefaultMarkup] = useState('100');
  const [defaultMargin, setDefaultMargin] = useState('50');
  const [defaultCardFee, setDefaultCardFee] = useState('3.5');
  const [roundToCents, setRoundToCents] = useState(true);

  // Default additional costs
  const [defaultAdditionalCosts, setDefaultAdditionalCosts] = useState<
    Array<{ description: string; amount: string; is_proportional: boolean }>
  >([]);

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const set = await getUserSettings();
        setBusinessName(set.business_name);
        setDefaultPricingMethod(set.default_pricing_method);
        setDefaultMarkup(String(set.default_markup_percentage));
        setDefaultMargin(String(set.default_target_margin_percentage));
        setDefaultCardFee(String(set.default_card_fee_percentage));
        setRoundToCents(set.round_prices_to_cents);
        setDefaultAdditionalCosts(
          set.default_additional_costs.map((c) => ({
            description: c.description,
            amount: String(c.amount),
            is_proportional: c.is_proportional,
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function addDefaultCost() {
    setDefaultAdditionalCosts((prev) => [
      ...prev,
      { description: 'Novo custo padrão', amount: '0.00', is_proportional: true },
    ]);
  }

  function removeDefaultCost(index: number) {
    setDefaultAdditionalCosts((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateDefaultCost(
    index: number,
    patch: Partial<(typeof defaultAdditionalCosts)[0]>
  ) {
    setDefaultAdditionalCosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await saveUserSettings({
        business_name: businessName.trim() || 'Minha Confeitaria',
        default_pricing_method: defaultPricingMethod,
        default_markup_percentage: parseFloat(defaultMarkup.replace(',', '.')) || 100,
        default_target_margin_percentage:
          parseFloat(defaultMargin.replace(',', '.')) || 50,
        default_card_fee_percentage:
          parseFloat(defaultCardFee.replace(',', '.')) || 0,
        round_prices_to_cents: roundToCents,
        default_additional_costs: defaultAdditionalCosts.map((c) => ({
          description: c.description,
          amount: parseFloat(c.amount.replace(',', '.')) || 0,
          is_proportional: c.is_proportional,
        })),
      });

      toast.success('Configurações padrão salvas com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas informadas não coincidem.');
      return;
    }

    setPasswordLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        if (supabase) {
          const { error } = await supabase.auth.updateUser({
            password: newPassword,
          });
          if (error) throw error;
        }
      }
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar senha.');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#35483E] tracking-tight">
            Configurações do Negócio
          </h1>
          <p className="text-sm text-[#6C7A72]">
            Defina os padrões de margem, taxas e custos que serão pré-carregados ao criar novas receitas.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Business Info */}
          <Card className="border-[#E8E3DB] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-[#35483E] flex items-center gap-2">
                <Building className="h-5 w-5 text-[#6D8576]" />
                Identificação do Ateliê / Confeitaria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Nome da Confeitaria / Marca
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Ateliê dos Doces, Doce Arte Confeitaria..."
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
                <span className="text-[11px] text-[#7A8780]">
                  Este nome será exibido nos cabeçalhos e nas fichas técnicas impressas.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Defaults */}
          <Card className="border-[#E8E3DB] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-[#35483E] flex items-center gap-2">
                <Percent className="h-5 w-5 text-[#6D8576]" />
                Padrões de Precificação e Margem
              </CardTitle>
              <CardDescription className="text-xs">
                Valores sugeridos automaticamente ao cadastrar uma nova receita.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#38463E]">
                    Método Padrão
                  </label>
                  <select
                    value={defaultPricingMethod}
                    onChange={(e) =>
                      setDefaultPricingMethod(e.target.value as PricingMethod)
                    }
                    className="flex h-11 w-full rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2 text-sm text-[#232C27] focus:border-[#6D8576] focus:outline-none"
                  >
                    <option value="margin">Margem sobre Venda</option>
                    <option value="markup">Markup sobre Custo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#38463E]">
                    Margem Desejada Padrão (%)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="99"
                    value={defaultMargin}
                    onChange={(e) => setDefaultMargin(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#38463E]">
                    Taxa Média de Cartão (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={defaultCardFee}
                    onChange={(e) => setDefaultCardFee(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Additional Costs */}
          <Card className="border-[#E8E3DB] bg-white">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-[#35483E] flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#6D8576]" />
                  Custos Adicionais Padrão
                </CardTitle>
                <CardDescription className="text-xs">
                  Estes custos serão inseridos automaticamente nas novas receitas que criar.
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDefaultCost}
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-[#6D8576]" />
                Adicionar
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {defaultAdditionalCosts.map((dac, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[#E7E2D8] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <Input
                    type="text"
                    value={dac.description}
                    onChange={(e) =>
                      updateDefaultCost(idx, { description: e.target.value })
                    }
                    placeholder="Descrição..."
                    className="flex-1 h-9 text-xs"
                  />

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#6F7D74]">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={dac.amount}
                        onChange={(e) =>
                          updateDefaultCost(idx, { amount: e.target.value })
                        }
                        className="w-20 h-9 text-xs font-mono"
                      />
                    </div>

                    <label className="flex items-center gap-1 text-xs text-[#4E5B53] whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dac.is_proportional}
                        onChange={(e) =>
                          updateDefaultCost(idx, {
                            is_proportional: e.target.checked,
                          })
                        }
                        className="rounded text-[#6D8576]"
                      />
                      <span>Proporcional</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeDefaultCost(idx)}
                      className="p-1 rounded text-[#8C9890] hover:text-[#C85A54] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} className="font-semibold shadow-sm">
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>

        {/* Change Password Card */}
        <Card className="border-[#E8E3DB] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#35483E] flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#6D8576]" />
              Segurança e Alteração de Senha
            </CardTitle>
            <CardDescription className="text-xs">
              Atualize sua senha de acesso ao Supabase Auth.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Nova Senha
                </label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Confirmar Nova Senha
                </label>
                <Input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                disabled={passwordLoading}
                className="font-medium"
              >
                <KeyRound className="h-4 w-4 mr-1.5 text-[#6D8576]" />
                {passwordLoading ? 'Atualizando...' : 'Atualizar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
