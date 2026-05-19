# FinançasFácil 💰

Sistema financeiro familiar com controle de lançamentos, cartões de crédito, metas e relatórios mensais.

**Stack:** Next.js 14 · TypeScript · Prisma · Neon PostgreSQL · Recharts

---

## ⚡ Setup em 5 passos

### 1. Clonar e instalar dependências
```bash
git clone <seu-repo>
cd financas-facil
npm install
```

### 2. Configurar o banco de dados no Neon

1. Acesse [neon.tech](https://neon.tech) e crie uma conta (gratuito)
2. Crie um novo projeto: **"financas-facil"**
3. No painel do projeto, vá em **"Connection Details"**
4. Mude o dropdown para **"Prisma"**
5. Copie as duas URLs (DATABASE_URL e DIRECT_URL)

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```

Edite `.env` e cole as URLs do Neon:
```env
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/financas?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/financas?sslmode=require"
```

### 4. Criar as tabelas no banco
```bash
npm run db:push
```

### 5. Rodar em desenvolvimento
```bash
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🚀 Deploy no Vercel

1. Faça push do projeto para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Em **"Environment Variables"**, adicione:
   - `DATABASE_URL` → sua connection string do Neon (com pgbouncer)
   - `DIRECT_URL` → sua connection string do Neon (sem pgbouncer)
4. Clique em **"Deploy"**

> ✅ O comando `npm run build` já roda `prisma generate` automaticamente.

---

## 📁 Estrutura do projeto

```
financas-facil/
├── prisma/
│   └── schema.prisma          # Modelos do banco de dados
├── lib/
│   └── prisma.ts              # Singleton do Prisma Client
├── pages/
│   ├── _app.tsx               # App wrapper (CSS global)
│   ├── index.tsx              # Aplicação principal (UI)
│   └── api/
│       ├── transactions/
│       │   ├── index.ts       # GET (listar) · POST (criar)
│       │   └── [id].ts        # DELETE
│       ├── cards/
│       │   ├── index.ts       # GET · POST
│       │   └── [id].ts        # DELETE
│       ├── goals/
│       │   ├── index.ts       # GET (com contributions) · POST
│       │   └── [id].ts        # DELETE (cascade)
│       └── contributions/
│           ├── index.ts       # POST
│           └── [id].ts        # DELETE
├── styles/
│   └── globals.css
├── .env.example
├── package.json
└── next.config.js
```

---

## 🛠️ Comandos úteis

```bash
npm run dev          # Desenvolvimento local
npm run build        # Build de produção
npm run db:push      # Aplica o schema no banco (sem migrations)
npm run db:studio    # Abre o Prisma Studio (visualizar dados)
```

---

## ✨ Funcionalidades

- **Dashboard** com KPIs, histórico de 6 meses e pizza de categorias
- **Lançamentos** por mês (entradas e saídas) com categorias e formas de pagamento
- **Cartões de crédito** com controle de limite e gastos por mês
- **Metas & Projetos** com aportes, barra de progresso e cálculo de valor mensal necessário
- **Relatório mensal** com breakdown por categoria e forma de pagamento
- **Confirmação** em todas as exclusões
- Navegação por mês com setas ‹ ›
