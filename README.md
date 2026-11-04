# DoceCusto — Sistema de Gestão de Receitas e Precificação para Confeitaria

Aplicação web completa desenvolvida com Next.js (App Router), TypeScript, Tailwind CSS e Supabase, projetada sob medida para uma confeiteira gerenciar ingredientes, fichas técnicas, custos de produção e cálculo preciso de preços de venda.

---

## 🎨 Identidade Visual e Experiência

- **Fundo:** Creme muito claro (`#FAF8F5`)
- **Cor Principal:** Verde sálvia (`#6D8576`)
- **Títulos e Destaques:** Verde escuro (`#35483E`)
- **Superfícies e Cartões:** Branco puro (`#FFFFFF`) com bordas suaves e cantos arredondados
- **Tipografia:** Inter
- **Navegação:** Sidebar completa no desktop e barra inferior/menu compacto em dispositivos móveis
- **Botões Grandes & Interface Tátil:** Desenvolvida para uso prático durante a rotina de produção da cozinha

---

## 🚀 Funcionalidades Principais

### 1. Dashboard Funcional
- Contadores de ingredientes e receitas cadastradas
- Custo médio de produção das receitas
- Atalhos rápidos para cadastrar ingrediente ou criar receita
- Lista de receitas atualizadas recentemente com custo e preço sugerido
- Lista de ingredientes com atualização recente de preços

### 2. Módulo de Ingredientes
- CRUD completo com categorias gastronômicas (laticínios, farináceos, chocolates, frutas, ovos, coberturas, embalagens e outros)
- Conversão automática de unidades (kg → g, L → ml)
- **Cálculo de custo unitário automático** a partir da embalagem e preço pagos
- Validação estrita: não mistura unidades incompatíveis sem fator de conversão
- Histórico completo de alterações de preços com data e hora
- Arquivamento seguro (soft delete) para proteger fichas técnicas já cadastradas

### 3. Módulo de Receitas e Sub-Receitas
- Montagem com busca e seleção de ingredientes e sub-receitas
- **Suporte a sub-receitas:** Exemplo: Recheio de Ninho que rende 1.000g custando R$ 25,00; ao usar 400g num bolo, o sistema calcula exatamente 400 / 1.000 × R$ 25,00 = R$ 10,00
- **Detecção de dependências circulares** (impede que uma receita inclua a si mesma direta ou indiretamente)
- Atualização dinâmica: ao alterar o preço de um ingrediente, todas as receitas recalculam os custos atuais automaticamente
- Duplicação e arquivamento de receitas em 1 clique

### 4. Custos Adicionais
- Embalagens, gás, energia elétrica, mão de obra, decoração e transporte
- Distinção entre custos proporcionais ao rendimento e custos fixos por fornada/lote
- Custos padrão personalizáveis nas configurações

### 5. Calculadora de Precificação Integrada
- **Método A (Markup sobre Custo):** `Preço = Custo × (1 + markup / 100)`
- **Método B (Margem Desejada sobre Venda):** `Preço = Custo / (1 - (margem + taxa_cartao) / 100)`
- Dedução precisa de taxas de cartão de crédito/débito sem cobrança duplicada
- Possibilidade de informar manualmente um preço de venda e visualizar o lucro e a margem resultantes
- **Alerta visual** caso a margem do preço manual fique abaixo da meta desejada
- Não sobrescreve o preço fixado pela confeiteira

### 6. Simulador de Produção em Escala
- Simulação de lotes (ex: receita padrão de 15 fatias escalada para 45 fatias)
- Multiplica ingredientes e custos proporcionais, mantendo custos fixos de lote
- Nova lista de compras e novo preço sugerido sem alterar a receita original

### 7. Ficha Técnica com Impressão A4
- Página individual detalhada com rendimento, composição, tempo de preparo, custos unitários e totais
- Botão **Imprimir A4** com folha de estilo de impressão limpa (`@media print`): oculta barras laterais, cabeçalhos do navegador e botões, gerando um documento pronto para impressão ou PDF

### 8. Configurações
- Nome da confeitaria / ateliê
- Margem desejada padrão, markup padrão e taxa média de cartão
- Lista de custos adicionais padrão
- Alteração segura de senha com Supabase Auth

---

## 🛠️ Stack Tecnológica

- **Framework:** Next.js (App Router com Turbopack)
- **Linguagem:** TypeScript
- **Estilos:** Tailwind CSS v4 + Radix UI + Lucide React
- **Matemática Financeira:** `decimal.js` (operações sem erros de ponto flutuante do JavaScript)
- **Banco de Dados & Autenticação:** Supabase PostgreSQL + Supabase Auth
- **Testes Automatizados:** Vitest

---

## ⚙️ Instalação e Execução Local

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz copiando de `.env.example`:
```bash
cp .env.example .env.local
```

Preencha com os dados do seu projeto no Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=seu-anon-key-aqui
```

> **Nota de Demonstração / Uso Offline:** Caso nenhuma chave seja configurada, a aplicação entra automaticamente em **Modo Demonstração**, utilizando persistência local com dados pré-cadastrados (Bolo de Chocolate, Recheio de Ninho, Brigadeiro Gourmet, Leite Condensado, etc.), permitindo testar todas as funcionalidades imediatamente.

### 3. Rodar os Testes Automatizados
```bash
npm run test
```

### 4. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000`.

---

## 🗄️ Estrutura do Banco de Dados no Supabase

As migrations completas com tabelas, índices, triggers, storage e políticas RLS estão disponíveis no arquivo:
`supabase/migrations/001_initial_schema.sql`

### Como aplicar no Supabase:
1. Acesse o painel do seu projeto no Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor** no menu lateral esquerdo.
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql` e clique em **Run**.
4. Crie o primeiro usuário da confeiteira em **Authentication -> Users -> Add User** (com e-mail e senha).
5. Pronto! O usuário terá isolamento completo por Row Level Security (RLS).

---

## ☁️ Deploy na Vercel

1. Suba o repositório para o GitHub ou GitLab.
2. Na Vercel, clique em **Add New Project** e importe o repositório.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**. A aplicação estará no ar!
