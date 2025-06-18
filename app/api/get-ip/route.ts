// app/api/get-ip/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Captura o IP do cabeçalho da requisição.
  // 'x-forwarded-for' é o cabeçalho padrão para IPs de clientes em ambientes de proxy/CDN como a Vercel.
  const ip = req.headers.get('x-forwarded-for') || req.ip;

  return NextResponse.json({ ip });
}