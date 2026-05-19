import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function Login() {
  const [loginVal, setLoginVal] = useState('')
  const [senhaVal, setSenhaVal] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [checked,  setChecked]  = useState(false)

  useEffect(() => {
    if (localStorage.getItem('ff_auth') === 'ok') {
      window.location.replace('/')
    } else {
      setChecked(true)
    }
  }, [])

  if (!checked) return null

  const handleLogin = async () => {
    setError('')
    if (!loginVal.trim() || !senhaVal.trim()) { setError('Preencha login e senha.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    if (loginVal.toLowerCase().trim() === 'sanekeyla' && senhaVal === 'abraao') {
      localStorage.setItem('ff_auth', 'ok')
      window.location.replace('/')
    } else {
      setError('Login ou senha incorretos.')
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin() }

  const IS: React.CSSProperties = {
    width: '100%', background: '#07111F', border: '1px solid #1E3A5F',
    borderRadius: 10, padding: '13px 14px', color: '#E2E8F0',
    fontSize: 15, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <>
      <Head>
        <title>FinançasFácil — Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'radial-gradient(ellipse at 50% 0%, #0F2744 0%, #07111F 70%)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: 18,
              width: 64, height: 64, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff',
              margin: '0 auto 16px', boxShadow: '0 0 40px #10B98140',
            }}>₢</div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px' }}>FinançasFácil</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Controle financeiro familiar</div>
          </div>

          {/* Card */}
          <div style={{
            background: '#0A1929', border: '1px solid #1E3A5F', borderRadius: 20,
            padding: '32px 28px', boxShadow: '0 24px 64px #00000060',
          }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Entrar</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 28 }}>Acesso restrito ao casal 💑</div>

            {/* Login */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Login</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>👤</span>
                <input type="text" placeholder="seu login" value={loginVal}
                  onChange={e => { setLoginVal(e.target.value); setError('') }}
                  onKeyDown={onKey} autoCapitalize="none" autoCorrect="off"
                  style={{ ...IS, paddingLeft: 40 }} />
              </div>
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔒</span>
                <input type={showPass ? 'text' : 'password'} placeholder="sua senha" value={senhaVal}
                  onChange={e => { setSenhaVal(e.target.value); setError('') }}
                  onKeyDown={onKey} style={{ ...IS, paddingLeft: 40, paddingRight: 44 }} />
                <button onClick={() => setShowPass(p => !p)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#475569', padding: 0,
                }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#EF444418', border: '1px solid #EF444440', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: '#EF4444', marginBottom: 16,
              }}>⚠️ {error}</div>
            )}

            {/* Botão */}
            <button onClick={handleLogin} disabled={loading} style={{
              width: '100%', padding: 14,
              background: loading ? '#1E3A5F' : 'linear-gradient(135deg,#10B981,#059669)',
              border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Entrando...' : 'Entrar no app 🏠'}
            </button>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#1E3A5F', marginTop: 24 }}>
            FinançasFácil · Uso privado
          </div>
        </div>
      </div>
    </>
  )
}