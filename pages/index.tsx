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

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:     '#080F1A',
  surface:'#0D1B2A',
  card:   '#111E2E',
  border: '#162236',
  border2:'#1E3A5F',
  text:   '#E2E8F0',
  muted:  '#475569',
  faint:  '#1E3A5F',
  green:  '#10B981',
  red:    '#EF4444',
  yellow: '#F59E0B',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
}

const IS: React.CSSProperties = {
  width:'100%', background:C.bg, border:`1px solid ${C.border2}`,
  borderRadius:10, padding:'11px 14px', color:C.text,
  fontSize:14, fontFamily:'inherit', outline:'none',
}
const LS: React.CSSProperties = {
  fontSize:10, color:C.muted, display:'block', marginBottom:6,
  textTransform:'uppercase', letterSpacing:'1px', fontWeight:600,
}

// ── Micro components ───────────────────────────────────────────────────────
const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span style={{ fontSize:9, fontWeight:700, color, background:color+'18', borderRadius:4, padding:'2px 6px', letterSpacing:'0.3px' }}>{children}</span>
)

const StatusBadge = ({ status, onClick }: { status: string; onClick: () => void }) => (
  <button onClick={onClick} style={{
    background:'transparent', border:`1px solid ${status==='pago'?C.green+'50':C.yellow+'40'}`,
    color:status==='pago'?C.green:C.yellow,
    borderRadius:6, padding:'3px 8px', fontSize:10, fontWeight:700,
    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
  }}>
    {status==='pago'?'✓ pago':'⏳ pendente'}
  </button>
)

const IconBtn = ({ onClick, danger, children }: { onClick:()=>void; danger?:boolean; children:React.ReactNode }) => (
  <button onClick={onClick} style={{
    background:danger?`${C.red}12`:'transparent',
    border:`1px solid ${danger?C.red+'30':C.border}`,
    color:danger?C.red:C.muted,
    borderRadius:7, width:28, height:28, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:13, flexShrink:0,
  }}>{children}</button>
)

