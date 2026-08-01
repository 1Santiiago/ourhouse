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
interface ConfirmState { type: 'transaction'|'card'|'goal'|'contribution'|'recurring'; id: number; message: string }

const CAT_EXP = ['Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Vestuário','Assinaturas','Outros']
const CAT_INC = ['Salário','Freelance','Investimentos','Aluguel Recebido','Outros']
const MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const PCOLORS = ['#6EE7B7','#FCD34D','#FCA5A5','#C4B5FD','#93C5FD','#F9A8D4','#67E8F9','#BEF264','#FED7AA']
const EMOJIS  = ['🚗','🏠','✈️','🏖️','📱','💻','🎓','💍','👶','🛋️','🏋️','🎸','⛵','🐕','🌿','🏥','🎯','🔑','💎','🛒']

const fmt  = (v: number) => Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const fmtK = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v))
const today = () => new Date().toISOString().split('T')[0]
const pad   = (n: number) => String(n).padStart(2,'0')

const daysUntil   = (ds: string) => { const t=new Date(); t.setHours(0,0,0,0); return Math.ceil((new Date(ds+'T12:00:00').getTime()-t.getTime())/86400000) }
const monthsUntil = (ds: string) => Math.max(1, Math.ceil(daysUntil(ds)/30.44))

// ─── Token system ────────────────────────────────────────────────────────────
const T = {
  // backgrounds
  bg0: '#03080F',   // deepest
  bg1: '#060E19',   // page
  bg2: '#0A1628',   // card
  bg3: '#0F1E35',   // elevated card
  bg4: '#162540',   // input / pill bg

  // borders
  b1:  '#1A2E4A',
  b2:  '#1F3A5C',

  // text
  t1:  '#F0F6FF',   // primary
  t2:  '#8BA3C0',   // secondary
  t3:  '#3D5A7A',   // faint

  // brand
  g:   '#00D68F',   // green
  gd:  '#00A86B',   // green dark
  r:   '#FF4D6A',   // red
  y:   '#FFB800',   // yellow
  b:   '#4D9EFF',   // blue
  p:   '#9B7FFF',   // purple

  // radius
  r4:  4,
  r8:  8,
  r12: 12,
  r16: 16,
  r20: 20,
  r14: 14,
  r99: 99,
}

const EMPTY_FORM = {
  type:'expense', description:'', amount:'', category:'Outros',
  date:today(), paymentMethod:'pix', cardId:'',
  mode:'unico', installments:'2', dayOfMonth:'5', status:'pendente',
}
const EMPTY_GOAL    = { emoji:'🎯', name:'', color:'#9B7FFF', target:'', deadline:'' }
const EMPTY_CONTRIB = { amount:'', date:today(), note:'' }

// ─── Primitive components ────────────────────────────────────────────────────
const IS: React.CSSProperties = {
  width:'100%', background:T.bg4, border:`1.5px solid ${T.b1}`,
  borderRadius:T.r12, padding:'12px 14px', color:T.t1,
  fontSize:15, fontFamily:'inherit', outline:'none',
  transition:'border-color 0.15s',
}
const LS: React.CSSProperties = {
  fontSize:10, color:T.t3, display:'block', marginBottom:8,
  textTransform:'uppercase', letterSpacing:'1.2px', fontWeight:700,
}

type BtnVariant = 'primary'|'ghost'|'danger'|'outline'
const PillBtn = ({
  onClick, children, color, variant='primary', size='md', full
}:{
  onClick:()=>void; children:React.ReactNode; color?:string;
  variant?:BtnVariant; size?:'sm'|'md'|'lg'; full?:boolean
}) => {
  const bg = variant==='primary' ? (color||T.g) : variant==='danger' ? T.r : 'transparent'
  const border = variant==='outline' ? `1.5px solid ${color||T.b2}` : variant==='ghost' ? `1.5px solid ${T.b1}` : 'none'
  const textC = variant==='primary' ? '#000' : variant==='danger' ? '#fff' : (color||T.t2)
  const pad = size==='sm'?'7px 14px':size==='lg'?'14px 28px':'10px 20px'
  const fs = size==='sm'?11:size==='lg'?15:13
  return (
    <button onClick={onClick} style={{
      background:bg, border, borderRadius:T.r99, color:textC,
      fontWeight:700, cursor:'pointer', fontFamily:'inherit',
      fontSize:fs, padding:pad, display:'inline-flex', alignItems:'center',
      justifyContent:'center', gap:6, width:full?'100%':undefined,
      letterSpacing:'-0.2px', transition:'opacity 0.15s',
    }}>{children}</button>
  )
}

const Chip = ({label,color,bg}:{label:string;color:string;bg:string}) => (
  <span style={{fontSize:9,fontWeight:800,color,background:bg,borderRadius:T.r99,padding:'2px 7px',letterSpacing:'0.5px',textTransform:'uppercase'}}>{label}</span>
)

const IBtn = ({onClick,children,danger,active}:{onClick:()=>void;children:React.ReactNode;danger?:boolean;active?:boolean}) => (
  <button onClick={onClick} style={{
    background:danger?`${T.r}12`:active?`${T.g}15`:'transparent',
    border:`1.5px solid ${danger?T.r+'30':active?T.g+'40':T.b1}`,
    color:danger?T.r:active?T.g:T.t3,
    borderRadius:T.r8, width:30, height:30, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:13, flexShrink:0, transition:'all 0.15s',
  }}>{children}</button>
)

const Divider = () => <div style={{height:1,background:T.b1,margin:'4px 0'}}/>

const SectionLabel = ({children}:{children:React.ReactNode}) => (
  <div style={{fontSize:10,fontWeight:800,color:T.t3,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:12}}>{children}</div>
)

