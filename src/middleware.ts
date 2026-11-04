import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Se tentar acessar a rota antiga de login, redireciona diretamente para o dashboard
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/recuperar-senha') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