function ConfirmDialog({ state, onConfirm, onCancel }: { state:ConfirmState|null; onConfirm:()=>void; onCancel:()=>void }) {
  if (!state) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'#000C', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.red}30`, borderRadius:20, padding:'28px 24px', maxWidth:320, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🗑️</div>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Excluir item?</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:24, lineHeight:1.6 }}>{state.message}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onCancel} style={{ flex:1, padding:11, background:'transparent', border:`1px solid ${C.border}`, borderRadius:10, color:C.muted, fontWeight:600, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex:1, padding:11, background:C.red, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
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
  const [editingTx,        setEditingTx]        = useState<Transaction|null>(null)
  const [expandedGoal,     setExpandedGoal]     = useState<number|null>(null)
  const [confirmDelete,    setConfirmDelete]    = useState<ConfirmState|null>(null)

  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editForm,    setEditForm]    = useState({ type:'expense', description:'', amount:'', category:'Outros', date:today(), paymentMethod:'pix', cardId:'', status:'pendente' })
  const [cardForm,    setCardForm]    = useState({ name:'', limit:'', color:'#6366F1' })
  const [goalForm,    setGoalForm]    = useState(EMPTY_GOAL)
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB)

  useEffect(() => {
    if (localStorage.getItem('ff_auth') !== 'ok') window.location.replace('/login')
    else setAuthed(true)
  }, [])

  const handleLogout = () => { localStorage.removeItem('ff_auth'); window.location.replace('/login') }

  const refetch = useCallback(async () => {
    const [txs, cds, gls, rec] = await Promise.all([
      fetch('/api/transactions').then(r=>r.json()),
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/goals').then(r=>r.json()),
      fetch('/api/recurring').then(r=>r.json()),
    ])
    setTransactions(Array.isArray(txs)?txs:[])
    setCards(Array.isArray(cds)?cds:[])
    setGoals(Array.isArray(gls)?gls:[])
    setRecurring(Array.isArray(rec)?rec:[])
  }, [])

  useEffect(() => { if (!authed) return; refetch().finally(()=>setLoading(false)) }, [authed, refetch])

  const prevMonth = () => { let m=currentMonth-1,y=currentYear; if(m<0){m=11;y--} setCurrentMonth(m);setCurrentYear(y) }
  const nextMonth = () => { let m=currentMonth+1,y=currentYear; if(m>11){m=0;y++} setCurrentMonth(m);setCurrentYear(y) }

  const monthTx = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date+'T12:00:00')
    return d.getMonth()===currentMonth && d.getFullYear()===currentYear
  }), [transactions, currentMonth, currentYear])

  const isApplied = (r: Recurring) => monthTx.some(t =>
    t.description===r.description && Math.abs(t.amount-r.amount)<0.01 && t.type===r.type
  )

  const recurringVirtual = useMemo(() => recurring.filter(r=>r.active&&!isApplied(r)).map(r=>({
    id:-(r.id), type:r.type, description:r.description, amount:r.amount,
    category:r.category, date:`${currentYear}-${pad(currentMonth+1)}-${pad(Math.min(r.dayOfMonth,28))}`,
    paymentMethod:r.paymentMethod, cardId:r.cardId, status:'pendente',
  })), [recurring, currentMonth, currentYear, monthTx])

  const allMonthItems = useMemo(()=>[...monthTx,...recurringVirtual],[monthTx,recurringVirtual])

  const totalIncome    = useMemo(()=>allMonthItems.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),[allMonthItems])
  const totalExpense   = useMemo(()=>allMonthItems.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),[allMonthItems])
  const balance        = totalIncome - totalExpense
  const savingsRate    = totalIncome>0?((balance/totalIncome)*100).toFixed(1):'0.0'
  const paidIncome     = useMemo(()=>monthTx.filter(t=>t.type==='income'&&t.status==='pago').reduce((s,t)=>s+t.amount,0),[monthTx])
  const paidExpense    = useMemo(()=>monthTx.filter(t=>t.type==='expense'&&t.status==='pago').reduce((s,t)=>s+t.amount,0),[monthTx])
  const pendingExpense = useMemo(()=>allMonthItems.filter(t=>t.type==='expense'&&t.status==='pendente').reduce((s,t)=>s+t.amount,0),[allMonthItems])

  const categoryData = useMemo(()=>{
    const m:Record<string,number>={}
    allMonthItems.filter(t=>t.type==='expense').forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount})
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  },[allMonthItems])

  const historyData = useMemo(()=>Array.from({length:6},(_,i)=>{
    let m=currentMonth-5+i,y=currentYear; while(m<0){m+=12;y--}
    const ts=transactions.filter(t=>{const d=new Date(t.date+'T12:00:00');return d.getMonth()===m&&d.getFullYear()===y})
    return{month:MONTHS[m].slice(0,3),income:ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense:ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)}
  }),[transactions,currentMonth,currentYear])

  const cardSpending = useMemo(()=>cards.map(c=>({...c,spent:monthTx.filter(t=>t.paymentMethod==='credit'&&t.cardId===c.id).reduce((s,t)=>s+t.amount,0)})),[cards,monthTx])

  const goalsStats = useMemo(()=>goals.map(g=>{
    const saved=g.contributions.reduce((s,c)=>s+c.amount,0)
    const pct=Math.min(g.target>0?(saved/g.target)*100:0,100)
    const days=daysUntil(g.deadline);const months=monthsUntil(g.deadline)
    return{...g,saved,pct,days,months,needed:Math.max(0,(g.target-saved)/months),done:saved>=g.target}
  }),[goals])

  const totalGoalsSaved  = useMemo(()=>goalsStats.reduce((s,g)=>s+g.saved,0),[goalsStats])
  const totalGoalsTarget = useMemo(()=>goalsStats.reduce((s,g)=>s+g.target,0),[goalsStats])

  const filteredMonthTx = useMemo(()=>{
    if(filterStatus==='todos') return [...monthTx].reverse()
    return [...monthTx].filter(t=>t.status===filterStatus).reverse()
  },[monthTx,filterStatus])

  const withSave = async (fn:()=>Promise<void>) => { setSaving(true); try{await fn()}finally{setSaving(false)} }

  const openEdit = (t: Transaction) => {
    setEditForm({
      type:t.type, description:t.description, amount:String(t.amount),
      category:t.category, date:t.date, paymentMethod:t.paymentMethod,
      cardId:t.cardId?String(t.cardId):'', status:t.status,
    })
    setEditingTx(t)
  }

  const saveEdit = () => withSave(async () => {
    if (!editingTx||!editForm.description.trim()||!editForm.amount) return
    await fetch(`/api/transactions/${editingTx.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(editForm),
    })
    await refetch(); setEditingTx(null)
  })

  const toggleStatus = (t:Transaction) => withSave(async()=>{
    await fetch(`/api/transactions/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:t.status==='pago'?'pendente':'pago'})})
    await refetch()
  })

  const addTransaction = () => withSave(async()=>{
    if(!form.description.trim()||!form.amount) return
    if(form.mode==='fixo'){
      await fetch('/api/recurring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:parseFloat(form.amount),category:form.category,paymentMethod:form.paymentMethod,cardId:form.cardId||null,dayOfMonth:parseInt(form.dayOfMonth)||5})})
    } else if(form.mode==='parcelado'){
      const n=Math.max(2,parseInt(form.installments)||2)
      const perMonth=parseFloat(form.amount)/n
      const base=new Date(form.date+'T12:00:00')
      for(let i=0;i<n;i++){
        const d=new Date(base);d.setMonth(d.getMonth()+i)
        await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:perMonth,category:form.category,date:d.toISOString().split('T')[0],paymentMethod:form.paymentMethod,cardId:form.cardId||null,installmentTotal:n,installmentCurrent:i+1,status:form.status})})
      }
    } else {
      await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:parseFloat(form.amount),category:form.category,date:form.date,paymentMethod:form.paymentMethod,cardId:form.cardId||null,status:form.status})})
    }
    await refetch();setShowModal(false);setForm(EMPTY_FORM)
  })

  const applyRecurring = (r:Recurring) => withSave(async()=>{
    await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:r.type,description:r.description,amount:r.amount,category:r.category,paymentMethod:r.paymentMethod,date:`${currentYear}-${pad(currentMonth+1)}-${pad(Math.min(r.dayOfMonth,28))}`,cardId:r.cardId,status:'pendente'})})
    await refetch()
  })

  const toggleRecurring = (r:Recurring) => withSave(async()=>{
    await fetch(`/api/recurring/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!r.active})})
    await refetch()
  })

  const addCard = () => withSave(async()=>{
    if(!cardForm.name.trim()||!cardForm.limit) return
    await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cardForm)})
    await refetch();setShowCardModal(false);setCardForm({name:'',limit:'',color:'#6366F1'})
  })

  const addGoal = () => withSave(async()=>{
    if(!goalForm.name.trim()||!goalForm.target||!goalForm.deadline) return
    await fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(goalForm)})
    await refetch();setShowGoalModal(false);setGoalForm(EMPTY_GOAL)
  })

  const addContrib = (goalId:number) => withSave(async()=>{
    if(!contribForm.amount) return
    await fetch('/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...contribForm,goalId})})
    await refetch();setShowContribModal(null);setContribForm(EMPTY_CONTRIB)
  })

  const askDelete = (s:ConfirmState) => setConfirmDelete(s)
  const handleConfirmDelete = () => withSave(async()=>{
    if(!confirmDelete) return
    const{type,id}=confirmDelete
    if(type==='transaction')  await fetch(`/api/transactions/${id}`,{method:'DELETE'})
    if(type==='card')         await fetch(`/api/cards/${id}`,{method:'DELETE'})
    if(type==='goal')         await fetch(`/api/goals/${id}`,{method:'DELETE'})
    if(type==='contribution') await fetch(`/api/contributions/${id}`,{method:'DELETE'})
    if(type==='recurring')    await fetch(`/api/recurring/${id}`,{method:'DELETE'})
    await refetch();setConfirmDelete(null)
    if(type==='goal') setExpandedGoal(null)
  })

  if(loading) return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,background:C.bg}}>
      <div style={{fontSize:40,fontWeight:800,color:C.green}}>₢</div>
      <div style={{fontWeight:700,fontSize:16,color:C.text}}>FinançasFácil</div>
      <div style={{width:32,height:32,border:`2px solid ${C.border2}`,borderTop:`2px solid ${C.green}`,borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
    </div>
  )

  const tabs=[
    {id:'dashboard',icon:'⊡',label:'Início'},
    {id:'transactions',icon:'↕',label:'Lançamentos'},
    {id:'cards',icon:'▭',label:'Cartões'},
    {id:'goals',icon:'◎',label:'Metas'},
    {id:'report',icon:'≡',label:'Relatório'},
  ]

  // ── shared modal backdrop ──
  const Backdrop = ({onClose,children}:{onClose:()=>void;children:React.ReactNode}) => (
    <div style={{position:'fixed',inset:0,background:'#000A',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}} onClick={onClose}>
      <div style={{background:C.surface,borderRadius:'20px 20px 0 0',padding:'20px 18px 32px',width:'100%',maxWidth:480,maxHeight:'93vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )

  const ModalTitle = ({children}:{children:React.ReactNode}) => (
    <div style={{fontWeight:700,fontSize:16,marginBottom:18,color:C.text}}>{children}</div>
  )

  const Field = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div><label style={LS}>{label}</label>{children}</div>
  )

  const Row = ({children}:{children:React.ReactNode}) => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{children}</div>
  )

  const SegControl = ({options,value,onChange}:{options:[string,string,string][];value:string;onChange:(v:string)=>void}) => (
    <div style={{display:'flex',background:C.bg,borderRadius:10,padding:3,gap:2,marginBottom:14}}>
      {options.map(([v,l,color])=>(
        <button key={v} onClick={()=>onChange(v)} style={{flex:1,padding:'8px 4px',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:11,fontFamily:'inherit',background:value===v?color+'25':'transparent',color:value===v?color:C.muted,transition:'all 0.15s'}}>{l}</button>
      ))}
    </div>
  )

  const Btn = ({onClick,children,variant='primary',color}:{onClick:()=>void;children:React.ReactNode;variant?:string;color?:string}) => (
    <button onClick={onClick} style={{
      flex:variant==='ghost'?1:2, padding:'12px 0', border:variant==='ghost'?`1px solid ${C.border}`:'none',
      borderRadius:10, color:variant==='ghost'?C.muted:'#fff',
      background:variant==='ghost'?'transparent':color||C.green,
      fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13,
    }}>{children}</button>
  )

  return (
    <>
      <Head>
        <title>FinançasFácil</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <style>{`
          @keyframes spin{to{transform:rotate(360deg)}}
          *{box-sizing:border-box}
          body{background:${C.bg};margin:0}
          input::placeholder{color:${C.faint}}
          select option{background:${C.surface}}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:99px}
          @media(max-width:480px){
            .g2{grid-template-columns:1fr 1fr!important}
            .g1{grid-template-columns:1fr!important}
            .hm{display:none!important}
          }
        `}</style>
      </Head>

      {saving&&<div style={{position:'fixed',top:0,left:0,right:0,height:2,background:C.green,zIndex:600,opacity:0.9}}/>}

      {/* ── HEADER ── */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',justifyContent:'space-between',height:50,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{background:C.green,borderRadius:8,width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:12,color:'#fff'}}>₢</div>
          <span style={{fontWeight:700,fontSize:14,letterSpacing:'-0.3px'}}>FinançasFácil</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{display:'flex',alignItems:'center',gap:2,background:C.bg,borderRadius:8,padding:'4px 8px',border:`1px solid ${C.border}`}}>
            <button onClick={prevMonth} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:15,padding:'0 3px',lineHeight:1}}>‹</button>
            <span style={{fontWeight:600,fontSize:11,minWidth:90,textAlign:'center',color:C.text}}>{MONTHS[currentMonth].slice(0,3)} {currentYear}</span>
            <button onClick={nextMonth} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:15,padding:'0 3px',lineHeight:1}}>›</button>
          </div>
          <IconBtn onClick={handleLogout} danger>⏻</IconBtn>
        </div>
      </header>

      {/* ── NAV ── */}
      <nav style={{background:C.surface,display:'flex',borderBottom:`1px solid ${C.border}`,position:'sticky',top:50,zIndex:99}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            flex:1,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
            color:activeTab===t.id?C.green:C.muted,
            fontWeight:activeTab===t.id?700:400,
            fontSize:10,padding:'10px 4px',
            borderBottom:`2px solid ${activeTab===t.id?C.green:'transparent'}`,
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'color 0.15s',
          }}>
            <span style={{fontSize:15}}>{t.icon}</span>
            <span className="hm" style={{fontSize:9,letterSpacing:'0.3px'}}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <main style={{padding:'14px 12px',maxWidth:600,margin:'0 auto'}}>

        {/* ════ DASHBOARD ════ */}
        {activeTab==='dashboard'&&(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* KPIs */}
            <div className="g2" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {[
                {label:'Saldo',val:fmt(balance),color:balance>=0?C.green:C.red},
                {label:'Entradas',val:fmt(totalIncome),color:C.green},
                {label:'Saídas',val:fmt(totalExpense),color:C.red},
                {label:'Poupança',val:`${savingsRate}%`,color:C.yellow},
              ].map(k=>(
                <div key={k.label} style={{background:C.card,borderRadius:12,padding:'14px 14px'}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'1px',fontWeight:600,marginBottom:6}}>{k.label}</div>
                  <div style={{fontSize:17,fontWeight:800,color:k.color,fontFamily:"'DM Mono',monospace",letterSpacing:'-0.5px'}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Status */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {[{label:'Recebido',val:fmt(paidIncome),color:C.green},{label:'Pago',val:fmt(paidExpense),color:C.blue},{label:'A pagar',val:fmt(pendingExpense),color:C.yellow}].map(s=>(
                <div key={s.label} style={{background:C.card,borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                  <div style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:12,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Metas preview */}
            {goalsStats.length>0&&(
              <div style={{background:C.card,borderRadius:12,padding:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.muted}}>METAS</span>
                  <span style={{fontSize:10,color:C.muted}}>{fmt(totalGoalsSaved)} / {fmt(totalGoalsTarget)}</span>
                </div>
                {goalsStats.slice(0,3).map(g=>(
                  <div key={g.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <span style={{fontSize:15,flexShrink:0}}>{g.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.name}</span>
                        <span style={{fontSize:10,color:g.done?C.green:C.muted,flexShrink:0,marginLeft:6}}>{g.pct.toFixed(0)}%</span>
                      </div>
                      <div style={{background:C.bg,borderRadius:99,height:3}}>
                        <div style={{background:g.done?C.green:g.color,borderRadius:99,height:3,width:`${g.pct}%`,transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Histórico */}
            <div style={{background:C.card,borderRadius:12,padding:'14px 10px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:12}}>HISTÓRICO 6 MESES</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={historyData} barCategoryGap="35%" barGap={2}>
                  <XAxis dataKey="month" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.faint,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)} width={26}/>
                  <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:11}} labelStyle={{color:C.muted}}/>
                  <Bar dataKey="income"  fill={C.green}     radius={[3,3,0,0]} name="Entradas"/>
                  <Bar dataKey="expense" fill={C.red+'60'}  radius={[3,3,0,0]} name="Saídas"/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Categoria + Recentes */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:C.card,borderRadius:12,padding:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:10}}>CATEGORIAS</div>
                {categoryData.length>0?(
                  <>
                    <ResponsiveContainer width="100%" height={90}>
                      <PieChart><Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={38} innerRadius={20} paddingAngle={2}>{categoryData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:10}}/></PieChart>
                    </ResponsiveContainer>
                    {categoryData.slice(0,3).map((c,i)=>(
                      <div key={c.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:5,height:5,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length]}}/><span style={{fontSize:9,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:52}}>{c.name}</span></div>
                        <span style={{fontSize:9,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </>
                ):<div style={{textAlign:'center',color:C.faint,fontSize:11,padding:16}}>Sem dados</div>}
              </div>
              <div style={{background:C.card,borderRadius:12,padding:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:10}}>RECENTES</div>
                {monthTx.length===0?<div style={{textAlign:'center',color:C.faint,fontSize:11,padding:16}}>Sem lançamentos</div>:(
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {[...monthTx].reverse().slice(0,5).map(t=>(
                      <div key={t.id} style={{display:'flex',justifyContent:'space-between',gap:4}}>
                        <div style={{overflow:'hidden',flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</div>
                          <div style={{fontSize:9,color:t.status==='pago'?C.green:C.yellow}}>{t.status==='pago'?'✓ pago':'⏳ pendente'}</div>
                        </div>
                        <div style={{fontSize:11,fontWeight:700,color:t.type==='income'?C.green:C.red,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ TRANSACTIONS ════ */}
        {activeTab==='transactions'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>Lançamentos</div>
                <div style={{fontSize:11,color:C.muted}}>{MONTHS[currentMonth]} · {monthTx.length} registros</div>
              </div>
              <button onClick={()=>setShowModal(true)} style={{background:C.green,color:'#fff',border:'none',borderRadius:9,padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit',letterSpacing:'-0.2px'}}>+ Novo</button>
            </div>

            {/* Filtros */}
            <div style={{display:'flex',gap:5,marginBottom:14,overflowX:'auto'}}>
              {(['todos','pago','pendente'] as const).map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'5px 12px',border:`1px solid ${filterStatus===s?C.green:C.border}`,borderRadius:99,cursor:'pointer',fontWeight:filterStatus===s?700:400,fontSize:11,fontFamily:'inherit',background:filterStatus===s?C.green+'15':'transparent',color:filterStatus===s?C.green:C.muted,whiteSpace:'nowrap',transition:'all 0.15s'}}>
                  {s==='todos'?`Todos (${monthTx.length})`:s==='pago'?`✓ Pagos (${monthTx.filter(t=>t.status==='pago').length})`:`⏳ Pendentes (${monthTx.filter(t=>t.status==='pendente').length})`}
                </button>
              ))}
            </div>

            {/* Fixos */}
            {recurring.length>0&&(
              <div style={{background:C.card,border:`1px solid ${C.yellow}20`,borderRadius:12,padding:12,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.yellow,letterSpacing:'1px',marginBottom:8}}>FIXOS MENSAIS</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {recurring.map(r=>{
                    const applied=isApplied(r)
                    return(
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:C.bg,borderRadius:8,opacity:r.active?1:0.45}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:12,fontWeight:600}}>{r.description}</span>
                            <Badge color={C.muted}>dia {r.dayOfMonth}</Badge>
                          </div>
                          <div style={{fontSize:10,color:C.muted,marginTop:1}}>{r.category}</div>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:r.type==='income'?C.green:C.red,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{r.type==='income'?'+':'−'}{fmt(r.amount)}</span>
                        {r.active&&!applied&&<button onClick={()=>applyRecurring(r)} style={{background:C.green+'15',border:`1px solid ${C.green}30`,color:C.green,borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Aplicar</button>}
                        {applied&&<Badge color={C.green}>✓ ok</Badge>}
                        <IconBtn onClick={()=>toggleRecurring(r)}>{r.active?'⏸':'▶'}</IconBtn>
                        <IconBtn onClick={()=>askDelete({type:'recurring',id:r.id,message:`Excluir o fixo "${r.description}"?`})} danger>×</IconBtn>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista */}
            {filteredMonthTx.length===0?(
              <div style={{textAlign:'center',padding:'50px 0'}}>
                <div style={{fontSize:32,marginBottom:8}}>📭</div>
                <div style={{fontWeight:600,fontSize:13,color:C.muted}}>Nenhum lançamento{filterStatus!=='todos'?` "${filterStatus}"`:''}</div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {filteredMonthTx.map(t=>{
                  const card=cards.find(c=>c.id===t.cardId)
                  return(
                    <div key={t.id} style={{background:C.card,borderRadius:11,padding:'11px 12px',display:'flex',alignItems:'center',gap:10,border:`1px solid ${t.status==='pago'?C.green+'20':C.border}`}}>
                      {/* Indicador tipo */}
                      <div style={{width:3,height:36,borderRadius:99,background:t.type==='income'?C.green:C.red,flexShrink:0}}/>
                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                          <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:170}}>{t.description}</span>
                          {t.installmentTotal&&t.installmentTotal>1&&<Badge color={C.purple}>{t.installmentCurrent}/{t.installmentTotal}</Badge>}
                        </div>
                        <div style={{fontSize:10,color:C.muted}}>
                          {t.category} · {t.date.split('-').reverse().join('/')}
                          {t.paymentMethod==='credit'&&card&&` · ${card.name}`}
                        </div>
                      </div>
                      {/* Valor + ações */}
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <span style={{fontWeight:800,fontSize:13,color:t.type==='income'?C.green:C.red,fontFamily:"'DM Mono',monospace"}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</span>
                        <StatusBadge status={t.status} onClick={()=>toggleStatus(t)}/>
                        <IconBtn onClick={()=>openEdit(t)}>✎</IconBtn>
                        <IconBtn onClick={()=>askDelete({type:'transaction',id:t.id,message:`Excluir "${t.description}" de ${fmt(t.amount)}?`})} danger>×</IconBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ CARDS ════ */}
        {activeTab==='cards'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div><div style={{fontWeight:700,fontSize:15}}>Cartões</div><div style={{fontSize:11,color:C.muted}}>{cards.length} cadastrado(s)</div></div>
              <button onClick={()=>setShowCardModal(true)} style={{background:C.purple,color:'#fff',border:'none',borderRadius:9,padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>+ Cartão</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {cards.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>💳</div>Nenhum cartão</div>}
              {cardSpending.map(card=>{
                const pct=Math.min(card.limit>0?(card.spent/card.limit)*100:0,100)
                return(
                  <div key={card.id} style={{background:C.card,borderRadius:14,padding:16,borderLeft:`3px solid ${card.color}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{card.name}</div>
                        <div style={{fontSize:10,color:C.muted}}>Limite {fmt(card.limit)}</div>
                      </div>
                      <IconBtn onClick={()=>askDelete({type:'card',id:card.id,message:`Excluir o cartão "${card.name}"?`})} danger>×</IconBtn>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      <div style={{background:C.bg,borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.5px'}}>Gasto</div>
                        <div style={{fontSize:16,fontWeight:800,color:card.color,fontFamily:"'DM Mono',monospace"}}>{fmt(card.spent)}</div>
                      </div>
                      <div style={{background:C.bg,borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.5px'}}>Disponível</div>
                        <div style={{fontSize:16,fontWeight:800,color:C.green,fontFamily:"'DM Mono',monospace"}}>{fmt(Math.max(card.limit-card.spent,0))}</div>
                      </div>
                    </div>
                    <div style={{background:C.bg,borderRadius:99,height:4}}><div style={{background:pct>80?C.red:card.color,borderRadius:99,height:4,width:`${pct}%`,transition:'width 0.4s'}}/></div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
                      <span style={{fontSize:10,color:pct>80?C.red:C.muted}}>{pct.toFixed(0)}% utilizado</span>
                      {pct>80&&<span style={{fontSize:10,color:C.red,fontWeight:600}}>⚠ atenção</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════ GOALS ════ */}
        {activeTab==='goals'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div><div style={{fontWeight:700,fontSize:15}}>Metas & Projetos</div><div style={{fontSize:11,color:C.muted}}>{goalsStats.filter(g=>g.done).length} concluída(s)</div></div>
              <button onClick={()=>setShowGoalModal(true)} style={{background:C.yellow,color:'#07111F',border:'none',borderRadius:9,padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>+ Meta</button>
            </div>
            {goalsStats.length>0&&(
              <div style={{background:C.card,borderRadius:10,padding:12,marginBottom:12,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,textAlign:'center'}}>
                {[['Guardado',fmt(totalGoalsSaved),C.green],['Total',fmt(totalGoalsTarget),C.text],['Progresso',totalGoalsTarget>0?`${((totalGoalsSaved/totalGoalsTarget)*100).toFixed(0)}%`:'—',C.yellow]].map(([l,v,c])=>(
                  <div key={l}><div style={{fontSize:9,color:C.muted,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.8px'}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
            )}
            {goalsStats.length===0?(
              <div style={{textAlign:'center',padding:'50px 0',color:C.muted}}><div style={{fontSize:40,marginBottom:8}}>🎯</div><div style={{fontWeight:600,fontSize:13}}>Nenhuma meta ainda</div></div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {goalsStats.map(g=>{
                  const isExp=expandedGoal===g.id
                  return(
                    <div key={g.id} style={{background:C.card,borderRadius:14,overflow:'hidden',borderLeft:`3px solid ${g.done?C.green:g.color}`}}>
                      <div style={{padding:14}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:22}}>{g.emoji}</span>
                            <div>
                              <div style={{fontWeight:700,fontSize:13}}>{g.name}</div>
                              <div style={{fontSize:9,color:C.muted,marginTop:1}}>
                                {g.done?<span style={{color:C.green}}>✓ Concluída</span>:g.days<=0?<span style={{color:C.red}}>Prazo encerrado</span>:`${g.days} dias restantes`}
                              </div>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>setShowContribModal(g.id)} style={{background:g.color+'20',border:`1px solid ${g.color}40`,color:g.color,borderRadius:7,padding:'4px 10px',fontWeight:700,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>+ Aportar</button>
                            <IconBtn onClick={()=>askDelete({type:'goal',id:g.id,message:`Excluir a meta "${g.name}"?`})} danger>×</IconBtn>
                          </div>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:11,color:C.muted}}>{fmt(g.saved)}</span>
                          <span style={{fontSize:11,fontWeight:700,color:g.done?C.green:g.color}}>{g.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{background:C.bg,borderRadius:99,height:5,marginBottom:4}}>
                          <div style={{background:g.done?C.green:g.color,borderRadius:99,height:5,width:`${g.pct}%`,transition:'width 0.5s'}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                          <span style={{fontSize:9,color:C.muted}}>Meta {fmt(g.target)}</span>
                          {!g.done&&<span style={{fontSize:9,color:C.yellow}}>{fmt(g.needed)}/mês</span>}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                          {[{l:'Falta',v:g.done?'—':fmt(Math.max(g.target-g.saved,0)),c:C.red},{l:'Aportes',v:String(g.contributions.length),c:C.muted},{l:'/mês',v:g.done?'✓':fmt(g.needed),c:C.yellow}].map(s=>(
                            <div key={s.l} style={{background:C.bg,borderRadius:7,padding:'6px 8px',textAlign:'center'}}>
                              <div style={{fontSize:8,color:C.muted,marginBottom:2,textTransform:'uppercase'}}>{s.l}</div>
                              <div style={{fontSize:10,fontWeight:700,color:s.c,fontFamily:"'DM Mono',monospace"}}>{s.v}</div>
                            </div>
                          ))}
                        </div>
                        {g.contributions.length>0&&(
                          <button onClick={()=>setExpandedGoal(isExp?null:g.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:10,marginTop:8,padding:0,fontFamily:'inherit'}}>
                            {isExp?'▲ ocultar':'▼ ver'} aportes ({g.contributions.length})
                          </button>
                        )}
                      </div>
                      {isExp&&(
                        <div style={{borderTop:`1px solid ${C.border}`,padding:'10px 14px',display:'flex',flexDirection:'column',gap:5}}>
                          {[...g.contributions].reverse().map(c=>(
                            <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${C.bg}`}}>
                              <div>
                                <span style={{fontSize:12,fontWeight:600,color:C.green,fontFamily:"'DM Mono',monospace"}}>+{fmt(c.amount)}</span>
                                <span style={{fontSize:10,color:C.muted,marginLeft:8}}>{c.date.split('-').reverse().join('/')}{c.note&&` · ${c.note}`}</span>
                              </div>
                              <IconBtn onClick={()=>askDelete({type:'contribution',id:c.id,message:`Excluir aporte de ${fmt(c.amount)}?`})} danger>×</IconBtn>
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

        {/* ════ REPORT ════ */}
        {activeTab==='report'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>Relatório — {MONTHS[currentMonth]} {currentYear}</div>

            <div style={{background:C.card,borderRadius:12,padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:12}}>RESUMO</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                {[['Entradas',fmt(totalIncome),C.green],['Saídas',fmt(totalExpense),C.red],['Saldo',fmt(balance),balance>=0?C.green:C.red]].map(([l,v,c])=>(
                  <div key={l} style={{background:C.bg,borderRadius:8,padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,marginBottom:4,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:12,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {[['Recebido',fmt(paidIncome),C.green],['Pago',fmt(paidExpense),C.blue],['A pagar',fmt(pendingExpense),C.yellow]].map(([l,v,c])=>(
                  <div key={l} style={{background:C.bg,borderRadius:8,padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,marginBottom:4,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:12,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
            </div>

            <div style={{background:C.card,borderRadius:12,padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:12}}>POR CATEGORIA</div>
              {categoryData.length===0?<div style={{textAlign:'center',color:C.muted,fontSize:12,padding:12}}>Sem dados</div>:categoryData.map((c,i)=>(
                <div key={c.name} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:6,height:6,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length]}}/><span style={{fontSize:12}}>{c.name}</span></div>
                    <div style={{display:'flex',gap:8}}><span style={{fontSize:11,color:C.muted}}>{totalExpense>0?((c.value/totalExpense)*100).toFixed(0):0}%</span><span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(c.value)}</span></div>
                  </div>
                  <div style={{background:C.bg,borderRadius:99,height:3}}><div style={{background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99,height:3,width:`${totalExpense>0?(c.value/totalExpense)*100:0}%`}}/></div>
                </div>
              ))}
            </div>

            <div style={{background:C.card,borderRadius:12,padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'1px',marginBottom:12}}>FORMA DE PAGAMENTO</div>
              {[['credit','Cartão',C.purple],['pix','PIX',C.green],['débito','Débito',C.blue],['dinheiro','Dinheiro',C.yellow]].map(([pm,label,color])=>{
                const total=monthTx.filter(t=>t.paymentMethod===pm&&t.type==='expense').reduce((s,t)=>s+t.amount,0)
                if(!total) return null
                return(
                  <div key={pm} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.bg}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:color}}/><span style={{fontSize:12,color:C.muted}}>{label}</span></div>
                    <span style={{fontWeight:700,fontSize:12,fontFamily:"'DM Mono',monospace"}}>{fmt(total)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* ════ MODAL: NOVO LANÇAMENTO ════ */}
      {showModal&&(
        <Backdrop onClose={()=>setShowModal(false)}>
          <ModalTitle>Novo Lançamento</ModalTitle>
          <SegControl options={[['expense','⬇ Saída',C.red],['income','⬆ Entrada',C.green]]} value={form.type} onChange={v=>setForm(f=>({...f,type:v,category:v==='income'?'Salário':'Outros'}))}/>
          <SegControl options={[['unico','Único',C.green],['parcelado','Parcelado',C.purple],['fixo','Fixo',C.yellow]]} value={form.mode} onChange={v=>setForm(f=>({...f,mode:v}))}/>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Descrição"><input type="text" placeholder={form.mode==='fixo'?'Ex: Salário, Aluguel...':'Ex: Mercado, Netflix...'} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={IS}/></Field>
            <Row>
              <Field label={form.mode==='parcelado'?'Valor Total':'Valor (R$)'}><input type="number" placeholder="0,00" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} style={IS}/></Field>
              {form.mode==='fixo'
                ?<Field label="Dia do mês"><input type="number" placeholder="5" min="1" max="28" value={form.dayOfMonth} onChange={e=>setForm(p=>({...p,dayOfMonth:e.target.value}))} style={IS}/></Field>
                :<Field label={form.mode==='parcelado'?'Data 1ª parcela':'Data'}><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={IS}/></Field>
              }
            </Row>
            {form.mode==='parcelado'&&(
              <Field label="Parcelas">
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
                  {['2','3','4','6','10','12','18','24','36','48'].map(n=>(
                    <button key={n} onClick={()=>setForm(p=>({...p,installments:n}))} style={{padding:'5px 11px',border:`1px solid ${form.installments===n?C.purple:C.border}`,borderRadius:7,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:form.installments===n?C.purple+'20':'transparent',color:form.installments===n?C.purple:C.muted}}>{n}x</button>
                  ))}
                </div>
                {form.amount&&parseInt(form.installments)>1&&(
                  <div style={{fontSize:11,color:C.purple,background:C.purple+'12',borderRadius:7,padding:'7px 10px'}}>{form.installments}x de {fmt(parseFloat(form.amount)/parseInt(form.installments))} = {fmt(parseFloat(form.amount))}</div>
                )}
              </Field>
            )}
            <Row>
              <Field label="Categoria"><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={IS}>{(form.type==='income'?CATEGORIES_INCOME:CATEGORIES_EXPENSE).map(c=><option key={c}>{c}</option>)}</select></Field>
              <Field label="Pagamento"><select value={form.paymentMethod} onChange={e=>setForm(p=>({...p,paymentMethod:e.target.value,cardId:''}))} style={IS}><option value="pix">PIX</option><option value="credit">Crédito</option><option value="débito">Débito</option><option value="dinheiro">Dinheiro</option></select></Field>
            </Row>
            {form.paymentMethod==='credit'&&<Field label="Cartão"><select value={form.cardId} onChange={e=>setForm(p=>({...p,cardId:e.target.value}))} style={IS}><option value="">Selecionar...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
            {form.mode!=='fixo'&&(
              <Field label="Status inicial">
                <div style={{display:'flex',gap:6}}>
                  {[['pendente','⏳ Pendente',C.yellow],['pago','✓ Pago',C.green]].map(([s,l,c])=>(
                    <button key={s} onClick={()=>setForm(p=>({...p,status:s}))} style={{flex:1,padding:'9px 0',border:`1px solid ${form.status===s?c:C.border}`,borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:form.status===s?c+'18':'transparent',color:form.status===s?c:C.muted}}>{l}</button>
                  ))}
                </div>
              </Field>
            )}
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <Btn onClick={()=>setShowModal(false)} variant="ghost">Cancelar</Btn>
            <Btn onClick={addTransaction} color={form.mode==='fixo'?C.yellow:form.mode==='parcelado'?C.purple:form.type==='income'?C.green:C.red}>
              {form.mode==='fixo'?'Salvar Fixo 🔄':form.mode==='parcelado'?`${form.installments}x 💳`:'Salvar'}
            </Btn>
          </div>
        </Backdrop>
      )}

      {/* ════ MODAL: EDITAR LANÇAMENTO ════ */}
      {editingTx&&(
        <Backdrop onClose={()=>setEditingTx(null)}>
          <ModalTitle>✎ Editar Lançamento</ModalTitle>
          <SegControl options={[['expense','⬇ Saída',C.red],['income','⬆ Entrada',C.green]]} value={editForm.type} onChange={v=>setEditForm(f=>({...f,type:v,category:v==='income'?'Salário':'Outros'}))}/>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Descrição"><input type="text" value={editForm.description} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))} style={IS}/></Field>
            <Row>
              <Field label="Valor (R$)"><input type="number" value={editForm.amount} onChange={e=>setEditForm(p=>({...p,amount:e.target.value}))} style={IS}/></Field>
              <Field label="Data"><input type="date" value={editForm.date} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))} style={IS}/></Field>
            </Row>
            <Row>
              <Field label="Categoria"><select value={editForm.category} onChange={e=>setEditForm(p=>({...p,category:e.target.value}))} style={IS}>{(editForm.type==='income'?CATEGORIES_INCOME:CATEGORIES_EXPENSE).map(c=><option key={c}>{c}</option>)}</select></Field>
              <Field label="Pagamento"><select value={editForm.paymentMethod} onChange={e=>setEditForm(p=>({...p,paymentMethod:e.target.value,cardId:''}))} style={IS}><option value="pix">PIX</option><option value="credit">Crédito</option><option value="débito">Débito</option><option value="dinheiro">Dinheiro</option></select></Field>
            </Row>
            {editForm.paymentMethod==='credit'&&<Field label="Cartão"><select value={editForm.cardId} onChange={e=>setEditForm(p=>({...p,cardId:e.target.value}))} style={IS}><option value="">Selecionar...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
            <Field label="Status">
              <div style={{display:'flex',gap:6}}>
                {[['pendente','⏳ Pendente',C.yellow],['pago','✓ Pago',C.green]].map(([s,l,c])=>(
                  <button key={s} onClick={()=>setEditForm(p=>({...p,status:s}))} style={{flex:1,padding:'9px 0',border:`1px solid ${editForm.status===s?c:C.border}`,borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:editForm.status===s?c+'18':'transparent',color:editForm.status===s?c:C.muted}}>{l}</button>
                ))}
              </div>
            </Field>
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <Btn onClick={()=>setEditingTx(null)} variant="ghost">Cancelar</Btn>
            <Btn onClick={saveEdit} color={C.blue}>Salvar alterações</Btn>
          </div>
        </Backdrop>
      )}

      {/* ════ MODAL: CARTÃO ════ */}
      {showCardModal&&(
        <Backdrop onClose={()=>setShowCardModal(false)}>
          <ModalTitle>Novo Cartão</ModalTitle>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Nome"><input type="text" placeholder="Ex: Nubank, Itaú..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))} style={IS}/></Field>
            <Row>
              <Field label="Limite (R$)"><input type="number" placeholder="5000" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))} style={IS}/></Field>
              <Field label="Cor"><input type="color" value={cardForm.color} onChange={e=>setCardForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:4,height:43,cursor:'pointer'}}/></Field>
            </Row>
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <Btn onClick={()=>setShowCardModal(false)} variant="ghost">Cancelar</Btn>
            <Btn onClick={addCard} color={C.purple}>Salvar Cartão</Btn>
          </div>
        </Backdrop>
      )}

      {/* ════ MODAL: META ════ */}
      {showGoalModal&&(
        <Backdrop onClose={()=>setShowGoalModal(false)}>
          <ModalTitle>Nova Meta</ModalTitle>
          <Field label="Ícone">
            <div style={{display:'flex',flexWrap:'wrap',gap:4,background:C.bg,borderRadius:10,padding:8,marginBottom:12}}>
              {EMOJIS.map(e=><button key={e} onClick={()=>setGoalForm(p=>({...p,emoji:e}))} style={{fontSize:18,background:goalForm.emoji===e?C.yellow+'25':'none',border:`1px solid ${goalForm.emoji===e?C.yellow:'transparent'}`,borderRadius:7,width:34,height:34,cursor:'pointer'}}>{e}</button>)}
            </div>
          </Field>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Nome"><input type="text" placeholder="Ex: Compra do Carro" value={goalForm.name} onChange={e=>setGoalForm(p=>({...p,name:e.target.value}))} style={IS}/></Field>
            <Row>
              <Field label="Valor Alvo (R$)"><input type="number" placeholder="30000" value={goalForm.target} onChange={e=>setGoalForm(p=>({...p,target:e.target.value}))} style={IS}/></Field>
              <Field label="Prazo"><input type="date" value={goalForm.deadline} onChange={e=>setGoalForm(p=>({...p,deadline:e.target.value}))} style={IS}/></Field>
            </Row>
            <Row>
              <Field label="Cor"><input type="color" value={goalForm.color} onChange={e=>setGoalForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:4,height:43,cursor:'pointer'}}/></Field>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                <div style={{background:goalForm.color+'18',border:`1px solid ${goalForm.color}40`,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:20}}>{goalForm.emoji}</span>
                  <span style={{fontSize:12,fontWeight:700,color:goalForm.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{goalForm.name||'Prévia'}</span>
                </div>
              </div>
            </Row>
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <Btn onClick={()=>setShowGoalModal(false)} variant="ghost">Cancelar</Btn>
            <Btn onClick={addGoal} color={C.yellow}>Criar Meta 🎯</Btn>
          </div>
        </Backdrop>
      )}

      {/* ════ MODAL: APORTE ════ */}
      {showContribModal!==null&&(()=>{
        const goal=goals.find(g=>g.id===showContribModal);if(!goal) return null
        const saved=goal.contributions.reduce((s,c)=>s+c.amount,0)
        return(
          <Backdrop onClose={()=>setShowContribModal(null)}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span style={{fontSize:24}}>{goal.emoji}</span>
              <div><div style={{fontWeight:700,fontSize:15}}>Adicionar Aporte</div><div style={{fontSize:11,color:C.muted}}>{goal.name}</div></div>
            </div>
            <div style={{background:C.bg,borderRadius:99,height:4,margin:'0 0 4px'}}><div style={{background:goal.color,borderRadius:99,height:4,width:`${Math.min(goal.target>0?(saved/goal.target)*100:0,100)}%`}}/></div>
            <div style={{fontSize:10,color:C.muted,marginBottom:16}}>{fmt(saved)} de {fmt(goal.target)}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <Field label="Valor (R$)"><input type="number" placeholder="500" value={contribForm.amount} onChange={e=>setContribForm(p=>({...p,amount:e.target.value}))} style={IS}/></Field>
              <Field label="Data"><input type="date" value={contribForm.date} onChange={e=>setContribForm(p=>({...p,date:e.target.value}))} style={IS}/></Field>
              <Field label="Observação (opcional)"><input type="text" placeholder="Ex: Guardei do bônus..." value={contribForm.note} onChange={e=>setContribForm(p=>({...p,note:e.target.value}))} style={IS}/></Field>
            </div>
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <Btn onClick={()=>setShowContribModal(null)} variant="ghost">Cancelar</Btn>
              <Btn onClick={()=>addContrib(goal.id)} color={goal.color}>Confirmar 💰</Btn>
            </div>
          </Backdrop>
        )
      })()}

      <ConfirmDialog state={confirmDelete} onConfirm={handleConfirmDelete} onCancel={()=>setConfirmDelete(null)}/>
    </>
  )
}