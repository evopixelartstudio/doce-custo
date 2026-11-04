import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase seguro e exclusivo para execução no servidor Next.js (Server Actions / Route Handlers).
 * NUNCA é enviado ao navegador nem incluído em bundles de cliente.
 * 
 * Utiliza preferencialmente SUPABASE_SERVICE_ROLE_KEY (armazenada de forma privada na Vercel).
 * Se não informada, aceita NEXT_PUBLIC_SUPABASE_ANON_KEY no servidor para compatibilidade.
 */
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Configuração do Supabase ausente no servidor. Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) no painel da Vercel / ambiente de produção.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

