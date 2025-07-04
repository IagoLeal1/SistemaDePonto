// app/api/get-ip/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Captura o IP do cabeçalho da requisição.
  // 'x-forwarded-for' é o cabeçalho padrão para IPs de clientes em ambientes de proxy/CDN como a Vercel.
  // Ele pode conter uma lista de IPs (ex: "clienteIp, proxy1Ip, proxy2Ip"), então pegamos o primeiro.
  const xForwardedFor = req.headers.get('x-forwarded-for');
  
  // Se 'x-forwarded-for' existir, pegamos o primeiro IP da lista e removemos espaços em branco.
  // Caso contrário, o IP será null ou undefined, o que é tratado na verificação abaixo.
  const ip = xForwardedFor ? xForwardedFor.split(',')[0].trim() : null;

  // É uma boa prática verificar se o IP foi realmente obtido.
  // Se não for possível determinar o IP, você pode retornar um erro ou um valor padrão.
  if (!ip) {
    // Retorna uma resposta de erro se o IP não puder ser determinado.
    // Você pode ajustar o status e a mensagem conforme a necessidade do seu aplicativo.
    return new NextResponse(JSON.stringify({ message: 'Não foi possível determinar o endereço IP.' }), { status: 500 });
  }

  return NextResponse.json({ ip });
}