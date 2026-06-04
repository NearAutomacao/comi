'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  QrCode, LayoutDashboard, BellRing, CreditCard,
  CalendarCheck, BarChart3, ArrowRight, ChevronDown, Smartphone,
  Zap, Clock, Wallet, ShieldCheck, HeartHandshake,
} from 'lucide-react'

const ORANGE = '#f97316'
const DARK   = '#111111'

const FEATURES = [
  { icon: QrCode,         title: 'Cardápio digital com QR Code',         desc: 'Cliente escaneia o QR da mesa e acessa o cardápio direto no celular. Sem papel, sem confusão.' },
  { icon: LayoutDashboard,title: 'Mapa de mesas em tempo real',           desc: 'Veja todas as mesas: livres, ocupadas e com pedido pendente, tudo atualizado automaticamente.' },
  { icon: BellRing,       title: 'Pedidos com notificação instantânea',   desc: 'Novos pedidos chegam ao gerente em tempo real, com toast e atualização imediata no painel.' },
  { icon: CreditCard,     title: 'Pagamento via PIX e cartão',            desc: 'Mercado Pago integrado direto à conta do restaurante. Cliente fecha a conta pelo celular.' },
  { icon: CalendarCheck,  title: 'Reservas online',                       desc: 'Clientes reservam mesa pelo celular. Você confirma ou recusa pelo painel, sem ligações.' },
  { icon: BarChart3,      title: 'Financeiro e relatórios',               desc: 'Controle de custos por prato, ticket médio e histórico de pagamentos em um único lugar.' },
]

const BENEFITS = [
  { icon: Zap,           title: 'Mais agilidade no atendimento',   desc: 'Cliente senta, escaneia e pede — sem esperar garçom para anotar.' },
  { icon: Clock,         title: 'Sem papel e sem confusão',        desc: 'Pedidos chegam digitais direto ao painel. Erros de anotação eliminados.' },
  { icon: Wallet,        title: 'Pagamento sem fila no caixa',     desc: 'O cliente divide a conta e paga direto pelo celular, na mesa.' },
  { icon: LayoutDashboard,title:'Visão completa do salão',         desc: 'Todas as mesas, status e pedidos em um único mapa interativo.' },
  { icon: HeartHandshake, title: 'Setup em minutos',               desc: 'QR code gerado automaticamente. Cardápio online em horas, não dias.' },
  { icon: ShieldCheck,   title: 'Dados do restaurante isolados',   desc: 'Multi-tenant: cada restaurante tem seus dados completamente separados.' },
]

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