// ─── Confirm dialog ──────────────────────────────────────────────────────────
function ConfirmDialog({state,onConfirm,onCancel}:{state:ConfirmState|null;onConfirm:()=>void;onCancel:()=>void}) {
  if(!state) return null
  return (
    <div style={{position:'fixed',inset:0,background:'#000D',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:24}}>
      <div style={{background:T.bg3,border:`1.5px solid ${T.r}25`,borderRadius:T.r20,padding:'32px 24px',maxWidth:300,width:'100%',textAlign:'center'}}>
        <div style={{width:52,height:52,background:`${T.r}15`,borderRadius:T.r99,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px'}}>🗑</div>
        <div style={{fontWeight:800,fontSize:16,marginBottom:8,color:T.t1}}>Confirmar exclusão</div>
        <div style={{fontSize:13,color:T.t2,marginBottom:28,lineHeight:1.6}}>{state.message}</div>
        <div style={{display:'flex',gap:8}}>
          <PillBtn onClick={onCancel} variant="ghost" full>Cancelar</PillBtn>
          <PillBtn onClick={onConfirm} variant="danger" full>Excluir</PillBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Bottom sheet ────────────────────────────────────────────────────────────
function Sheet({onClose,children,title}:{onClose:()=>void;children:React.ReactNode;title:string}) {
  return (
    <div style={{position:'fixed',inset:0,background:'#000B',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:300}} onClick={onClose}>
      <div style={{background:T.bg2,borderRadius:'24px 24px 0 0',padding:'0 20px 36px',width:'100%',maxWidth:500,maxHeight:'94vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        {/* Handle */}
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 20px'}}>
          <div style={{width:36,height:4,background:T.b2,borderRadius:T.r99}}/>
        </div>
        <div style={{fontWeight:800,fontSize:17,marginBottom:22,color:T.t1,letterSpacing:'-0.3px'}}>{title}</div>
        {children}
      </div>
    </div>
  )
}

const SheetField = ({label,children}:{label:string;children:React.ReactNode}) => (
  <div style={{marginBottom:14}}><label style={LS}>{label}</label>{children}</div>
)

const SheetRow = ({children}:{children:React.ReactNode}) => (
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>{children}</div>
)

// ─── Segmented control ────────────────────────────────────────────────────────
function Seg({options,value,onChange}:{options:[string,string,string][];value:string;onChange:(v:string)=>void}) {
  return (
    <div style={{display:'flex',background:T.bg4,borderRadius:T.r12,padding:4,gap:2,marginBottom:16}}>
      {options.map(([v,l,c])=>(
        <button key={v} onClick={()=>onChange(v)} style={{
          flex:1,padding:'9px 4px',border:'none',borderRadius:T.r8,
          cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'inherit',
          background:value===v?c+'22':'transparent',
          color:value===v?c:T.t3,
          transition:'all 0.15s',
        }}>{l}</button>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusPill = ({status,onClick}:{status:string;onClick:()=>void}) => (
  <button onClick={onClick} style={{
    background:status==='pago'?`${T.g}15`:`${T.y}12`,
    border:`1.5px solid ${status==='pago'?T.g+'35':T.y+'30'}`,
    color:status==='pago'?T.g:T.y,
    borderRadius:T.r99,padding:'3px 9px',fontSize:10,fontWeight:800,
    cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',
    letterSpacing:'0.3px',
  }}>
    {status==='pago'?'✓ pago':'⏳ pendente'}
  </button>
)

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cards,        setCards]        = useState<Card[]>([])
  const [goals,        setGoals]        = useState<Goal[]>([])
  const [recurring,    setRecurring]    = useState<Recurring[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [authed,       setAuthed]       = useState(false)

  const [tab,          setTab]          = useState('home')
  const [month,        setMonth]        = useState(new Date().getMonth())
  const [year,         setYear]         = useState(new Date().getFullYear())
  const [statusFilter, setStatusFilter] = useState<'todos'|'pago'|'pendente'>('todos')

  const [showNew,      setShowNew]      = useState(false)
  const [showCard,     setShowCard]     = useState(false)
  const [showGoal,     setShowGoal]     = useState(false)
  const [showContrib,  setShowContrib]  = useState<number|null>(null)
  const [editingTx,    setEditingTx]    = useState<Transaction|null>(null)
  const [expandGoal,   setExpandGoal]   = useState<number|null>(null)
  const [confirm,      setConfirm]      = useState<ConfirmState|null>(null)

  const [form,      setForm]      = useState(EMPTY_FORM)
  const [editForm,  setEditForm]  = useState({type:'expense',description:'',amount:'',category:'Outros',date:today(),paymentMethod:'pix',cardId:'',status:'pendente'})
  const [cardForm,  setCardForm]  = useState({name:'',limit:'',color:'#9B7FFF'})
  const [goalForm,  setGoalForm]  = useState(EMPTY_GOAL)
  const [contrib,   setContrib]   = useState(EMPTY_CONTRIB)

  useEffect(()=>{
    if(localStorage.getItem('ff_auth')!=='ok') window.location.replace('/login')
    else setAuthed(true)
  },[])

  const logout = () => { localStorage.removeItem('ff_auth'); window.location.replace('/login') }

  const refetch = useCallback(async()=>{
    const [txs,cds,gls,rec] = await Promise.all([
      fetch('/api/transactions').then(r=>r.json()),
      fetch('/api/cards').then(r=>r.json()),
      fetch('/api/goals').then(r=>r.json()),
      fetch('/api/recurring').then(r=>r.json()),
    ])
    setTransactions(Array.isArray(txs)?txs:[])
    setCards(Array.isArray(cds)?cds:[])
    setGoals(Array.isArray(gls)?gls:[])
    setRecurring(Array.isArray(rec)?rec:[])
  },[])

  useEffect(()=>{ if(!authed) return; refetch().finally(()=>setLoading(false)) },[authed,refetch])

  const prevM = () => { let m=month-1,y=year; if(m<0){m=11;y--} setMonth(m);setYear(y) }
  const nextM = () => { let m=month+1,y=year; if(m>11){m=0;y++} setMonth(m);setYear(y) }

  const monthTx = useMemo(()=>transactions.filter(t=>{
    const d=new Date(t.date+'T12:00:00')
    return d.getMonth()===month && d.getFullYear()===year
  }),[transactions,month,year])

  const isApplied = (r:Recurring) => monthTx.some(t=>t.description===r.description&&Math.abs(t.amount-r.amount)<0.01&&t.type===r.type)

  const virtuals = useMemo(()=>recurring.filter(r=>r.active&&!isApplied(r)).map(r=>({
    id:-(r.id),type:r.type,description:r.description,amount:r.amount,
    category:r.category,date:`${year}-${pad(month+1)}-${pad(Math.min(r.dayOfMonth,28))}`,
    paymentMethod:r.paymentMethod,cardId:r.cardId,status:'pendente',
  })),[recurring,month,year,monthTx])

  const allTx = useMemo(()=>[...monthTx,...virtuals],[monthTx,virtuals])

  const income      = useMemo(()=>allTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),[allTx])
  const expense     = useMemo(()=>allTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),[allTx])
  const balance     = income - expense
  const savings     = income>0?((balance/income)*100).toFixed(1):'0.0'
  const paidIn      = useMemo(()=>monthTx.filter(t=>t.type==='income'&&t.status==='pago').reduce((s,t)=>s+t.amount,0),[monthTx])
  const paidOut     = useMemo(()=>monthTx.filter(t=>t.type==='expense'&&t.status==='pago').reduce((s,t)=>s+t.amount,0),[monthTx])
  const pendingOut  = useMemo(()=>allTx.filter(t=>t.type==='expense'&&t.status==='pendente').reduce((s,t)=>s+t.amount,0),[allTx])

  const catData = useMemo(()=>{
    const m:Record<string,number>={}
    allTx.filter(t=>t.type==='expense').forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount})
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  },[allTx])

  const histData = useMemo(()=>Array.from({length:6},(_,i)=>{
    let m=month-5+i,y=year; while(m<0){m+=12;y--}
    const ts=transactions.filter(t=>{const d=new Date(t.date+'T12:00:00');return d.getMonth()===m&&d.getFullYear()===y})
    return{month:MONTHS[m].slice(0,3),income:ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense:ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)}
  }),[transactions,month,year])

  const cardSpend = useMemo(()=>cards.map(c=>({...c,spent:monthTx.filter(t=>t.paymentMethod==='credit'&&t.cardId===c.id).reduce((s,t)=>s+t.amount,0)})),[cards,monthTx])

  const goalStats = useMemo(()=>goals.map(g=>{
    const saved=g.contributions.reduce((s,c)=>s+c.amount,0)
    const pct=Math.min(g.target>0?(saved/g.target)*100:0,100)
    const days=daysUntil(g.deadline);const months=monthsUntil(g.deadline)
    return{...g,saved,pct,days,months,needed:Math.max(0,(g.target-saved)/months),done:saved>=g.target}
  }),[goals])

  const totalSaved  = useMemo(()=>goalStats.reduce((s,g)=>s+g.saved,0),[goalStats])
  const totalTarget = useMemo(()=>goalStats.reduce((s,g)=>s+g.target,0),[goalStats])

  const filteredTx = useMemo(()=>{
    if(statusFilter==='todos') return [...monthTx].reverse()
    return [...monthTx].filter(t=>t.status===statusFilter).reverse()
  },[monthTx,statusFilter])

  const save = async(fn:()=>Promise<void>) => { setSaving(true); try{await fn()}finally{setSaving(false)} }

  const openEdit = (t:Transaction) => {
    setEditForm({type:t.type,description:t.description,amount:String(t.amount),category:t.category,date:t.date,paymentMethod:t.paymentMethod,cardId:t.cardId?String(t.cardId):'',status:t.status})
    setEditingTx(t)
  }

  const saveEdit = ()=>save(async()=>{
    if(!editingTx||!editForm.description.trim()||!editForm.amount) return
    await fetch(`/api/transactions/${editingTx.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)})
    await refetch();setEditingTx(null)
  })

  const toggleStatus = (t:Transaction)=>save(async()=>{
    await fetch(`/api/transactions/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:t.status==='pago'?'pendente':'pago'})})
    await refetch()
  })

  const addTx = ()=>save(async()=>{
    if(!form.description.trim()||!form.amount) return
    if(form.mode==='fixo'){
      await fetch('/api/recurring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:parseFloat(form.amount),category:form.category,paymentMethod:form.paymentMethod,cardId:form.cardId||null,dayOfMonth:parseInt(form.dayOfMonth)||5})})
    } else if(form.mode==='parcelado'){
      const n=Math.max(2,parseInt(form.installments)||2)
      const base=new Date(form.date+'T12:00:00')
      for(let i=0;i<n;i++){
        const d=new Date(base);d.setMonth(d.getMonth()+i)
        await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:parseFloat(form.amount)/n,category:form.category,date:d.toISOString().split('T')[0],paymentMethod:form.paymentMethod,cardId:form.cardId||null,installmentTotal:n,installmentCurrent:i+1,status:form.status})})
      }
    } else {
      await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.type,description:form.description,amount:parseFloat(form.amount),category:form.category,date:form.date,paymentMethod:form.paymentMethod,cardId:form.cardId||null,status:form.status})})
    }
    await refetch();setShowNew(false);setForm(EMPTY_FORM)
  })

  const applyR = (r:Recurring)=>save(async()=>{
    await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:r.type,description:r.description,amount:r.amount,category:r.category,paymentMethod:r.paymentMethod,date:`${year}-${pad(month+1)}-${pad(Math.min(r.dayOfMonth,28))}`,cardId:r.cardId,status:'pendente'})})
    await refetch()
  })

  const toggleR = (r:Recurring)=>save(async()=>{
    await fetch(`/api/recurring/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!r.active})})
    await refetch()
  })

  const addCard = ()=>save(async()=>{
    if(!cardForm.name.trim()||!cardForm.limit) return
    await fetch('/api/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cardForm)})
    await refetch();setShowCard(false);setCardForm({name:'',limit:'',color:'#9B7FFF'})
  })

  const addGoal = ()=>save(async()=>{
    if(!goalForm.name.trim()||!goalForm.target||!goalForm.deadline) return
    await fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(goalForm)})
    await refetch();setShowGoal(false);setGoalForm(EMPTY_GOAL)
  })

  const addContrib = (gid:number)=>save(async()=>{
    if(!contrib.amount) return
    await fetch('/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...contrib,goalId:gid})})
    await refetch();setShowContrib(null);setContrib(EMPTY_CONTRIB)
  })

  const doDelete = ()=>save(async()=>{
    if(!confirm) return
    const{type,id}=confirm
    if(type==='transaction')  await fetch(`/api/transactions/${id}`,{method:'DELETE'})
    if(type==='card')         await fetch(`/api/cards/${id}`,{method:'DELETE'})
    if(type==='goal')         await fetch(`/api/goals/${id}`,{method:'DELETE'})
    if(type==='contribution') await fetch(`/api/contributions/${id}`,{method:'DELETE'})
    if(type==='recurring')    await fetch(`/api/recurring/${id}`,{method:'DELETE'})
    await refetch();setConfirm(null)
  })

  // ── Loading ────────────────────────────────────────────────────────────────
  if(loading) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:T.bg1}}>
      <div style={{width:56,height:56,background:`linear-gradient(135deg,${T.g},${T.gd})`,borderRadius:T.r16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,color:'#000',boxShadow:`0 0 40px ${T.g}40`}}>₢</div>
      <div style={{fontWeight:800,fontSize:17,color:T.t1,letterSpacing:'-0.3px'}}>FinançasFácil</div>
      <div style={{width:28,height:28,border:`2px solid ${T.b2}`,borderTop:`2px solid ${T.g}`,borderRadius:T.r99,animation:'spin 0.7s linear infinite'}}/>
    </div>
  )

  const navItems = [
    {id:'home',icon:'⌂',label:'Início'},
    {id:'lancamentos',icon:'↕',label:'Lançamentos'},
    {id:'cartoes',icon:'▭',label:'Cartões'},
    {id:'metas',icon:'◎',label:'Metas'},
    {id:'relatorio',icon:'≡',label:'Relatório'},
  ]

  return (
    <>
      <Head>
        <title>FinançasFácil</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap');
          *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
          body{background:${T.bg1};font-family:'Inter',sans-serif;color:${T.t1};overscroll-behavior:none}
          input::placeholder{color:${T.t3}}
          input:focus,select:focus{border-color:${T.g}!important;outline:none}
          select option{background:${T.bg3}}
          ::-webkit-scrollbar{width:0;height:0}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          .fade{animation:fadeIn 0.2s ease both}
          @media(min-width:600px){
            .show-desk{display:flex!important}
            .hide-desk{display:none!important}
          }
        `}</style>
      </Head>

      {/* Saving bar */}
      {saving&&<div style={{position:'fixed',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${T.g},${T.b})`,zIndex:999,borderRadius:'0 99px 99px 0'}}/>}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{
        background:T.bg2,
        borderBottom:`1px solid ${T.b1}`,
        padding:'0 20px',
        height:54,
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        position:'sticky',top:0,zIndex:100,
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            background:`linear-gradient(135deg,${T.g},${T.gd})`,
            borderRadius:10,width:30,height:30,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:900,fontSize:14,color:'#000',flexShrink:0,
          }}>₢</div>
          <div>
            <div style={{fontWeight:800,fontSize:14,letterSpacing:'-0.4px',color:T.t1,lineHeight:1}}>FinançasFácil</div>
            <div style={{fontSize:9,color:T.t3,letterSpacing:'1px'}}>CONTROLE FAMILIAR</div>
          </div>
        </div>

        {/* Month nav + logout */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:2,background:T.bg4,borderRadius:T.r99,padding:'5px 12px',border:`1px solid ${T.b1}`}}>
            <button onClick={prevM} style={{background:'none',border:'none',color:T.t3,cursor:'pointer',fontSize:16,lineHeight:1,padding:'0 2px'}}>‹</button>
            <span style={{fontWeight:700,fontSize:12,minWidth:86,textAlign:'center',color:T.t2}}>{MONTHS[month].slice(0,3)} {year}</span>
            <button onClick={nextM} style={{background:'none',border:'none',color:T.t3,cursor:'pointer',fontSize:16,lineHeight:1,padding:'0 2px'}}>›</button>
          </div>
          <IBtn onClick={logout} danger>⏻</IBtn>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main style={{padding:'16px 16px 100px',maxWidth:560,margin:'0 auto'}}>

        {/* ════ HOME ════ */}
        {tab==='home'&&(
          <div className="fade" style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* Hero balance card */}
            <div style={{
              background:`linear-gradient(135deg,${T.bg3} 0%,#0D2040 100%)`,
              borderRadius:T.r20,
              padding:'24px 20px',
              border:`1px solid ${T.b2}`,
              position:'relative',overflow:'hidden',
            }}>
              {/* decorative circle */}
              <div style={{position:'absolute',right:-30,top:-30,width:140,height:140,borderRadius:'50%',background:`${T.g}08`}}/>
              <div style={{position:'absolute',right:10,bottom:-20,width:80,height:80,borderRadius:'50%',background:`${T.b}06`}}/>

              <div style={{fontSize:10,fontWeight:800,color:T.t3,letterSpacing:'1.5px',marginBottom:6}}>SALDO PREVISTO</div>
              <div style={{fontSize:32,fontWeight:900,color:balance>=0?T.g:T.r,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px',marginBottom:4}}>
                {fmt(balance)}
              </div>
              <div style={{fontSize:11,color:T.t3,marginBottom:20}}>{MONTHS[month]} {year} · poupança {savings}%</div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {label:'Entradas',val:income,color:T.g,icon:'↑'},
                  {label:'Saídas',val:expense,color:T.r,icon:'↓'},
                ].map(k=>(
                  <div key={k.label} style={{background:'#FFFFFF08',borderRadius:T.r12,padding:'10px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                      <span style={{fontSize:11,color:k.color,fontWeight:700}}>{k.icon}</span>
                      <span style={{fontSize:9,color:T.t3,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>{k.label}</span>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:k.color,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(k.val)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {[
                {label:'Recebido',val:paidIn,color:T.g},
                {label:'Pago',val:paidOut,color:T.b},
                {label:'A pagar',val:pendingOut,color:T.y},
              ].map(s=>(
                <div key={s.label} style={{background:T.bg2,borderRadius:T.r12,padding:'10px 10px',border:`1px solid ${T.b1}`}}>
                  <div style={{fontSize:8,color:T.t3,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase',marginBottom:5}}>{s.label}</div>
                  <div style={{fontSize:13,fontWeight:800,color:s.color,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(s.val)}</div>
                </div>
              ))}
            </div>

            {/* Metas strip */}
            {goalStats.length>0&&(
              <div style={{background:T.bg2,borderRadius:T.r16,padding:16,border:`1px solid ${T.b1}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <SectionLabel>Metas</SectionLabel>
                  <span style={{fontSize:10,color:T.t3,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(totalSaved)} / {fmt(totalTarget)}</span>
                </div>
                {goalStats.slice(0,3).map(g=>(
                  <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:18,flexShrink:0}}>{g.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:T.t1}}>{g.name}</span>
                        <span style={{fontSize:10,color:g.done?T.g:T.t3,flexShrink:0,marginLeft:6,fontWeight:700}}>{g.pct.toFixed(0)}%</span>
                      </div>
                      <div style={{background:T.bg4,borderRadius:T.r99,height:4}}>
                        <div style={{background:g.done?T.g:g.color,borderRadius:T.r99,height:4,width:`${g.pct}%`,transition:'width 0.5s ease',boxShadow:g.done?`0 0 8px ${T.g}60`:undefined}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div style={{background:T.bg2,borderRadius:T.r16,padding:'16px 12px',border:`1px solid ${T.b1}`}}>
              <SectionLabel>Histórico 6 meses</SectionLabel>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={histData} barCategoryGap="40%" barGap={2}>
                  <XAxis dataKey="month" tick={{fill:T.t3,fontSize:10,fontFamily:'Inter'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.t3,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fmtK} width={24}/>
                  <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:T.bg3,border:`1px solid ${T.b2}`,borderRadius:T.r8,color:T.t1,fontSize:11,fontFamily:'Inter'}} labelStyle={{color:T.t2}}/>
                  <Bar dataKey="income"  fill={T.g}    radius={[4,4,0,0]} name="Entradas" fillOpacity={0.9}/>
                  <Bar dataKey="expense" fill={T.r}    radius={[4,4,0,0]} name="Saídas"   fillOpacity={0.45}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:14,justifyContent:'center',marginTop:8}}>
                {[[T.g,'Entradas'],[T.r,'Saídas']].map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                    <span style={{fontSize:10,color:T.t3,fontWeight:600}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cat + Recentes */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:T.bg2,borderRadius:T.r16,padding:14,border:`1px solid ${T.b1}`}}>
                <SectionLabel>Categorias</SectionLabel>
                {catData.length>0?(
                  <>
                    <ResponsiveContainer width="100%" height={90}>
                      <PieChart>
                        <Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={38} innerRadius={20} paddingAngle={2} strokeWidth={0}>
                          {catData.map((_,i)=><Cell key={i} fill={PCOLORS[i%PCOLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:T.bg3,border:`1px solid ${T.b2}`,borderRadius:T.r8,color:T.t1,fontSize:10}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    {catData.slice(0,3).map((c,i)=>(
                      <div key={c.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:5,height:5,borderRadius:'50%',background:PCOLORS[i%PCOLORS.length]}}/>
                          <span style={{fontSize:9,color:T.t2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:52}}>{c.name}</span>
                        </div>
                        <span style={{fontSize:9,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </>
                ):<div style={{textAlign:'center',color:T.t3,fontSize:11,padding:16}}>Sem gastos</div>}
              </div>

              <div style={{background:T.bg2,borderRadius:T.r16,padding:14,border:`1px solid ${T.b1}`}}>
                <SectionLabel>Recentes</SectionLabel>
                {monthTx.length===0?<div style={{textAlign:'center',color:T.t3,fontSize:11,padding:16}}>Vazio</div>:(
                  <div style={{display:'flex',flexDirection:'column',gap:9}}>
                    {[...monthTx].reverse().slice(0,5).map(t=>(
                      <div key={t.id} style={{display:'flex',justifyContent:'space-between',gap:4}}>
                        <div style={{overflow:'hidden',flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:T.t1}}>{t.description}</div>
                          <div style={{fontSize:9,color:t.status==='pago'?T.g:T.y,marginTop:1,fontWeight:600}}>{t.status==='pago'?'✓ pago':'⏳ pend.'}</div>
                        </div>
                        <div style={{fontSize:11,fontWeight:800,color:t.type==='income'?T.g:T.r,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ LANÇAMENTOS ════ */}
        {tab==='lancamentos'&&(
          <div className="fade">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:17,letterSpacing:'-0.3px'}}>Lançamentos</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{MONTHS[month]} · {monthTx.length} registros</div>
              </div>
              <PillBtn onClick={()=>setShowNew(true)} color={T.g}>+ Novo</PillBtn>
            </div>

            {/* Filtros */}
            <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
              {(['todos','pago','pendente'] as const).map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} style={{
                  padding:'6px 14px',border:`1.5px solid ${statusFilter===s?T.g:T.b1}`,
                  borderRadius:T.r99,cursor:'pointer',fontWeight:statusFilter===s?700:500,
                  fontSize:11,fontFamily:'Inter',
                  background:statusFilter===s?`${T.g}15`:'transparent',
                  color:statusFilter===s?T.g:T.t3,whiteSpace:'nowrap',
                  transition:'all 0.15s',
                }}>
                  {s==='todos'?`Todos (${monthTx.length})`:s==='pago'?`✓ Pagos (${monthTx.filter(t=>t.status==='pago').length})`:`⏳ Pendentes (${monthTx.filter(t=>t.status==='pendente').length})`}
                </button>
              ))}
            </div>

            {/* Fixos */}
            {recurring.length>0&&(
              <div style={{background:T.bg2,borderRadius:T.r16,padding:14,marginBottom:12,border:`1px solid ${T.y}20`}}>
                <SectionLabel>Fixos mensais</SectionLabel>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {recurring.map(r=>{
                    const ap=isApplied(r)
                    return(
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:T.bg4,borderRadius:T.r8,opacity:r.active?1:0.4}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:12,fontWeight:700,color:T.t1}}>{r.description}</span>
                            <Chip label={`dia ${r.dayOfMonth}`} color={T.t3} bg={T.bg3}/>
                          </div>
                          <div style={{fontSize:10,color:T.t3,marginTop:1}}>{r.category}</div>
                        </div>
                        <span style={{fontSize:12,fontWeight:800,color:r.type==='income'?T.g:T.r,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{r.type==='income'?'+':'−'}{fmt(r.amount)}</span>
                        {r.active&&!ap&&<PillBtn onClick={()=>applyR(r)} size="sm" color={T.g} variant="outline">Aplicar</PillBtn>}
                        {ap&&<Chip label="✓ ok" color={T.g} bg={`${T.g}15`}/>}
                        <IBtn onClick={()=>toggleR(r)} active={r.active}>{r.active?'⏸':'▶'}</IBtn>
                        <IBtn onClick={()=>setConfirm({type:'recurring',id:r.id,message:`Excluir o fixo "${r.description}"?`})} danger>×</IBtn>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista */}
            {filteredTx.length===0?(
              <div style={{textAlign:'center',padding:'60px 0'}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontWeight:700,fontSize:14,color:T.t2}}>Nenhum lançamento</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>
                  {statusFilter!=='todos'?`Nenhum "${statusFilter}" este mês`:'Toque em "+ Novo" para começar'}
                </div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {filteredTx.map(t=>{
                  const cd=cards.find(c=>c.id===t.cardId)
                  return(
                    <div key={t.id} style={{
                      background:T.bg2,borderRadius:T.r14,padding:'12px 14px',
                      display:'flex',alignItems:'center',gap:10,
                      border:`1px solid ${t.status==='pago'?T.g+'25':T.b1}`,
                      transition:'border-color 0.2s',
                    }}>
                      {/* Color bar */}
                      <div style={{width:3,height:38,borderRadius:T.r99,background:t.type==='income'?T.g:T.r,flexShrink:0}}/>

                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                          <span style={{fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160,color:T.t1}}>{t.description}</span>
                          {t.installmentTotal&&t.installmentTotal>1&&<Chip label={`${t.installmentCurrent}/${t.installmentTotal}`} color={T.p} bg={`${T.p}18`}/>}
                        </div>
                        <div style={{fontSize:10,color:T.t3}}>
                          {t.category} · {t.date.split('-').reverse().join('/')}
                          {t.paymentMethod==='credit'&&cd&&` · ${cd.name}`}
                        </div>
                      </div>

                      {/* Right */}
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <span style={{fontWeight:800,fontSize:14,color:t.type==='income'?T.g:T.r,fontFamily:"'JetBrains Mono',monospace"}}>{t.type==='income'?'+':'−'}{fmt(t.amount)}</span>
                        <StatusPill status={t.status} onClick={()=>toggleStatus(t)}/>
                        <IBtn onClick={()=>openEdit(t)}>✎</IBtn>
                        <IBtn onClick={()=>setConfirm({type:'transaction',id:t.id,message:`Excluir "${t.description}" de ${fmt(t.amount)}?`})} danger>×</IBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ CARTÕES ════ */}
        {tab==='cartoes'&&(
          <div className="fade">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:17,letterSpacing:'-0.3px'}}>Cartões</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{cards.length} cadastrado(s)</div>
              </div>
              <PillBtn onClick={()=>setShowCard(true)} color={T.p}>+ Cartão</PillBtn>
            </div>

            {cards.length===0&&<div style={{textAlign:'center',padding:'60px 0',color:T.t3}}><div style={{fontSize:40,marginBottom:12}}>💳</div><div style={{fontWeight:700,fontSize:14,color:T.t2}}>Nenhum cartão</div></div>}

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {cardSpend.map(card=>{
                const pct=Math.min(card.limit>0?(card.spent/card.limit)*100:0,100)
                const danger=pct>80
                return(
                  <div key={card.id} style={{
                    background:`linear-gradient(135deg,${card.color}12 0%,${T.bg2} 60%)`,
                    borderRadius:T.r20,padding:20,
                    border:`1px solid ${card.color}35`,
                    position:'relative',overflow:'hidden',
                  }}>
                    {/* bg decoration */}
                    <div style={{position:'absolute',right:-20,top:-20,width:100,height:100,borderRadius:'50%',background:`${card.color}08`}}/>

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{background:`${card.color}20`,borderRadius:T.r12,width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>💳</div>
                        <div>
                          <div style={{fontWeight:800,fontSize:15,color:T.t1}}>{card.name}</div>
                          <div style={{fontSize:10,color:T.t3,marginTop:2}}>Limite {fmt(card.limit)}</div>
                        </div>
                      </div>
                      <IBtn onClick={()=>setConfirm({type:'card',id:card.id,message:`Excluir o cartão "${card.name}"?`})} danger>×</IBtn>
                    </div>

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                      <div style={{background:'#FFFFFF06',borderRadius:T.r12,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:4}}>GASTO</div>
                        <div style={{fontSize:18,fontWeight:900,color:card.color,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(card.spent)}</div>
                      </div>
                      <div style={{background:'#FFFFFF06',borderRadius:T.r12,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:4}}>DISPONÍVEL</div>
                        <div style={{fontSize:18,fontWeight:900,color:T.g,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(Math.max(card.limit-card.spent,0))}</div>
                      </div>
                    </div>

                    <div style={{background:'#FFFFFF10',borderRadius:T.r99,height:5}}>
                      <div style={{background:danger?T.r:card.color,borderRadius:T.r99,height:5,width:`${pct}%`,transition:'width 0.4s ease',boxShadow:danger?`0 0 8px ${T.r}60`:`0 0 8px ${card.color}60`}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                      <span style={{fontSize:10,color:danger?T.r:T.t3,fontWeight:danger?700:400}}>{pct.toFixed(0)}% utilizado</span>
                      {danger&&<span style={{fontSize:10,color:T.r,fontWeight:800}}>⚠ Limite alto</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════ METAS ════ */}
        {tab==='metas'&&(
          <div className="fade">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:17,letterSpacing:'-0.3px'}}>Metas & Projetos</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{goalStats.filter(g=>g.done).length} concluída(s) · {goalStats.filter(g=>!g.done).length} em andamento</div>
              </div>
              <PillBtn onClick={()=>setShowGoal(true)} color={T.y}>+ Meta</PillBtn>
            </div>

            {goalStats.length>0&&(
              <div style={{background:T.bg2,borderRadius:T.r12,padding:'12px 14px',marginBottom:12,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,textAlign:'center',border:`1px solid ${T.b1}`}}>
                {[['Guardado',fmt(totalSaved),T.g],['Total',fmt(totalTarget),T.t1],['Progresso',totalTarget>0?`${((totalSaved/totalTarget)*100).toFixed(0)}%`:'—',T.y]].map(([l,v,c])=>(
                  <div key={l}><div style={{fontSize:8,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:4,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div></div>
                ))}
              </div>
            )}

            {goalStats.length===0?(
              <div style={{textAlign:'center',padding:'60px 0',color:T.t3}}><div style={{fontSize:44,marginBottom:12}}>🎯</div><div style={{fontWeight:700,fontSize:14,color:T.t2}}>Nenhuma meta</div><div style={{fontSize:12,marginTop:4}}>Toque em "+ Meta"</div></div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {goalStats.map(g=>{
                  const isExp=expandGoal===g.id
                  return(
                    <div key={g.id} style={{background:T.bg2,borderRadius:T.r20,overflow:'hidden',border:`1px solid ${g.done?T.g+'35':g.color+'25'}`}}>
                      <div style={{padding:'16px 16px 14px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{background:`${g.color}15`,borderRadius:T.r12,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{g.emoji}</div>
                            <div>
                              <div style={{fontWeight:800,fontSize:14,color:T.t1}}>{g.name}</div>
                              <div style={{fontSize:10,color:T.t3,marginTop:2}}>
                                {g.done?<span style={{color:T.g,fontWeight:700}}>✓ Concluída!</span>:g.days<=0?<span style={{color:T.r}}>Prazo encerrado</span>:`${g.days} dias · ${new Date(g.deadline+'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </div>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:5}}>
                            <PillBtn onClick={()=>setShowContrib(g.id)} size="sm" color={g.color} variant="outline">+ Aportar</PillBtn>
                            <IBtn onClick={()=>setConfirm({type:'goal',id:g.id,message:`Excluir a meta "${g.name}"?`})} danger>×</IBtn>
                          </div>
                        </div>

                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:600,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(g.saved)}</span>
                          <span style={{fontSize:12,fontWeight:800,color:g.done?T.g:g.color,fontFamily:"'JetBrains Mono',monospace"}}>{g.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{background:T.bg4,borderRadius:T.r99,height:6,marginBottom:6}}>
                          <div style={{background:g.done?T.g:g.color,borderRadius:T.r99,height:6,width:`${g.pct}%`,transition:'width 0.5s ease',boxShadow:`0 0 10px ${g.done?T.g:g.color}50`}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                          <span style={{fontSize:10,color:T.t3}}>Meta: {fmt(g.target)}</span>
                          {!g.done&&<span style={{fontSize:10,color:T.y,fontWeight:700}}>{fmt(g.needed)}/mês</span>}
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                          {[{l:'Falta',v:g.done?'—':fmt(Math.max(g.target-g.saved,0)),c:T.r},{l:'Aportes',v:String(g.contributions.length),c:T.t2},{l:'/mês',v:g.done?'✓':fmt(g.needed),c:T.y}].map(s=>(
                            <div key={s.l} style={{background:T.bg4,borderRadius:T.r8,padding:'7px 8px',textAlign:'center'}}>
                              <div style={{fontSize:8,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:3,textTransform:'uppercase'}}>{s.l}</div>
                              <div style={{fontSize:10,fontWeight:800,color:s.c,fontFamily:"'JetBrains Mono',monospace"}}>{s.v}</div>
                            </div>
                          ))}
                        </div>

                        {g.contributions.length>0&&(
                          <button onClick={()=>setExpandGoal(isExp?null:g.id)} style={{background:'none',border:'none',color:T.t3,cursor:'pointer',fontSize:10,marginTop:10,padding:0,fontFamily:'Inter',fontWeight:600,display:'flex',alignItems:'center',gap:3}}>
                            {isExp?'▲ ocultar':'▼ ver'} aportes ({g.contributions.length})
                          </button>
                        )}
                      </div>

                      {isExp&&(
                        <div style={{borderTop:`1px solid ${T.b1}`,padding:'10px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {[...g.contributions].reverse().map(c=>(
                            <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${T.bg4}`}}>
                              <div>
                                <span style={{fontSize:12,fontWeight:700,color:T.g,fontFamily:"'JetBrains Mono',monospace"}}>+{fmt(c.amount)}</span>
                                <span style={{fontSize:10,color:T.t3,marginLeft:8}}>{c.date.split('-').reverse().join('/')}{c.note&&` · ${c.note}`}</span>
                              </div>
                              <IBtn onClick={()=>setConfirm({type:'contribution',id:c.id,message:`Excluir aporte de ${fmt(c.amount)}?`})} danger>×</IBtn>
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

        {/* ════ RELATÓRIO ════ */}
        {tab==='relatorio'&&(
          <div className="fade" style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontWeight:800,fontSize:17,letterSpacing:'-0.3px',marginBottom:4}}>Relatório · {MONTHS[month]} {year}</div>

            {/* Hero nums */}
            <div style={{background:`linear-gradient(135deg,${T.bg3},#0D2040)`,borderRadius:T.r20,padding:20,border:`1px solid ${T.b2}`}}>
              <SectionLabel>Resumo</SectionLabel>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                {[['Entradas',fmt(income),T.g],['Saídas',fmt(expense),T.r],['Saldo',fmt(balance),balance>=0?T.g:T.r]].map(([l,v,c])=>(
                  <div key={l} style={{background:'#FFFFFF06',borderRadius:T.r12,padding:'10px 8px',textAlign:'center'}}>
                    <div style={{fontSize:8,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:4,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {[['Recebido',fmt(paidIn),T.g],['Pago',fmt(paidOut),T.b],['A pagar',fmt(pendingOut),T.y]].map(([l,v,c])=>(
                  <div key={l} style={{background:'#FFFFFF06',borderRadius:T.r12,padding:'10px 8px',textAlign:'center'}}>
                    <div style={{fontSize:8,color:T.t3,fontWeight:800,letterSpacing:'1px',marginBottom:4,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:T.bg2,borderRadius:T.r16,padding:16,border:`1px solid ${T.b1}`}}>
              <SectionLabel>Por Categoria</SectionLabel>
              {catData.length===0?<div style={{textAlign:'center',color:T.t3,padding:16,fontSize:12}}>Sem dados</div>:catData.map((c,i)=>(
                <div key={c.name} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:3,background:PCOLORS[i%PCOLORS.length]}}/>
                      <span style={{fontSize:12,color:T.t1}}>{c.name}</span>
                    </div>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <span style={{fontSize:10,color:T.t3}}>{expense>0?((c.value/expense)*100).toFixed(0):0}%</span>
                      <span style={{fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{fmt(c.value)}</span>
                    </div>
                  </div>
                  <div style={{background:T.bg4,borderRadius:T.r99,height:3}}>
                    <div style={{background:PCOLORS[i%PCOLORS.length],borderRadius:T.r99,height:3,width:`${expense>0?(c.value/expense)*100:0}%`}}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:T.bg2,borderRadius:T.r16,padding:16,border:`1px solid ${T.b1}`}}>
              <SectionLabel>Por Pagamento</SectionLabel>
              {[['credit','Cartão',T.p],['pix','PIX',T.g],['débito','Débito',T.b],['dinheiro','Dinheiro',T.y]].map(([pm,label,color])=>{
                const total=monthTx.filter(t=>t.paymentMethod===pm&&t.type==='expense').reduce((s,t)=>s+t.amount,0)
                if(!total) return null
                return(
                  <div key={pm} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${T.bg4}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:8,height:8,borderRadius:3,background:color}}/>
                      <span style={{fontSize:12,color:T.t2}}>{label}</span>
                    </div>
                    <span style={{fontWeight:800,fontSize:13,fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{fmt(total)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────── */}
      <nav style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:`${T.bg2}F5`,
        backdropFilter:'blur(20px)',
        borderTop:`1px solid ${T.b1}`,
        display:'flex',
        paddingBottom:'env(safe-area-inset-bottom,8px)',
        zIndex:100,
      }}>
        {navItems.map(item=>{
          const active=tab===item.id
          return(
            <button key={item.id} onClick={()=>setTab(item.id)} style={{
              flex:1,background:'none',border:'none',cursor:'pointer',
              fontFamily:'Inter',display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:3,
              padding:'10px 0',transition:'all 0.15s',
            }}>
              <span style={{fontSize:18,lineHeight:1,filter:active?undefined:'grayscale(0.3)',opacity:active?1:0.5}}>{item.icon}</span>
              <span style={{fontSize:9,fontWeight:active?800:500,color:active?T.g:T.t3,letterSpacing:'0.3px'}}>{item.label}</span>
              {active&&<div style={{width:16,height:2,background:T.g,borderRadius:T.r99,position:'absolute',bottom:8}}/>}
            </button>
          )
        })}
      </nav>

      {/* ════ SHEET: NOVO LANÇAMENTO ════ */}
      {showNew&&(
        <Sheet onClose={()=>setShowNew(false)} title="Novo Lançamento">
          <Seg options={[['expense','⬇ Saída',T.r],['income','⬆ Entrada',T.g]]} value={form.type} onChange={v=>setForm(f=>({...f,type:v,category:v==='income'?'Salário':'Outros'}))}/>
          <Seg options={[['unico','Único',T.g],['parcelado','Parcelado',T.p],['fixo','Fixo',T.y]]} value={form.mode} onChange={v=>setForm(f=>({...f,mode:v}))}/>
          <SheetField label="Descrição"><input type="text" placeholder={form.mode==='fixo'?'Ex: Salário, Aluguel...':'Ex: Mercado, Netflix...'} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={IS}/></SheetField>
          <SheetRow>
            <SheetField label={form.mode==='parcelado'?'Valor Total (R$)':'Valor (R$)'}><input type="number" placeholder="0,00" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} style={IS}/></SheetField>
            {form.mode==='fixo'
              ?<SheetField label="Dia do mês"><input type="number" min="1" max="28" value={form.dayOfMonth} onChange={e=>setForm(p=>({...p,dayOfMonth:e.target.value}))} style={IS}/></SheetField>
              :<SheetField label={form.mode==='parcelado'?'Data 1ª parcela':'Data'}><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={IS}/></SheetField>
            }
          </SheetRow>
          {form.mode==='parcelado'&&(
            <SheetField label="Parcelas">
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                {['2','3','4','6','10','12','18','24','36','48'].map(n=>(
                  <button key={n} onClick={()=>setForm(p=>({...p,installments:n}))} style={{padding:'6px 12px',border:`1.5px solid ${form.installments===n?T.p:T.b1}`,borderRadius:T.r99,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'Inter',background:form.installments===n?`${T.p}18`:'transparent',color:form.installments===n?T.p:T.t3,transition:'all 0.15s'}}>{n}x</button>
                ))}
              </div>
              {form.amount&&parseInt(form.installments)>1&&(
                <div style={{fontSize:12,color:T.p,background:`${T.p}12`,borderRadius:T.r8,padding:'8px 12px',fontWeight:600}}>{form.installments}x de {fmt(parseFloat(form.amount)/parseInt(form.installments))} = {fmt(parseFloat(form.amount))}</div>
              )}
            </SheetField>
          )}
          <SheetRow>
            <SheetField label="Categoria"><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={IS}>{(form.type==='income'?CAT_INC:CAT_EXP).map(c=><option key={c}>{c}</option>)}</select></SheetField>
            <SheetField label="Pagamento"><select value={form.paymentMethod} onChange={e=>setForm(p=>({...p,paymentMethod:e.target.value,cardId:''}))} style={IS}><option value="pix">PIX</option><option value="credit">Crédito</option><option value="débito">Débito</option><option value="dinheiro">Dinheiro</option></select></SheetField>
          </SheetRow>
          {form.paymentMethod==='credit'&&<SheetField label="Cartão"><select value={form.cardId} onChange={e=>setForm(p=>({...p,cardId:e.target.value}))} style={IS}><option value="">Selecionar...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></SheetField>}
          {form.mode!=='fixo'&&(
            <SheetField label="Status inicial">
              <div style={{display:'flex',gap:8}}>
                {[['pendente','⏳ Pendente',T.y],['pago','✓ Pago',T.g]].map(([s,l,c])=>(
                  <button key={s} onClick={()=>setForm(p=>({...p,status:s}))} style={{flex:1,padding:'10px 0',border:`1.5px solid ${form.status===s?c:T.b1}`,borderRadius:T.r12,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'Inter',background:form.status===s?`${c}15`:'transparent',color:form.status===s?c:T.t3,transition:'all 0.15s'}}>{l}</button>
                ))}
              </div>
            </SheetField>
          )}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <PillBtn onClick={()=>setShowNew(false)} variant="ghost" full>Cancelar</PillBtn>
            <PillBtn onClick={addTx} color={form.mode==='fixo'?T.y:form.mode==='parcelado'?T.p:form.type==='income'?T.g:T.r} full>
              {form.mode==='fixo'?'Salvar Fixo 🔄':form.mode==='parcelado'?`Parcelar ${form.installments}x 💳`:'Salvar'}
            </PillBtn>
          </div>
        </Sheet>
      )}

      {/* ════ SHEET: EDITAR ════ */}
      {editingTx&&(
        <Sheet onClose={()=>setEditingTx(null)} title="✎ Editar Lançamento">
          <Seg options={[['expense','⬇ Saída',T.r],['income','⬆ Entrada',T.g]]} value={editForm.type} onChange={v=>setEditForm(f=>({...f,type:v,category:v==='income'?'Salário':'Outros'}))}/>
          <SheetField label="Descrição"><input type="text" value={editForm.description} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))} style={IS}/></SheetField>
          <SheetRow>
            <SheetField label="Valor (R$)"><input type="number" value={editForm.amount} onChange={e=>setEditForm(p=>({...p,amount:e.target.value}))} style={IS}/></SheetField>
            <SheetField label="Data"><input type="date" value={editForm.date} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))} style={IS}/></SheetField>
          </SheetRow>
          <SheetRow>
            <SheetField label="Categoria"><select value={editForm.category} onChange={e=>setEditForm(p=>({...p,category:e.target.value}))} style={IS}>{(editForm.type==='income'?CAT_INC:CAT_EXP).map(c=><option key={c}>{c}</option>)}</select></SheetField>
            <SheetField label="Pagamento"><select value={editForm.paymentMethod} onChange={e=>setEditForm(p=>({...p,paymentMethod:e.target.value,cardId:''}))} style={IS}><option value="pix">PIX</option><option value="credit">Crédito</option><option value="débito">Débito</option><option value="dinheiro">Dinheiro</option></select></SheetField>
          </SheetRow>
          {editForm.paymentMethod==='credit'&&<SheetField label="Cartão"><select value={editForm.cardId} onChange={e=>setEditForm(p=>({...p,cardId:e.target.value}))} style={IS}><option value="">Selecionar...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></SheetField>}
          <SheetField label="Status">
            <div style={{display:'flex',gap:8}}>
              {[['pendente','⏳ Pendente',T.y],['pago','✓ Pago',T.g]].map(([s,l,c])=>(
                <button key={s} onClick={()=>setEditForm(p=>({...p,status:s}))} style={{flex:1,padding:'10px 0',border:`1.5px solid ${editForm.status===s?c:T.b1}`,borderRadius:T.r12,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'Inter',background:editForm.status===s?`${c}15`:'transparent',color:editForm.status===s?c:T.t3,transition:'all 0.15s'}}>{l}</button>
              ))}
            </div>
          </SheetField>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <PillBtn onClick={()=>setEditingTx(null)} variant="ghost" full>Cancelar</PillBtn>
            <PillBtn onClick={saveEdit} color={T.b} full>Salvar alterações</PillBtn>
          </div>
        </Sheet>
      )}

      {/* ════ SHEET: CARTÃO ════ */}
      {showCard&&(
        <Sheet onClose={()=>setShowCard(false)} title="Novo Cartão">
          <SheetField label="Nome do cartão"><input type="text" placeholder="Ex: Nubank, Itaú, Inter..." value={cardForm.name} onChange={e=>setCardForm(p=>({...p,name:e.target.value}))} style={IS}/></SheetField>
          <SheetRow>
            <SheetField label="Limite (R$)"><input type="number" placeholder="5000" value={cardForm.limit} onChange={e=>setCardForm(p=>({...p,limit:e.target.value}))} style={IS}/></SheetField>
            <SheetField label="Cor do cartão"><input type="color" value={cardForm.color} onChange={e=>setCardForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:6,height:46,cursor:'pointer'}}/></SheetField>
          </SheetRow>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <PillBtn onClick={()=>setShowCard(false)} variant="ghost" full>Cancelar</PillBtn>
            <PillBtn onClick={addCard} color={T.p} full>Salvar Cartão</PillBtn>
          </div>
        </Sheet>
      )}

      {/* ════ SHEET: META ════ */}
      {showGoal&&(
        <Sheet onClose={()=>setShowGoal(false)} title="Nova Meta">
          <SheetField label="Ícone">
            <div style={{display:'flex',flexWrap:'wrap',gap:4,background:T.bg4,borderRadius:T.r12,padding:10,marginBottom:4}}>
              {EMOJIS.map(e=><button key={e} onClick={()=>setGoalForm(p=>({...p,emoji:e}))} style={{fontSize:20,background:goalForm.emoji===e?`${T.y}20`:'none',border:`1.5px solid ${goalForm.emoji===e?T.y:'transparent'}`,borderRadius:T.r8,width:36,height:36,cursor:'pointer',transition:'all 0.15s'}}>{e}</button>)}
            </div>
          </SheetField>
          <SheetField label="Nome do projeto"><input type="text" placeholder="Ex: Compra do Carro, Viagem..." value={goalForm.name} onChange={e=>setGoalForm(p=>({...p,name:e.target.value}))} style={IS}/></SheetField>
          <SheetRow>
            <SheetField label="Valor Alvo (R$)"><input type="number" placeholder="30000" value={goalForm.target} onChange={e=>setGoalForm(p=>({...p,target:e.target.value}))} style={IS}/></SheetField>
            <SheetField label="Prazo"><input type="date" value={goalForm.deadline} onChange={e=>setGoalForm(p=>({...p,deadline:e.target.value}))} style={IS}/></SheetField>
          </SheetRow>
          <SheetRow>
            <SheetField label="Cor"><input type="color" value={goalForm.color} onChange={e=>setGoalForm(p=>({...p,color:e.target.value}))} style={{...IS,padding:6,height:46,cursor:'pointer'}}/></SheetField>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:14}}>
              <div style={{background:`${goalForm.color}15`,border:`1.5px solid ${goalForm.color}35`,borderRadius:T.r12,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>{goalForm.emoji}</span>
                <span style={{fontSize:12,fontWeight:700,color:goalForm.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{goalForm.name||'Prévia'}</span>
              </div>
            </div>
          </SheetRow>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <PillBtn onClick={()=>setShowGoal(false)} variant="ghost" full>Cancelar</PillBtn>
            <PillBtn onClick={addGoal} color={T.y} full>Criar Meta 🎯</PillBtn>
          </div>
        </Sheet>
      )}

      {/* ════ SHEET: APORTE ════ */}
      {showContrib!==null&&(()=>{
        const g=goals.find(x=>x.id===showContrib);if(!g) return null
        const saved=g.contributions.reduce((s,c)=>s+c.amount,0)
        return(
          <Sheet onClose={()=>setShowContrib(null)} title="Adicionar Aporte">
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,padding:'12px 14px',background:T.bg4,borderRadius:T.r12,border:`1px solid ${g.color}30`}}>
              <span style={{fontSize:24}}>{g.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:T.t1}}>{g.name}</div>
                <div style={{background:T.bg3,borderRadius:T.r99,height:4,marginTop:6}}>
                  <div style={{background:g.color,borderRadius:T.r99,height:4,width:`${Math.min(g.target>0?(saved/g.target)*100:0,100)}%`}}/>
                </div>
                <div style={{fontSize:10,color:T.t3,marginTop:4}}>{fmt(saved)} de {fmt(g.target)}</div>
              </div>
            </div>
            <SheetField label="Valor (R$)"><input type="number" placeholder="500" value={contrib.amount} onChange={e=>setContrib(p=>({...p,amount:e.target.value}))} style={IS}/></SheetField>
            <SheetField label="Data"><input type="date" value={contrib.date} onChange={e=>setContrib(p=>({...p,date:e.target.value}))} style={IS}/></SheetField>
            <SheetField label="Observação (opcional)"><input type="text" placeholder="Ex: Guardei do bônus..." value={contrib.note} onChange={e=>setContrib(p=>({...p,note:e.target.value}))} style={IS}/></SheetField>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <PillBtn onClick={()=>setShowContrib(null)} variant="ghost" full>Cancelar</PillBtn>
              <PillBtn onClick={()=>addContrib(g.id)} color={g.color} full>Confirmar 💰</PillBtn>
            </div>
          </Sheet>
        )
      })()}

      <ConfirmDialog state={confirm} onConfirm={doDelete} onCancel={()=>setConfirm(null)}/>
    </>
  )
}