# Deploy — COMI
**Domínio:** `https://comi.awplabs.com.br`

---

## 1. Vercel — Deploy inicial

### Via CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Via site
1. [vercel.com](https://vercel.com) → **New Project** → importar `NearAutomacao/comi`
2. Framework: **Next.js** (detectado automaticamente)
3. Adicionar as variáveis de ambiente abaixo → **Deploy**

---

## 2. Variáveis de ambiente na Vercel

Adicione em Project → Settings → Environment Variables:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yzimtqpktqethevzcjzy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(do .env.local)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(do .env.local)* |
| `NEXT_PUBLIC_APP_URL` | `https://comi.awplabs.com.br` |
| `MERCADOPAGO_CLIENT_ID` | `6716533978473906` |
| `MERCADOPAGO_CLIENT_SECRET` | *(do .env.local)* |
| `MERCADOPAGO_ACCESS_TOKEN` | *(do .env.local)* |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | `APP_USR-cde87684-4ab8-4f79-aa07-97c6c0cb05d0` |

---

## 3. Domínio personalizado na Vercel

1. Vercel → Project → **Settings → Domains**
2. Adicionar: `comi.awplabs.com.br`
3. Vercel vai mostrar um registro CNAME para configurar no DNS

---

## 4. DNS — Registrar.br / provedor do domínio awplabs.com.br

Adicionar registro CNAME:

| Tipo | Nome | Valor |
|---|---|---|
| `CNAME` | `comi` | `cname.vercel-dns.com` |

*(a Vercel mostra o valor exato no passo 3)*

---

## 5. Supabase — Migrations

Execute em ordem no SQL Editor do Supabase:
1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_multitenant.sql`
3. `supabase/migrations/003_grants.sql`
4. `supabase/migrations/004_fix_table_rls.sql`

---

## 6. Criar gerente no Supabase

1. Authentication → Users → **Invite user** (email do gerente)
2. Após confirmar o email, execute:
```sql
UPDATE comi.profiles SET role = 'manager' WHERE id = 'UUID_DO_USUARIO';
```
3. Criar o restaurante:
```sql
INSERT INTO comi.restaurants (owner_id, name)
VALUES ('UUID_DO_USUARIO', 'Nome do Restaurante');
```

---

## 7. MercadoPago — Redirect URI

No painel [developers.mercadopago.com](https://developers.mercadopago.com) → seu app → **URLs de redirect**:
```
https://comi.awplabs.com.br/api/mercadopago/callback
```

---

## 8. MercadoPago — Webhook

Em Configurações → Webhooks → **Criar webhook**:
- URL: `https://comi.awplabs.com.br/api/webhooks/mercadopago`
- Eventos: `payment`
