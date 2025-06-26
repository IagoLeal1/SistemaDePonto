// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Verifica se o utilizador está autenticado e qual a sua função com base nos cookies.
 * @param request A requisição Next.js.
 * @returns {object} Um objeto com 'isAuthenticated' (boolean) e 'userRole' (string | null).
 */
function getUserAuthStatus(request: NextRequest): { isAuthenticated: boolean; userRole: string | null } {
  const userLoggedInCookie = request.cookies.get('user_logged_in');
  const userRoleCookie = request.cookies.get('user_role');

  const isAuthenticated = userLoggedInCookie?.value === 'true';
  const userRole = userRoleCookie?.value || null;

  console.log(`[Middleware] Cookie 'user_logged_in': ${userLoggedInCookie ? userLoggedInCookie.value : 'Não encontrado'}`);
  console.log(`[Middleware] Cookie 'user_role': ${userRoleCookie ? userRoleCookie.value : 'Não encontrado'}`);
  console.log(`[Middleware] isAuthenticated: ${isAuthenticated}`);
  console.log(`[Middleware] userRole: ${userRole}`);

  return { isAuthenticated, userRole };
}

/**
 * Middleware para controlar o acesso a rotas com base no status de autenticação e função.
 * Redireciona utilizadores não autenticados para a página de login.
 * Redireciona utilizadores autenticados (não admin) para /ponto.
 * Redireciona utilizadores autenticados (admin) para /admin/dashboard.
 * @param request A requisição Next.js.
 * @returns {NextResponse} Uma resposta que permite a continuação ou redireciona.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl; // Pega o caminho da URL atual

  console.log(`[Middleware] Pathname atual: ${pathname}`);

  const { isAuthenticated: isUserAuthenticated, userRole } = getUserAuthStatus(request);

  // Rotas que devem ser acessíveis apenas por utilizadores não autenticados
  const publicAuthRoutes = ['/login', '/register'];

  // Rotas protegidas (requerem autenticação)
  const protectedRoutes = ['/', '/ponto', '/admin/dashboard']; // Adicione outras rotas protegidas aqui
  const isAdminRoute = pathname.startsWith('/admin/dashboard');

  // Lógica de redirecionamento
  if (!isUserAuthenticated) {
    // Se o utilizador NÃO está autenticado e tenta aceder a uma rota protegida
    if (protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
      console.log(`[Middleware] Utilizador NÃO autenticado a aceder ${pathname}. Redirecionando para /login`);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else { // Se o utilizador ESTÁ autenticado
    // Se o utilizador autenticado tenta aceder a uma rota de autenticação pública ou à raiz
    if (publicAuthRoutes.includes(pathname) || pathname === '/') {
      if (userRole === 'admin') {
        console.log(`[Middleware] Admin autenticado a aceder ${pathname}. Redirecionando para /admin/dashboard`);
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else { // Se não for admin (é employee)
        console.log(`[Middleware] Utilizador (não admin) autenticado a aceder ${pathname}. Redirecionando para /ponto`);
        return NextResponse.redirect(new URL('/ponto', request.url));
      }
    }

    // Se o utilizador é um empregado e tenta aceder a uma rota de admin
    if (isAdminRoute && userRole !== 'admin') {
      console.log(`[Middleware] Utilizador (não admin) a tentar aceder rota de admin ${pathname}. Redirecionando para /ponto`);
      return NextResponse.redirect(new URL('/ponto', request.url));
    }
  }

  console.log(`[Middleware] Permissão para aceder ${pathname}.`);
  return NextResponse.next();
}

/**
 * Configuração do matcher para o middleware.
 * Define quais caminhos de requisição este middleware deve intercetar.
 *
 * Inclui todas as rotas que precisam de verificação de autenticação/função.
 */
export const config = {
  matcher: [
    '/',                 // Rota inicial
    '/login',            // Página de login
    '/register',         // Página de registo
    '/ponto/:path*',     // Todas as rotas que começam com /ponto
    '/admin/dashboard/:path*', // Todas as rotas que começam com /admin/dashboard
  ],
};
