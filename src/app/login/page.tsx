'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center">
      <span className="text-sm text-[#7C6970]">Redirecionando para o DoceCusto...</span>
    </div>
  );
}
