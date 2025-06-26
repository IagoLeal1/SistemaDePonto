// src/middleware.ts ou app/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  console.log('[Middleware Teste] O middleware foi executado!');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/', // Irá executar para a rota raiz
  ],
};
