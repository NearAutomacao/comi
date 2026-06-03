# Deploy — COMI

## 1. GitHub

### Opção A: pelo terminal (instale o GitHub CLI primeiro)
```
winget install --id GitHub.cli
gh auth login
gh repo create comi --public --source=. --remote=origin --push
```

### Opção B: pelo site
1. Acesse github.com → New repository
2. Nome: **comi** → Create repository
3. No terminal do projeto:
```
git remote add origin https://github.com/SEU_USUARIO/comi.git
git branch -M main
git push -u origin main
```

---

## 2. Supabase — Banco de dados

1. Acesse supabase.com → Seu projeto → SQL Editor
2. Cole todo o conteúdo de `supabase/migrations/001_initial.sql`
3. Execute (Run)
4. Anote as credenciais em: Settings → API

---

## 3. Variáveis de ambiente (.env.local)

Crie o arquivo `.env.local` na raiz do projeto:
```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

MERCADOPAGO_ACCESS_TOKEN=seu_token_mp
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=sua_public_key_mp

NEXT_PUBLIC_APP_URL=https://comi.vercel.app
```

---

## 4. Vercel

### Opção A: CLI
```
npm i -g vercel
vercel login
vercel --prod
```
Quando perguntar sobre env vars, adicione as do passo 3.

### Opção B: pelo site
1. Acesse vercel.com → New Project
2. Importe o repositório `comi` do GitHub
3. Em **Environment Variables**, adicione as variáveis do .env.local
4. Deploy!

---

## 5. Criar gerente (admin) no Supabase

Após o deploy, crie um usuário gerente pelo Supabase:
1. Authentication → Users → Invite user (email do gerente)
2. Após o gerente confirmar email, execute no SQL Editor:
```sql
UPDATE profiles SET role = 'manager' WHERE id = 'UUID_DO_USUARIO';
```

---

## 6. MercadoPago — Webhook

Configure o webhook no painel do MercadoPago:
- URL: `https://comi.vercel.app/api/webhooks/mercadopago`
- Eventos: `payment`

---

## Rodando localmente

```
npm run dev
# Acesse http://localhost:3000
```