export function ComiLandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { ref: featRef, visible: featVis } = useReveal()
  const { ref: benRef,  visible: benVis  } = useReveal()
  const { ref: ctaRef,  visible: ctaVis  } = useReveal(0.3)

  return (
    <div style={{ background: '#fff', color: DARK, fontFamily: 'Montserrat, var(--font-geist, system-ui)', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Michroma&family=Montserrat:wght@300;400;500;600;700;900&family=Poppins:wght@900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        a{text-decoration:none;}
        .reveal      { opacity:0; transform:translateY(20px); transition:opacity .6s ease,transform .6s ease; }
        .reveal.shown{ opacity:1; transform:none; }
        .stagger>*          { opacity:0; transform:translateY(18px); transition:opacity .5s ease,transform .5s ease; }
        .stagger.shown>*:nth-child(1){opacity:1;transform:none;transition-delay:.04s}
        .stagger.shown>*:nth-child(2){opacity:1;transform:none;transition-delay:.10s}
        .stagger.shown>*:nth-child(3){opacity:1;transform:none;transition-delay:.16s}
        .stagger.shown>*:nth-child(4){opacity:1;transform:none;transition-delay:.22s}
        .stagger.shown>*:nth-child(5){opacity:1;transform:none;transition-delay:.28s}
        .stagger.shown>*:nth-child(6){opacity:1;transform:none;transition-delay:.34s}
        .feat-card{background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:28px;transition:border-color .2s,box-shadow .2s,transform .2s;}
        .feat-card:hover{border-color:#fcd9b6;box-shadow:0 8px 32px rgba(249,115,22,.09);transform:translateY(-2px);}
        .ben-card{background:#f9f9f9;border:1px solid #eee;border-radius:16px;padding:24px 22px;display:flex;gap:16px;align-items:flex-start;}
        .nav-link{font-size:13px;font-weight:500;color:#555;text-decoration:none;transition:color .2s;font-family:Montserrat,sans-serif;}
        .nav-link:hover{color:#111;}
        .desk-nav{display:none;}
        @media(min-width:768px){.desk-nav{display:flex;}}
        @keyframes hero-in{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:none;}}
        .hero-title{animation:hero-in .7s ease .1s both;}
        .hero-sub  {animation:hero-in .7s ease .25s both;}
        .hero-ctas {animation:hero-in .7s ease .4s both;}
        @keyframes chevron-bounce{0%,100%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(6px);}}
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 60,
        background: scrolled ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: scrolled ? '1px solid #e8e8e8' : '1px solid transparent',
        transition: 'border-color .3s,background .3s',
      }}>
        <div style={{ padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', maxWidth: 1160, margin: '0 auto' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Image src="/icomi.png" alt="comi" width={34} height={34} style={{ borderRadius: 9 }} priority />
            <span style={{ fontWeight: 900, fontSize: 17, color: DARK, letterSpacing: '-0.4px', fontFamily: 'Poppins,sans-serif' }}>
              com<span style={{ color: ORANGE }}>i</span>
            </span>
          </Link>

          <div style={{ flex: 1, justifyContent: 'center', gap: 28, marginLeft: 40 }} className="desk-nav">
            {[['#funcionalidades', 'Funcionalidades'], ['#beneficios', 'Benefícios'], ['#contato', 'Contato']].map(([h, l]) => (
              <a key={h} href={h} className="nav-link">{l}</a>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: '#555', fontFamily: 'Montserrat,sans-serif' }} className="desk-nav">
              Entrar
            </Link>
            <Link href="/cadastro-restaurante" style={{
              fontSize: 13, fontWeight: 700, color: '#fff',
              background: ORANGE, padding: '8px 18px', borderRadius: 6,
              fontFamily: 'Montserrat,sans-serif',
              boxShadow: '0 2px 10px rgba(249,115,22,.30)',
              transition: 'background .2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#ea6c0a' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = ORANGE }}>
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(100px,14vh,160px) 24px clamp(60px,8vh,100px)',
        background: 'linear-gradient(160deg,#fff 0%,#fff7f0 60%,#fff 100%)',
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%,rgba(249,115,22,.06) 0%,transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%' }}>
          <div className="hero-title" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.22)',
            borderRadius: 100, padding: '5px 16px', marginBottom: 28,
            fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: '.18em',
            textTransform: 'uppercase', fontFamily: 'Michroma,sans-serif',
          }}>
            Sistema de gestão para restaurantes
          </div>

          <h1 className="hero-title" style={{
            fontSize: 'clamp(32px,5.5vw,64px)', fontWeight: 900, lineHeight: 1.1,
            letterSpacing: '-0.03em', color: DARK, marginBottom: 22,
            fontFamily: 'Poppins,sans-serif',
          }}>
            Seu restaurante na palma<br />
            <span style={{ color: ORANGE }}>da mão do cliente.</span>
          </h1>

          <p className="hero-sub" style={{
            fontSize: 'clamp(15px,1.8vw,19px)', color: '#666', lineHeight: 1.7,
            fontWeight: 300, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px',
          }}>
            Cardápio digital, pedidos em tempo real, pagamento pelo celular
            e gestão completa de mesas em uma única plataforma.
          </p>

          <div className="hero-ctas" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/cadastro-restaurante" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ORANGE, color: '#fff', fontSize: 15, fontWeight: 700,
              padding: '14px 32px', borderRadius: 6,
              boxShadow: '0 4px 20px rgba(249,115,22,.40)',
              fontFamily: 'Montserrat,sans-serif',
              transition: 'background .2s,transform .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#ea6c0a'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = ORANGE; el.style.transform = 'none' }}>
              Começar grátis <ArrowRight size={16} />
            </Link>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#fff', color: DARK, fontSize: 15, fontWeight: 600,
              padding: '13px 32px', borderRadius: 6,
              border: '1.5px solid #d1d1d1',
              fontFamily: 'Montserrat,sans-serif',
              transition: 'border-color .2s,transform .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#999'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#d1d1d1'; el.style.transform = 'none' }}>
              Acessar sistema
            </Link>
            <Link href="/cadastro" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(249,115,22,.08)', color: ORANGE, fontSize: 15, fontWeight: 700,
              padding: '13px 32px', borderRadius: 6,
              border: '1.5px solid rgba(249,115,22,.30)',
              fontFamily: 'Montserrat,sans-serif',
              transition: 'background .2s,transform .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'rgba(249,115,22,.15)'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'rgba(249,115,22,.08)'; el.style.transform = 'none' }}>
              <Smartphone size={16} /> Sou cliente
            </Link>
          </div>
        </div>

        <a href="#funcionalidades" style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', color: '#ccc', cursor: 'pointer' }}>
          <ChevronDown size={24} style={{ animation: 'chevron-bounce 2s ease-in-out infinite' }} />
        </a>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" style={{ padding: '100px 24px', background: '#f9f9f9', borderTop: '1px solid #eee' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Michroma,sans-serif' }}>Funcionalidades</p>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 900, letterSpacing: '-0.03em', color: DARK, marginBottom: 12, fontFamily: 'Poppins,sans-serif' }}>Tudo que seu restaurante precisa</h2>
            <p style={{ color: '#888', fontSize: 16, maxWidth: 440, margin: '0 auto', lineHeight: 1.65, fontWeight: 300 }}>Desenvolvido do cardápio ao pagamento, para restaurantes e lanchonetes de todos os tamanhos.</p>
          </div>
          <div ref={featRef} className={`stagger ${featVis ? 'shown' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feat-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon size={20} color={ORANGE} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: DARK }}>{title}</h3>
                <p style={{ fontSize: 13, color: '#777', lineHeight: 1.7, fontWeight: 300 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section id="beneficios" style={{ padding: '100px 24px', background: '#fff', borderTop: '1px solid #eee' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Michroma,sans-serif' }}>Benefícios</p>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 900, letterSpacing: '-0.03em', color: DARK, marginBottom: 12, fontFamily: 'Poppins,sans-serif' }}>Por que escolher o comi?</h2>
            <p style={{ color: '#888', fontSize: 16, maxWidth: 420, margin: '0 auto', lineHeight: 1.65, fontWeight: 300 }}>Menos papel, mais agilidade, clientes mais satisfeitos.</p>
          </div>
          <div ref={benRef} className={`stagger ${benVis ? 'shown' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="ben-card">
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={19} color={ORANGE} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 5 }}>{title}</p>
                  <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, fontWeight: 300 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="contato" style={{ padding: '100px 24px', textAlign: 'center', background: '#1a0d00', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(249,115,22,.18) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div ref={ctaRef} className={`reveal ${ctaVis ? 'shown' : ''}`} style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 20, fontFamily: 'Michroma,sans-serif' }}>Comece agora</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,52px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.15, fontFamily: 'Poppins,sans-serif' }}>
            Gestão completa para<br />seu restaurante.
          </h2>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 17, marginBottom: 44, lineHeight: 1.65, fontWeight: 300 }}>
            Cadastre seu restaurante, configure o cardápio e<br />comece a receber pedidos em minutos.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/cadastro-restaurante" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: ORANGE, color: '#fff', fontSize: 15, fontWeight: 700,
              padding: '16px 40px', borderRadius: 6,
              boxShadow: '0 6px 28px rgba(249,115,22,.45)',
              fontFamily: 'Montserrat,sans-serif',
              transition: 'background .2s,transform .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#ea6c0a'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = ORANGE; el.style.transform = 'none' }}>
              Criar conta grátis <ArrowRight size={18} />
            </Link>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 15, fontWeight: 600,
              padding: '15px 32px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,.18)',
              fontFamily: 'Montserrat,sans-serif',
              transition: 'background .2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.14)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.08)' }}>
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f9f9f9', borderTop: '1px solid #eee', padding: '36px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/icomi.png" alt="comi" width={28} height={28} style={{ borderRadius: 7, opacity: 0.8 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#555', fontFamily: 'Poppins,sans-serif' }}>comi</p>
              <p style={{ fontSize: 11, color: '#999', fontFamily: 'Montserrat,sans-serif', fontWeight: 300 }}>AWP Labs — CNPJ: 66.986.676/0001-04</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href="/login" style={{ fontSize: 12, color: '#888', fontFamily: 'Montserrat,sans-serif' }}>Acessar sistema</Link>
            <Link href="/cadastro-restaurante" style={{ fontSize: 12, color: '#888', fontFamily: 'Montserrat,sans-serif' }}>Cadastrar restaurante</Link>
            <a href="https://www.awplabs.com.br" style={{ fontSize: 12, color: '#888', fontFamily: 'Montserrat,sans-serif' }}>AWP Labs</a>
          </div>
          <p style={{ fontSize: 11, color: '#bbb', fontFamily: 'Montserrat,sans-serif', fontWeight: 300 }}>© {new Date().getFullYear()} AWP Labs. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
