import { useState, useMemo, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Transaction {
  id: number; type: string; description: string; amount: number
  category: string; date: string; paymentMethod: string; cardId: number | null
  installmentTotal?: number; installmentCurrent?: number; status: string
}
interface Card { id: number; name: string; limit: number; color: string }
interface Contribution { id: number; goalId: number; amount: number; date: string; note: string }
interface Goal { id: number; emoji: string; name: string; color: string; target: number; deadline: string; contributions: Contribution[] }
interface Recurring { id: number; type: string; description: string; amount: number; category: string; paymentMethod: string; dayOfMonth: number; cardId: number | null; active: boolean }
interface ConfirmState { type: 'transaction'|'card'|'goal'|'contribution'|'recurring'; id: number; message: string; extra?: number }

const CATEGORIES_EXPENSE = ['Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Vestuário','Assinaturas','Outros']
const CATEGORIES_INCOME  = ['Salário','Freelance','Investimentos','Aluguel Recebido','Outros']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const PIE_COLORS = ['#10B981','#F59E0B','#EF4444','#8B5CF6','#3B82F6','#EC4899','#06B6D4','#84CC16','#F97316']
const EMOJIS = ['🚗','🏠','✈️','🏖️','📱','💻','🎓','💍','👶','🛋️','🏋️','🎸','⛵','🐕','🌿','🏥','🎯','🔑','💎','🛒']
const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const today = () => new Date().toISOString().split('T')[0]
const pad = (n: number) => String(n).padStart(2, '0')

const EMPTY_FORM = {
  type: 'expense', description: '', amount: '', category: 'Outros',
  date: today(), paymentMethod: 'pix', cardId: '',
  mode: 'unico', installments: '2', dayOfMonth: '5', status: 'pendente',
}
const EMPTY_GOAL    = { emoji: '🎯', name: '', color: '#6366F1', target: '', deadline: '' }
const EMPTY_CONTRIB = { amount: '', date: today(), note: '' }

const daysUntil   = (ds: string) => { const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((new Date(ds+'T12:00:00').getTime()-t.getTime())/86400000) }
const monthsUntil = (ds: string) => Math.max(1, Math.ceil(daysUntil(ds)/30.44))

const IS: React.CSSProperties = { width:'100%', background:'#07111F', border:'1px solid #1E3A5F', borderRadius:8, padding:'10px 12px', color:'#E2E8F0', fontSize:14, fontFamily:'inherit', outline:'none' }
const LS: React.CSSProperties = { fontSize:11, color:'#64748B', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px', fontWeight:600 }

const StatusBadge = ({ status, onClick }: { status: string; onClick: () => void }) => (
  <button onClick={onClick} style={{
    background: status === 'pago' ? '#10B98120' : '#F59E0B18',
    border: `1px solid ${status === 'pago' ? '#10B98150' : '#F59E0B40'}`,
    color: status === 'pago' ? '#10B981' : '#F59E0B',
    borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    letterSpacing: '0.3px',
  }}>
    {status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
  </button>
)

function ConfirmDialog({ state, onConfirm, onCancel }: { state: ConfirmState|null; onConfirm:()=>void; onCancel:()=>void }) {
  if (!state) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'#000000D0', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:20 }}>
      <div style={{ background:'#0A1929', border:'1px solid #EF444440', borderRadius:20, padding:28, maxWidth:340, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:14 }}>🗑️</div>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:8 }}>Confirmar exclusão</div>
        <div style={{ fontSize:13, color:'#94A3B8', marginBottom:24, lineHeight:1.5 }}>{state.message}</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:12, background:'#07111F', border:'1px solid #1E3A5F', borderRadius:10, color:'#64748B', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex:1, padding:12, background:'linear-gradient(135deg,#EF4444,#DC2626)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Sim, excluir</button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cards,        setCards]        = useState<Card[]>([])
  const [goals,        setGoals]        = useState<Goal[]>([])
  const [recurring,    setRecurring]    = useState<Recurring[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [authed,       setAuthed]       = useState(false)

  const [activeTab,    setActiveTab]    = useState('dashboard')
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear,  setCurrentYear]  = useState(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState<'todos'|'pago'|'pendente'>('todos')

  const [showModal,        setShowModal]        = useState(false)
  const [showCardModal,    setShowCardModal]    = useState(false)
  const [showGoalModal,    setShowGoalModal]    = useState(false)
  const [showContribModal, setShowContribModal] = useState<number|null>(null)
  const [expandedGoal,     setExpandedGoal]     = useState<number|null>(null)
  const [confirmDelete,    setConfirmDelete]    = useState<ConfirmState|null>(null)

  const [form,        setForm]        = useState(EMPTY_FORM)
  const [cardForm,    setCardForm]    = useState({ name:'', limit:'', color:'#6366F1' })
  const [goalForm,    setGoalForm]    = useState(EMPTY_GOAL)
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB)

  useEffect(() => {
    if (localStorage.getItem('ff_auth') !== 'ok') {
      window.location.replace('/login')
    } else { setAuthed(true) }
  }, [])

  const handleLogout = () => { localStorage.removeItem('ff_auth'); window.location.replace('/login') }

  const refetch = useCallback(async () => {
    const [txs, cds, gls, rec] = await Promise.all([
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/recurring').then(r => r.json()),
    ])
    setTransactions(Array.isArray(txs) ? txs : [])
    setCards(Array.isArray(cds) ? cds : [])
    setGoals(Array.isArray(gls) ? gls : [])
    setRecurring(Array.isArray(rec) ? rec : [])
  }, [])

  useEffect(() => { if (!authed) return; refetch().finally(() => setLoading(false)) }, [authed, refetch])

  const prevMonth = () => { let m=currentMonth-1,y=currentYear; if(m<0){m=11;y--} setCurrentMonth(m);setCurrentYear(y) }
  const nextMonth = () => { let m=currentMonth+1,y=currentYear; if(m>11){m=0;y++} setCurrentMonth(m);setCurrentYear(y) }

  const monthTx = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date+'T12:00:00')
    return d.getMonth()===currentMonth && d.getFullYear()===currentYear
  }), [transactions, currentMonth, currentYear])

  const isApplied = (r: Recurring) => monthTx.some(t =>
    t.description === r.description && Math.abs(t.amount - r.amount) < 0.01 && t.type === r.type
  )

  const recurringVirtual = useMemo(() => recurring.filter(r => r.active && !isApplied(r)).map(r => ({
    id: -(r.id), type: r.type, description: r.description, amount: r.amount,
    category: r.category, date: `${currentYear}-${pad(currentMonth+1)}-${pad(Math.min(r.dayOfMonth,28))}`,
    paymentMethod: r.paymentMethod, cardId: r.cardId, status: 'pendente',
  })), [recurring, currentMonth, currentYear, monthTx])

  const allMonthItems = useMemo(() => [...monthTx, ...recurringVirtual], [monthTx, recurringVirtual])

  const totalIncome  = useMemo(() => allMonthItems.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),  [allMonthItems])
  const totalExpense = useMemo(() => allMonthItems.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0), [allMonthItems])
  const balance = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? ((balance/totalIncome)*100).toFixed(1) : '0.0'

  // só lançamentos PAGOS para totais reais
  const paidIncome  = useMemo(() => monthTx.filter(t=>t.type==='income'  && t.status==='pago').reduce((s,t)=>s+t.amount,0), [monthTx])
  const paidExpense = useMemo(() => monthTx.filter(t=>t.type==='expense' && t.status==='pago').reduce((s,t)=>s+t.amount,0), [monthTx])
  const pendingExpense = useMemo(() => allMonthItems.filter(t=>t.type==='expense' && t.status==='pendente').reduce((s,t)=>s+t.amount,0), [allMonthItems])

  const categoryData = useMemo(() => {
    const m: Record<string,number> = {}
    allMonthItems.filter(t=>t.type==='expense').forEach(t => { m[t.category]=(m[t.category]||0)+t.amount })
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  }, [allMonthItems])

  const historyData = useMemo(() => Array.from({length:6},(_,i)=>{
    let m=currentMonth-5+i,y=currentYear; while(m<0){m+=12;y--}
    const ts = transactions.filter(t=>{ const d=new Date(t.date+'T12:00:00'); return d.getMonth()===m&&d.getFullYear()===y })
    return { month:MONTHS[m].slice(0,3), income:ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0), expense:ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) }
  }), [transactions, currentMonth, currentYear])

  const cardSpending = useMemo(() => cards.map(c=>({...c, spent:monthTx.filter(t=>t.paymentMethod==='credit'&&t.cardId===c.id).reduce((s,t)=>s+t.amount,0)})), [cards,monthTx])

  const goalsStats = useMemo(() => goals.map(g=>{
    const saved=g.contributions.reduce((s,c)=>s+c.amount,0)
    const pct=Math.min(g.target>0?(saved/g.target)*100:0,100)
    const days=daysUntil(g.deadline); const months=monthsUntil(g.deadline)
    return {...g,saved,pct,days,months,needed:Math.max(0,(g.target-saved)/months),done:saved>=g.target}
  }), [goals])

  const totalGoalsSaved  = useMemo(()=>goalsStats.reduce((s,g)=>s+g.saved,0),[goalsStats])
  const totalGoalsTarget = useMemo(()=>goalsStats.reduce((s,g)=>s+g.target,0),[goalsStats])

  const filteredMonthTx = useMemo(() => {
    if (filterStatus === 'todos') return [...monthTx].reverse()
    return [...monthTx].filter(t => t.status === filterStatus).reverse()
  }, [monthTx, filterStatus])

  const withSave = async (fn: ()=>Promise<void>) => { setSaving(true); try { await fn() } finally { setSaving(false) } }

  const toggleStatus = (t: Transaction) => withSave(async () => {
    const next = t.status === 'pago' ? 'pendente' : 'pago'
    await fetch(`/api/transactions/${t.id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status: next }),
    })
    await refetch()
  })

  const addTransaction = () => withSave(async () => {
    if (!form.description.trim() || !form.amount) return
    if (form.mode === 'fixo') {
      await fetch('/api/recurring', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          type: form.type, description: form.description,
          amount: parseFloat(form.amount), category: form.category,
          paymentMethod: form.paymentMethod, cardId: form.cardId || null,
          dayOfMonth: parseInt(form.dayOfMonth) || 5,
        })
      })
    } else if (form.mode === 'parcelado') {
      const n = Math.max(2, parseInt(form.installments) || 2)
      const perMonth = parseFloat(form.amount) / n
      const base = new Date(form.date + 'T12:00:00')
      for (let i = 0; i < n; i++) {
        const d = new Date(base); d.setMonth(d.getMonth() + i)
        await fetch('/api/transactions', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            type: form.type, description: form.description,
            amount: perMonth, category: form.category,
            date: d.toISOString().split('T')[0],
            paymentMethod: form.paymentMethod, cardId: form.cardId || null,
            installmentTotal: n, installmentCurrent: i + 1,
            status: form.status,
          })
        })
      }
    } else {
      await fetch('/api/transactions', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          type: form.type, description: form.description,
          amount: parseFloat(form.amount), category: form.category,
          date: form.date, paymentMethod: form.paymentMethod,
          cardId: form.cardId || null, status: form.status,
        })
      })
    }
    await refetch(); setShowModal(false); setForm(EMPTY_FORM)
  })

  const applyRecurring = (r: Recurring) => withSave(async () => {
    await fetch('/api/transactions', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        type: r.type, description: r.description, amount: r.amount,
        category: r.category, paymentMethod: r.paymentMethod,
        date: `${currentYear}-${pad(currentMonth+1)}-${pad(Math.min(r.dayOfMonth,28))}`,
        cardId: r.cardId, status: 'pendente',
      })
    })
    await refetch()
  })

  const toggleRecurring = (r: Recurring) => withSave(async () => {
    await fetch(`/api/recurring/${r.id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ active: !r.active })
    })
    await refetch()
  })

  const addCard = () => withSave(async () => {
    if (!cardForm.name.trim()||!cardForm.limit) return
    await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cardForm)})
    await refetch(); setShowCardModal(false); setCardForm({name:'',limit:'',color:'#6366F1'})
  })

  const addGoal = () => withSave(async () => {
    if (!goalForm.name.trim()||!goalForm.target||!goalForm.deadline) return
    await fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(goalForm)})
    await refetch(); setShowGoalModal(false); setGoalForm(EMPTY_GOAL)
  })

  const addContrib = (goalId: number) => withSave(async () => {
    if (!contribForm.amount) return
    await fetch('/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...contribForm,goalId})})
    await refetch(); setShowContribModal(null); setContribForm(EMPTY_CONTRIB)
  })

  const askDelete = (s: ConfirmState) => setConfirmDelete(s)
  const handleConfirmDelete = () => withSave(async () => {
    if (!confirmDelete) return
    const { type, id } = confirmDelete
    if (type==='transaction')  await fetch(`/api/transactions/${id}`,{method:'DELETE'})
    if (type==='card')         await fetch(`/api/cards/${id}`,{method:'DELETE'})
    if (type==='goal')         await fetch(`/api/goals/${id}`,{method:'DELETE'})
    if (type==='contribution') await fetch(`/api/contributions/${id}`,{method:'DELETE'})
    if (type==='recurring')    await fetch(`/api/recurring/${id}`,{method:'DELETE'})
    await refetch(); setConfirmDelete(null)
    if (type==='goal') setExpandedGoal(null)
  })

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:'#07111F'}}>
      <div style={{fontSize:48}}>₢</div>
      <div style={{fontWeight:800,fontSize:18}}>FinançasFácil</div>
      <div style={{width:40,height:40,border:'3px solid #1E3A5F',borderTop:'3px solid #10B981',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )

  const tabs = [
    {id:'dashboard',icon:'◈',label:'Dashboard'},
    {id:'transactions',icon:'⇅',label:'Lançamentos'},
    {id:'cards',icon:'▣',label:'Cartões'},
    {id:'goals',icon:'🎯',label:'Metas'},
    {id:'report',icon:'⊞',label:'Relatório'},
  ]

  return (
    <>
      <Head>
        <title>FinançasFácil</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          * { box-sizing: border-box; }
          @media (max-width: 480px) {
            .kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
            .hist-chart { height: 140px !important; }
            .two-col { grid-template-columns: 1fr !important; }
            .hide-mobile { display: none !important; }
            .month-label { min-width: 100px !important; font-size: 11px !important; }
          }
        `}</style>
      </Head>
      {saving && <div style={{position:'fixed',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#10B981,#059669)',zIndex:500}}/>}

      {/* HEADER */}
      <div style={{background:'#0A1929',borderBottom:'1px solid #0F2744',padding:'0 16px',display:'flex',alignItems:'center',justifyContent:'space-between',height:52,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:8,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,color:'#fff',flexShrink:0}}>₢</div>
          <div>
            <div style={{fontWeight:800,fontSize:14,letterSpacing:'-0.4px',lineHeight:1}}>FinançasFácil</div>
            <div style={{fontSize:9,color:'#334155',letterSpacing:'0.5px'}} className="hide-mobile">CONTROLE FAMILIAR</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{display:'flex',alignItems:'center',gap:4,background:'#0F2744',borderRadius:8,padding:'5px 10px',border:'1px solid #1E3A5F'}}>
            <button onClick={prevMonth} style={{background:'none',border:'none',color:'#94A3B8',cursor:'pointer',fontSize:16,padding:'0 2px',lineHeight:1}}>‹</button>
            <span style={{fontWeight:700,fontSize:12,minWidth:100,textAlign:'center'}} className="month-label">{MONTHS[currentMonth].slice(0,3)} {currentYear}</span>
            <button onClick={nextMonth} style={{background:'none',border:'none',color:'#94A3B8',cursor:'pointer',fontSize:16,padding:'0 2px',lineHeight:1}}>›</button>
          </div>
          <button onClick={handleLogout} title="Sair" style={{background:'#EF444415',border:'1px solid #EF444430',color:'#EF4444',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>⏻</button>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:'#0A1929',display:'flex',padding:'0 8px',borderBottom:'1px solid #0F274450',overflowX:'auto',gap:0,position:'sticky',top:52,zIndex:99}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',color:activeTab===t.id?'#10B981':'#475569',fontWeight:activeTab===t.id?700:500,fontSize:11,padding:'11px 10px',whiteSpace:'nowrap',borderBottom:`2px solid ${activeTab===t.id?'#10B981':'transparent'}`,display:'flex',alignItems:'center',gap:4,flex:1,justifyContent:'center'}}>
            <span style={{fontSize:13}}>{t.icon}</span>
            <span className="hide-mobile">{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{padding:'16px 12px',maxWidth:860,margin:'0 auto'}}>

        {/* ══ DASHBOARD ══ */}
        {activeTab==='dashboard' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* KPIs — 4 cards em 2x2 */}
            <div className="kpi-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
              {[
                {label:'Saldo Previsto',val:fmt(balance),color:balance>=0?'#10B981':'#EF4444',bg:balance>=0?'#10B98118':'#EF444418',border:balance>=0?'#10B98140':'#EF444440',icon:'💼'},
                {label:'Entradas',val:fmt(totalIncome),color:'#10B981',bg:'#10B98118',border:'#10B98140',icon:'⬆'},
                {label:'Saídas',val:fmt(totalExpense),color:'#EF4444',bg:'#EF444418',border:'#EF444440',icon:'⬇'},
                {label:'Poupança',val:`${savingsRate}%`,color:'#F59E0B',bg:'#F59E0B18',border:'#F59E0B40',icon:'🏦'},
              ].map(k=>(
                <div key={k.label} style={{background:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:'14px 16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{fontSize:9,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.8px',fontWeight:600,marginBottom:6}}>{k.label}</div>
                    <span style={{fontSize:16}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:18,fontWeight:800,color:k.color,fontFamily:"'DM Mono',monospace"}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Status resumo */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[
                {label:'Recebido',val:fmt(paidIncome),color:'#10B981',icon:'✓'},
                {label:'Pago',val:fmt(paidExpense),color:'#3B82F6',icon:'✓'},
                {label:'A pagar',val:fmt(pendingExpense),color:'#F59E0B',icon:'⏳'},
              ].map(s=>(
                <div key={s.label} style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:14,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Metas */}
            {goalsStats.length>0 && (
              <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>🎯 Metas</div>
                  <span style={{fontSize:10,color:'#64748B'}}>{fmt(totalGoalsSaved)} / {fmt(totalGoalsTarget)}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {goalsStats.slice(0,3).map(g=>(
                    <div key={g.id} style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16,flexShrink:0}}>{g.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <span style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.name}</span>
                          <span style={{fontSize:10,color:g.done?'#10B981':'#64748B',flexShrink:0,marginLeft:6}}>{g.pct.toFixed(0)}%{g.done?' ✓':''}</span>
                        </div>
                        <div style={{background:'#07111F',borderRadius:99,height:4}}>
                          <div style={{background:g.done?'#10B981':g.color,borderRadius:99,height:4,width:`${g.pct}%`}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico */}
            <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:'16px 12px'}}>
              <div style={{fontWeight:700,fontSize:11,marginBottom:12,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>📈 Histórico 6 meses</div>
              <div className="hist-chart" style={{height:160}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData} barCategoryGap="35%" barGap={2}>
                    <XAxis dataKey="month" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#334155',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)} width={28}/>
                    <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:'#0F2744',border:'1px solid #1E3A5F',borderRadius:8,color:'#E2E8F0',fontSize:11}} labelStyle={{color:'#94A3B8'}}/>
                    <Bar dataKey="income"  fill="#10B981"   radius={[4,4,0,0]} name="Entradas"/>
                    <Bar dataKey="expense" fill="#EF444480" radius={[4,4,0,0]} name="Saídas"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pizza + Recentes */}
            <div className="two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:14}}>
                <div style={{fontWeight:700,fontSize:11,marginBottom:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>Por Categoria</div>
                {categoryData.length>0?(
                  <>
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart><Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={42} innerRadius={24} paddingAngle={2}>{categoryData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:'#0F2744',border:'1px solid #1E3A5F',borderRadius:8,color:'#E2E8F0',fontSize:10}}/></PieChart>
                    </ResponsiveContainer>
                    <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
                      {categoryData.slice(0,3).map((c,i)=>(
                        <div key={c.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/><span style={{fontSize:10,color:'#94A3B8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:60}}>{c.name}</span></div>
                          <span style={{fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ):<div style={{textAlign:'center',color:'#334155',fontSize:11,padding:16}}>Sem gastos</div>}
              </div>
              <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:14}}>
                <div style={{fontWeight:700,fontSize:11,marginBottom:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>🕐 Recentes</div>
                {monthTx.length===0?<div style={{textAlign:'center',color:'#334155',fontSize:11,padding:16}}>Sem lançamentos</div>:(
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {[...monthTx].reverse().slice(0,5).map(t=>(
                      <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:4}}>
                        <div style={{overflow:'hidden',flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</div>
                          <div style={{fontSize:9,color:'#475569'}}>{t.category}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:t.type==='income'?'#10B981':'#EF4444',fontFamily:"'DM Mono',monospace"}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</div>
                          <div style={{fontSize:9,color:t.status==='pago'?'#10B981':'#F59E0B'}}>{t.status==='pago'?'✓ pago':'⏳ pendente'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {activeTab==='transactions' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <div style={{fontWeight:800,fontSize:15}}>Lançamentos</div>
                <div style={{fontSize:11,color:'#475569'}}>{MONTHS[currentMonth]} {currentYear} · {monthTx.length} registros</div>
              </div>
              <button onClick={()=>setShowModal(true)} style={{background:'linear-gradient(135deg,#10B981,#059669)',color:'#fff',border:'none',borderRadius:9,padding:'9px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>+ Novo</button>
            </div>

            {/* Filtro de status */}
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {(['todos','pago','pendente'] as const).map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'6px 14px',border:`1px solid ${filterStatus===s?'#10B981':'#1E3A5F'}`,borderRadius:20,cursor:'pointer',fontWeight:600,fontSize:11,fontFamily:'inherit',background:filterStatus===s?'#10B98120':'transparent',color:filterStatus===s?'#10B981':'#475569',textTransform:'capitalize'}}>
                  {s==='todos'?'Todos':s==='pago'?'✓ Pagos':'⏳ Pendentes'}
                </button>
              ))}
              <div style={{marginLeft:'auto',fontSize:11,color:'#475569',display:'flex',alignItems:'center',gap:4}}>
                <span style={{color:'#10B981',fontWeight:700}}>{monthTx.filter(t=>t.status==='pago').length}</span> pagos ·
                <span style={{color:'#F59E0B',fontWeight:700}}>{monthTx.filter(t=>t.status==='pendente').length}</span> pendentes
              </div>
            </div>

            {/* Fixos */}
            {recurring.length>0 && (
              <div style={{background:'#0A1929',border:'1px solid #F59E0B30',borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:11,marginBottom:10,color:'#F59E0B',textTransform:'uppercase',letterSpacing:'0.5px'}}>🔄 Lançamentos Fixos</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {recurring.map(r=>{
                    const applied = isApplied(r)
                    return (
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'#07111F',borderRadius:8,border:`1px solid ${r.active?'#1E3A5F':'#1E3A5F40'}`,opacity:r.active?1:0.5}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                            <span style={{fontSize:12,fontWeight:600}}>{r.description}</span>
                            <span style={{fontSize:9,color:'#475569',background:'#1E3A5F',borderRadius:4,padding:'1px 5px'}}>dia {r.dayOfMonth}</span>
                          </div>
                          <div style={{fontSize:10,color:'#475569'}}>{r.category} · {r.paymentMethod}</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:12,color:r.type==='income'?'#10B981':'#EF4444',fontFamily:"'DM Mono',monospace",flexShrink:0}}>{r.type==='income'?'+':'−'}{fmt(r.amount)}</div>
                        {r.active && !applied && (
                          <button onClick={()=>applyRecurring(r)} style={{background:'#10B98120',border:'1px solid #10B98140',color:'#10B981',borderRadius:6,padding:'4px 8px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Aplicar</button>
                        )}
                        {applied && <span style={{fontSize:10,color:'#10B981',flexShrink:0}}>✓</span>}
                        <button onClick={()=>toggleRecurring(r)} style={{background:r.active?'#F59E0B20':'#1E3A5F',border:'none',color:r.active?'#F59E0B':'#475569',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>{r.active?'⏸':'▶'}</button>
                        <button onClick={()=>askDelete({type:'recurring',id:r.id,message:`Excluir o fixo "${r.description}"?`})} style={{background:'#EF444418',border:'none',color:'#EF4444',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista do mês */}
            {filteredMonthTx.length===0?(
              <div style={{textAlign:'center',color:'#334155',padding:'50px 0'}}>
                <div style={{fontSize:36,marginBottom:10}}>📭</div>
                <div style={{fontWeight:600,fontSize:14}}>Nenhum lançamento</div>
                <div style={{fontSize:12,marginTop:4,color:'#475569'}}>
                  {filterStatus!=='todos'?`Nenhum lançamento "${filterStatus}" neste mês`:'Clique em "+ Novo" para começar'}
                </div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {filteredMonthTx.map(t=>{
                  const card = cards.find(c=>c.id===t.cardId)
                  const isPago = t.status === 'pago'
                  return (
                    <div key={t.id} style={{background:'#0A1929',border:`1px solid ${isPago?'#10B98125':'#0F2744'}`,borderRadius:12,padding:'11px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,opacity:isPago?1:0.92}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                        <div style={{background:t.type==='income'?'#10B98125':'#EF444425',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{t.type==='income'?'⬆':'⬇'}</div>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                            <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160}}>{t.description}</span>
                            {t.installmentTotal && t.installmentTotal>1 && (
                              <span style={{fontSize:9,color:'#8B5CF6',background:'#8B5CF620',borderRadius:4,padding:'1px 5px',fontWeight:600,flexShrink:0}}>{t.installmentCurrent}/{t.installmentTotal}</span>
                            )}
                          </div>
                          <div style={{fontSize:10,color:'#475569',marginTop:1}}>
                            {t.category} · {t.date.split('-').reverse().join('/')}
                            {t.paymentMethod==='credit' && card && ` · ${card.name}`}
                          </div>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:800,fontSize:13,color:t.type==='income'?'#10B981':'#EF4444',fontFamily:"'DM Mono',monospace"}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</div>
                        </div>
                        <StatusBadge status={t.status} onClick={()=>toggleStatus(t)}/>
                        <button onClick={()=>askDelete({type:'transaction',id:t.id,message:`Excluir "${t.description}" de ${fmt(t.amount)}?`})} style={{background:'#EF444418',border:'1px solid #EF444430',color:'#EF4444',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ CARDS ══ */}
        {activeTab==='cards' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div><div style={{fontWeight:800,fontSize:15}}>Cartões de Crédito</div><div style={{fontSize:11,color:'#475569'}}>{cards.length} cartão(ões)</div></div>
              <button onClick={()=>setShowCardModal(true)} style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',border:'none',borderRadius:9,padding:'9px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>+ Cartão</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
              {cardSpending.map(card=>{
                const pct=Math.min(card.limit>0?(card.spent/card.limit)*100:0,100)
                return (
                  <div key={card.id} style={{background:`linear-gradient(145deg,${card.color}18,#0A1929)`,border:`1px solid ${card.color}40`,borderRadius:16,padding:18,position:'relative'}}>
                    <button onClick={()=>askDelete({type:'card',id:card.id,message:`Excluir o cartão "${card.name}"?`})} style={{position:'absolute',top:12,right:12,background:'#EF444418',border:'none',color:'#EF4444',borderRadius:6,width:22,height:22,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                      <div style={{background:card.color+'30',borderRadius:10,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>💳</div>
                      <div>
                        <div style={{fontWeight:800,fontSize:15}}>{card.name}</div>
                        <div style={{fontSize:10,color:'#475569'}}>Limite: {fmt(card.limit)}</div>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div style={{background:'#07111F',borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:'#64748B',marginBottom:2,textTransform:'uppercase'}}>Gasto em {MONTHS[currentMonth].slice(0,3)}</div>
                        <div style={{fontSize:18,fontWeight:800,color:card.color,fontFamily:"'DM Mono',monospace"}}>{fmt(card.spent)}</div>
                      </div>
                      <div style={{background:'#07111F',borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:'#64748B',marginBottom:2,textTransform:'uppercase'}}>Disponível</div>
                        <div style={{fontSize:18,fontWeight:800,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>{fmt(Math.max(card.limit-card.spent,0))}</div>
                      </div>
                    </div>
                    <div style={{background:'#07111F',borderRadius:99,height:6}}><div style={{background:pct>80?'#EF4444':card.color,borderRadius:99,height:6,width:`${pct}%`,transition:'width 0.4s ease'}}/></div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
                      <span style={{fontSize:10,color:pct>80?'#EF4444':'#475569'}}>{pct.toFixed(0)}% utilizado</span>
                      {pct>80 && <span style={{fontSize:10,color:'#EF4444',fontWeight:600}}>⚠ Limite alto</span>}
                    </div>
                  </div>
                )
              })}
              {cards.length===0 && <div style={{textAlign:'center',color:'#334155',padding:'40px 0'}}><div style={{fontSize:36,marginBottom:10}}>💳</div><div style={{fontWeight:600}}>Nenhum cartão cadastrado</div></div>}
            </div>
          </div>
        )}

        {/* ══ GOALS ══ */}
        {activeTab==='goals' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div><div style={{fontWeight:800,fontSize:15}}>Metas & Projetos</div><div style={{fontSize:11,color:'#475569'}}>{goalsStats.filter(g=>g.done).length} concluída(s) · {goalsStats.filter(g=>!g.done).length} em andamento</div></div>
              <button onClick={()=>setShowGoalModal(true)} style={{background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#fff',border:'none',borderRadius:9,padding:'9px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>+ Meta</button>
            </div>
            {goalsStats.length>0 && (
              <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:14,marginBottom:14,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
                {[['Guardado',fmt(totalGoalsSaved),'#10B981'],['Total',fmt(totalGoalsTarget),'#E2E8F0'],['Progresso',totalGoalsTarget>0?`${((totalGoalsSaved/totalGoalsTarget)*100).toFixed(0)}%`:'—','#F59E0B']].map(([l,v,c])=>(
                  <div key={l} style={{background:'#07111F',borderRadius:8,padding:'8px 6px'}}>
                    <div style={{fontSize:9,color:'#475569',marginBottom:3,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:800,color:c as string,fontFamily:"'DM Mono',monospace"}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {goalsStats.length===0?(
              <div style={{textAlign:'center',color:'#334155',padding:'50px 0'}}><div style={{fontSize:44,marginBottom:10}}>🎯</div><div style={{fontWeight:600}}>Nenhuma meta ainda</div><div style={{fontSize:12,marginTop:4}}>Clique em "+ Meta" para começar</div></div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {goalsStats.map(g=>{
                  const isExp=expandedGoal===g.id
                  return (
                    <div key={g.id} style={{background:'#0A1929',border:`1px solid ${g.done?'#10B98140':g.color+'40'}`,borderRadius:14,overflow:'hidden'}}>
                      <div style={{padding:16}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:26}}>{g.emoji}</span>
                            <div>
                              <div style={{fontWeight:800,fontSize:14}}>{g.name}</div>
                              <div style={{fontSize:10,color:'#475569'}}>
                                {g.done?<span style={{color:'#10B981',fontWeight:700}}>✓ Concluída!</span>:g.days<=0?<span style={{color:'#EF4444'}}>Prazo encerrado</span>:`${g.days} dias · ${new Date(g.deadline+'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </div>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:5,flexShrink:0}}>
                            <button onClick={()=>setShowContribModal(g.id)} style={{background:g.color+'30',border:`1px solid ${g.color}60`,color:g.color,borderRadius:7,padding:'5px 10px',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Aportar</button>
                            <button onClick={()=>askDelete({type:'goal',id:g.id,message:`Excluir a meta "${g.name}"?`})} style={{background:'#EF444418',border:'none',color:'#EF4444',borderRadius:6,width:26,height:26,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                          </div>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{fontSize:11,color:'#94A3B8'}}>{fmt(g.saved)} guardados</span>
                          <span style={{fontSize:11,fontWeight:700,color:g.done?'#10B981':g.color}}>{g.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{background:'#07111F',borderRadius:99,height:7,marginBottom:5}}>
                          <div style={{background:g.done?'linear-gradient(90deg,#10B981,#059669)':`linear-gradient(90deg,${g.color},${g.color}99)`,borderRadius:99,height:7,width:`${g.pct}%`,transition:'width 0.5s ease'}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                          <span style={{fontSize:10,color:'#475569'}}>Meta: {fmt(g.target)}</span>
                          {!g.done&&<span style={{fontSize:10,color:'#F59E0B'}}>Guardar {fmt(g.needed)}/mês</span>}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                          {[{label:'Falta',val:g.done?'—':fmt(Math.max(g.target-g.saved,0)),color:'#EF4444'},{label:'Aportes',val:String(g.contributions.length),color:'#94A3B8'},{label:'/mês',val:g.done?'✓':fmt(g.needed),color:'#F59E0B'}].map(s=>(
                            <div key={s.label} style={{background:'#07111F',borderRadius:7,padding:'7px 8px',textAlign:'center'}}>
                              <div style={{fontSize:9,color:'#475569',marginBottom:2,textTransform:'uppercase'}}>{s.label}</div>
                              <div style={{fontSize:11,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        {g.contributions.length>0&&<button onClick={()=>setExpandedGoal(isExp?null:g.id)} style={{background:'none',border:'none',color:'#64748B',cursor:'pointer',fontSize:11,marginTop:10,padding:0,fontFamily:'inherit',display:'flex',alignItems:'center',gap:3}}>{isExp?'▲ Fechar':'▼ Ver'} aportes ({g.contributions.length})</button>}
                      </div>
                      {isExp&&(
                        <div style={{borderTop:'1px solid #0F2744',padding:'10px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {[...g.contributions].reverse().map(c=>(
                            <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #07111F'}}>
                              <div>
                                <div style={{fontSize:12,fontWeight:600,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>+{fmt(c.amount)}</div>
                                <div style={{fontSize:10,color:'#475569'}}>{c.date.split('-').reverse().join('/')} {c.note&&`· ${c.note}`}</div>
                              </div>
                              <button onClick={()=>askDelete({type:'contribution',id:c.id,message:`Excluir aporte de ${fmt(c.amount)}?`,extra:g.id})} style={{background:'#EF444418',border:'none',color:'#EF4444',borderRadius:6,width:22,height:22,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ REPORT ══ */}
        {activeTab==='report' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:2}}>Relatório — {MONTHS[currentMonth]} {currentYear}</div>

            <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:11,marginBottom:12,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>📊 Resumo do Mês</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center',marginBottom:10}}>
                {[['Entradas',fmt(totalIncome),'#10B981'],['Saídas',fmt(totalExpense),'#EF4444'],['Saldo',fmt(balance),balance>=0?'#10B981':'#EF4444']].map(([l,v,c])=>(
                  <div key={l} style={{background:'#07111F',borderRadius:8,padding:'10px 6px'}}><div style={{fontSize:9,color:'#475569',marginBottom:4,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:c as string,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
                {[['Recebido',fmt(paidIncome),'#10B981'],['Pago',fmt(paidExpense),'#3B82F6'],['A pagar',fmt(pendingExpense),'#F59E0B']].map(([l,v,c])=>(
                  <div key={l} style={{background:'#07111F',borderRadius:8,padding:'10px 6px'}}><div style={{fontSize:9,color:'#475569',marginBottom:4,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:c as string,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
              <div style={{marginTop:10,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:'#07111F',borderRadius:8,padding:'9px 12px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:11,color:'#64748B'}}>Taxa de poupança</span><span style={{fontSize:11,fontWeight:700,color:'#F59E0B'}}>{savingsRate}%</span></div>
                <div style={{background:'#07111F',borderRadius:8,padding:'9px 12px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:11,color:'#64748B'}}>Lançamentos</span><span style={{fontSize:11,fontWeight:700}}>{monthTx.length}</span></div>
              </div>
            </div>

            <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:11,marginBottom:12,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>🗂️ Gastos por Categoria</div>
              {categoryData.length===0?<div style={{textAlign:'center',color:'#334155',fontSize:12,padding:16}}>Sem dados</div>:categoryData.map((c,i)=>(
                <div key={c.name} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:7,height:7,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length]}}/><span style={{fontSize:12}}>{c.name}</span></div>
                    <div style={{display:'flex',gap:8}}><span style={{fontSize:11,color:'#64748B'}}>{totalExpense>0?((c.value/totalExpense)*100).toFixed(0):0}%</span><span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(c.value)}</span></div>
                  </div>
                  <div style={{background:'#07111F',borderRadius:99,height:4}}><div style={{background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99,height:4,width:`${totalExpense>0?(c.value/totalExpense)*100:0}%`}}/></div>
                </div>
              ))}
            </div>

            <div style={{background:'#0A1929',border:'1px solid #0F2744',borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:11,marginBottom:12,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.5px'}}>💳 Por Forma de Pagamento</div>
              {[['credit','Cartão','#8B5CF6'],['pix','PIX','#10B981'],['débito','Débito','#3B82F6'],['dinheiro','Dinheiro','#F59E0B']].map(([pm,label,color])=>{
                const total=monthTx.filter(t=>t.paymentMethod===pm&&t.type==='expense').reduce((s,t)=>s+t.amount,0)
                if(!total) return null
                return (
                  <div key={pm} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #07111F'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:7,height:7,borderRadius:'50%',background:color as string}}/><span style={{fontSize:12,color:'#94A3B8'}}>{label}</span></div>
                    <span style={{fontWeight:700,fontSize:12,fontFamily:"'DM Mono',monospace"}}>{fmt(total)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL: NOVO LANÇAMENTO ══ */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'#000000B0',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}} onClick={()=>setShowModal(false)}>
          <div style={{background:'#0A1929',borderRadius:'18px 18px 0 0',padding:'22px 18px 30px',width:'100%',maxWidth:480,border:'1px solid #0F2744',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>Novo Lançamento</div>
            <div style={{display:'flex',background:'#07111F',borderRadius:9,padding:3,marginBottom:12,gap:3}}>
              {[['expense','⬇ Saída','#EF4444'],['income','⬆ Entrada','#10B981']].map(([type,label,color])=>(
                <button key={type} onClick={()=>setForm(f=>({...f,type,category:type==='income'?'Salário':'Outros'}))} style={{flex:1,padding:'8px 0',border:'none',borderRadius:7,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'inherit',background:form.type===type?color+'30':'transparent',color:form.type===type?color as string:'#475569',borderBottom:`2px solid ${form.type===type?color:'transparent'}`}}>{label}</button>
              ))}
            </div>
            <div style={{display:'flex',gap:5,marginBottom:14}}>
              {[['unico','Único','#10B981'],['parcelado','Parcelado','#8B5CF6'],['fixo','Fixo Mensal','#F59E0B']].map(([mode,label,color])=>(
                <button key={mode} onClick={()=>setForm(f=>({...f,mode}))} style={{flex:1,padding:'6px 3px',border:`1px solid ${form.mode===mode?color:'#1E3A5F'}`,borderRadius:7,cursor:'pointer',fontWeight:600,fontSize:10,fontFamily:'inherit',background:form.mode===mode?color+'20':'transparent',color:form.mode===mode?color as string:'#475569',whiteSpace:'nowrap'}}>{label}</button>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={LS}>Descrição</label><input type="text" placeholder={form.mode==='fixo'?'Ex: Salário, Aluguel...':'Ex: Mercado, Netflix...'} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={IS}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={LS}>{form.mode==='parcelado'?'Valor Total':'Valor (R$)'}</label><input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} style={IS}/></div>
                {form.mode==='fixo'?(
                  <div><label style={LS}>Dia do mês</label><input type="number" placeholder="5" min="1" max="28" value={form.dayOfMonth} onChange={e=>setForm(p=>({...p,dayOfMonth:e.target.value}))} style={IS}/></div>
                ):(
                  <div><label style={LS}>{form.mode==='parcelado'?'Data 1ª parcela':'Data'}</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={IS}/></div>
                )}
              </div>
              {form.mode==='parcelado' && (
                <div>
                  <label style={LS}>Parcelas</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['2','3','4','6','10','12','18','24','36','48'].map(n=>(
                      <button key={n} onClick={()=>setForm(p=>({...p,installments:n}))} style={{padding:'6px 12px',border:`1px solid ${form.installments===n?'#8B5CF6':'#1E3A5F'}`,borderRadius:7,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:form.installments===n?'#8B5CF620':'transparent',color:form.installments===n?'#8B5CF6':'#64748B'}}>{n}x</button>
                    ))}
                  </div>
                  {form.amount && parseInt(form.installments)>1 && (
                    <div style={{marginTop:7,fontSize:11,color:'#8B5CF6',background:'#8B5CF610',borderRadius:7,padding:'7px 10px'}}>
                      {form.installments}x de {fmt(parseFloat(form.amount)/parseInt(form.installments))} = {fmt(parseFloat(form.amount))}
                    </div>
                  )}
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={LS}>Categoria</label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={IS}>{(form.type==='income'?CATEGORIES_INCOME:CATEGORIES_EXPENSE).map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={LS}>Pagamento</label><select value={form.paymentMethod} onChange={e=>setForm(p=>({...p,paymentMethod:e.target.value,cardId:''}))} style={IS}><option value="pix">PIX</option><option value="credit">Cartão Crédito</option><option value="débito">Débito</option><option value="dinheiro">Dinheiro</option></select></div>
              </div>
              {form.paymentMethod==='credit' && (
                <div><label style={LS}>Qual Cartão?</label><select value={form.cardId} onChange={e=>setForm(p=>({...p,cardId:e.target.value}))} style={IS}><option value="">Selecionar...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              )}
              {form.mode !== 'fixo' && (
                <div>
                  <label style={LS}>Status inicial</label>
                  <div style={{display:'flex',gap:8}}>
                    {[['pendente','⏳ Pendente','#F59E0B'],['pago','✓ Pago','#10B981']].map(([s,l,c])=>(
                      <button key={s} onClick={()=>setForm(p=>({...p,status:s}))} style={{flex:1,padding:'8px 0',border:`1px solid ${form.status===s?c:'#1E3A5F'}`,borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:form.status===s?c+'20':'transparent',color:form.status===s?c as string:'#475569'}}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <button onClick={()=>setShowModal(false)} style={{flex:1,padding:12,background:'#07111F',border:'1px solid #0F2744',borderRadius:9,color:'#64748B',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={addTransaction} style={{flex:2,padding:12,border:'none',borderRadius:9,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:13,background:form.mode==='fixo'?'linear-gradient(135deg,#F59E0B,#D97706)':form.mode==='parcelado'?'linear-gradient(135deg,#8B5CF6,#7C3AED)':form.type==='income'?'linear-gradient(135deg,#10B981,#059669)':'linear-gradient(135deg,#EF4444,#DC2626)'}}>
                {form.mode==='fixo'?'Salvar como Fixo 🔄':form.mode==='parcelado'?`Parcelar em ${form.installments}x 💳`:'Salvar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOVO CARTÃO ══ */}
      {showCardModal && (
        <div style={{position:'fixed',inset:0,background:'#000000B0',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}} onClick={()=>setShowCardModal(false)}>
          <div style={{background:'#0A1929',borderRadius:'18px 18px 0 0',padding:'22px 18px 30px',width:'100%',maxWidth:480,border:'1px solid #0F2744'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>Novo Cartão</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={LS}>Nome</label><input type="text" placeholder="Ex: Nubank, Itaú..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))} style={IS}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={LS}>Limite (R$)</label><input type="number" placeholder="5000" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))} style={IS}/></div>
                <div><label style={LS}>Cor</label><input type="color" value={cardForm.color} onChange={e=>setCardForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:4,height:42,cursor:'pointer'}}/></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <button onClick={()=>setShowCardModal(false)} style={{flex:1,padding:12,background:'#07111F',border:'1px solid #0F2744',borderRadius:9,color:'#64748B',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={addCard} style={{flex:2,padding:12,background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',border:'none',borderRadius:9,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Salvar Cartão</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOVA META ══ */}
      {showGoalModal && (
        <div style={{position:'fixed',inset:0,background:'#000000B0',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}} onClick={()=>setShowGoalModal(false)}>
          <div style={{background:'#0A1929',borderRadius:'18px 18px 0 0',padding:'22px 18px 30px',width:'100%',maxWidth:480,border:'1px solid #0F2744',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Nova Meta / Projeto</div>
            <div style={{fontSize:11,color:'#475569',marginBottom:14}}>Ex: Compra do carro, viagem...</div>
            <label style={LS}>Ícone</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14,background:'#07111F',borderRadius:9,padding:8}}>
              {EMOJIS.map(e=><button key={e} onClick={()=>setGoalForm(p=>({...p,emoji:e}))} style={{fontSize:18,background:goalForm.emoji===e?'#F59E0B30':'none',border:`1px solid ${goalForm.emoji===e?'#F59E0B':'transparent'}`,borderRadius:7,width:34,height:34,cursor:'pointer'}}>{e}</button>)}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={LS}>Nome</label><input type="text" placeholder="Ex: Compra do Carro" value={goalForm.name} onChange={e=>setGoalForm(p=>({...p,name:e.target.value}))} style={IS}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={LS}>Valor Alvo (R$)</label><input type="number" placeholder="30000" value={goalForm.target} onChange={e=>setGoalForm(p=>({...p,target:e.target.value}))} style={IS}/></div>
                <div><label style={LS}>Prazo</label><input type="date" value={goalForm.deadline} onChange={e=>setGoalForm(p=>({...p,deadline:e.target.value}))} style={IS}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={LS}>Cor</label><input type="color" value={goalForm.color} onChange={e=>setGoalForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:4,height:42,cursor:'pointer'}}/></div>
                <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                  <div style={{background:goalForm.color+'20',border:`1px solid ${goalForm.color}50`,borderRadius:8,padding:'9px 10px',display:'flex',alignItems:'center',gap:7}}>
                    <span style={{fontSize:20}}>{goalForm.emoji}</span>
                    <span style={{fontSize:11,fontWeight:700,color:goalForm.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{goalForm.name||'Prévia'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <button onClick={()=>setShowGoalModal(false)} style={{flex:1,padding:12,background:'#07111F',border:'1px solid #0F2744',borderRadius:9,color:'#64748B',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={addGoal} style={{flex:2,padding:12,background:'linear-gradient(135deg,#F59E0B,#D97706)',border:'none',borderRadius:9,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Criar Meta 🎯</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: APORTE ══ */}
      {showContribModal!==null&&(()=>{
        const goal=goals.find(g=>g.id===showContribModal); if(!goal) return null
        const saved=goal.contributions.reduce((s,c)=>s+c.amount,0)
        return (
          <div style={{position:'fixed',inset:0,background:'#000000B0',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}} onClick={()=>setShowContribModal(null)}>
            <div style={{background:'#0A1929',borderRadius:'18px 18px 0 0',padding:'22px 18px 30px',width:'100%',maxWidth:480,border:`1px solid ${goal.color}40`}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontSize:26}}>{goal.emoji}</span>
                <div><div style={{fontWeight:800,fontSize:15}}>Adicionar Aporte</div><div style={{fontSize:11,color:'#475569'}}>{goal.name}</div></div>
              </div>
              <div style={{background:'#07111F',borderRadius:99,height:4,margin:'12px 0 3px'}}><div style={{background:goal.color,borderRadius:99,height:4,width:`${Math.min(goal.target>0?(saved/goal.target)*100:0,100)}%`}}/></div>
              <div style={{fontSize:10,color:'#64748B',marginBottom:16}}>{fmt(saved)} de {fmt(goal.target)}</div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div><label style={LS}>Valor (R$)</label><input type="number" placeholder="500" value={contribForm.amount} onChange={e=>setContribForm(p=>({...p,amount:e.target.value}))} style={IS}/></div>
                <div><label style={LS}>Data</label><input type="date" value={contribForm.date} onChange={e=>setContribForm(p=>({...p,date:e.target.value}))} style={IS}/></div>
                <div><label style={LS}>Observação (opcional)</label><input type="text" placeholder="Ex: Guardei do bônus..." value={contribForm.note} onChange={e=>setContribForm(p=>({...p,note:e.target.value}))} style={IS}/></div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:18}}>
                <button onClick={()=>setShowContribModal(null)} style={{flex:1,padding:12,background:'#07111F',border:'1px solid #0F2744',borderRadius:9,color:'#64748B',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
                <button onClick={()=>addContrib(goal.id)} style={{flex:2,padding:12,background:`linear-gradient(135deg,${goal.color},${goal.color}CC)`,border:'none',borderRadius:9,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Confirmar Aporte 💰</button>
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmDialog state={confirmDelete} onConfirm={handleConfirmDelete} onCancel={()=>setConfirmDelete(null)}/>
    </>
  )
}