// app/page.tsx
// Este é um componente de rota de entrada que será processado pelo middleware.
// Ele serve primariamente para acionar os redirecionamentos de autenticação.
// O conteúdo real desta página raramente será visível para o usuário final.

export default function RootPage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>Carregando...</h1>
      <p>Redirecionando para a página correta.</p>
    </div>
  );
}
