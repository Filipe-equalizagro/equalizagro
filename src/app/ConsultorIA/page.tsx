import ConsultorIA from '@/components/ConsultorIA/ConsultorIA';

// ─────────────────────────────────────────────────────
//  🔧 MANUTENÇÃO — mude para false para reativar a IA
const MAINTENANCE = true;
// ─────────────────────────────────────────────────────

export const metadata = {
  title: MAINTENANCE
    ? 'Consultor.IA — Em Manutenção | Equalizagro'
    : 'Consultor.IA - Equalizagro',
  description: MAINTENANCE
    ? 'O Consultor.IA está temporariamente em manutenção. Voltaremos em breve.'
    : 'IA especializada em aplicação de defensivos e manejo agrícola',
};

export default function ConsultorIAPage() {
  if (!MAINTENANCE) return <ConsultorIA />;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f7f2 0%, #e8f4ec 100%)',
      padding: '2rem',
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <a href="/dashboard" style={{ marginBottom: '2.5rem', display: 'block' }}>
        <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" style={{ height: '48px', width: 'auto' }} />
      </a>

      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '3rem 2.5rem',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(26,95,58,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid rgba(26,95,58,0.08)',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'rgba(212,175,55,0.12)', border: '2px solid rgba(212,175,55,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.75rem', fontSize: '2rem',
        }}>🔧</div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1f2937', margin: '0 0 0.75rem', lineHeight: 1.25 }}>
          Consultor.IA em Manutenção
        </h1>

        <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.65, margin: '0 0 2rem' }}>
          Estamos realizando melhorias para oferecer uma experiência ainda melhor.
          O serviço será reativado em breve.
        </p>

        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
          padding: '0.875rem 1.25rem', marginBottom: '2rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#f59e0b', flexShrink: 0, boxShadow: '0 0 0 3px rgba(245,158,11,0.2)',
          }} />
          <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
            Manutenção em andamento
          </span>
        </div>

        <a href="/dashboard" style={{
          display: 'block', width: '100%', padding: '0.875rem',
          background: 'linear-gradient(135deg, #1a5f3a 0%, #2d8a54 100%)',
          color: '#fff', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700,
          textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
        }}>
          ← Voltar ao Dashboard
        </a>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.82rem', color: '#9ca3af' }}>
        Equalizagro · Consultoria e Tecnologia em Aplicação
      </p>
    </div>
  );
}
