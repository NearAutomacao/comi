# Guia de Testes — COMI

Este guia cobre todos os recursos implementados: multi-comanda, impressoras térmicas, troca de mesa, pagamento dividido, app desktop e CI/CD.

---

## 1. Preparação do banco de dados

### 1.1 Rodar as migrations

No Supabase Dashboard → SQL Editor, execute cada arquivo em ordem:

```
supabase/migrations/009_comanda_impressao_saas.sql
supabase/migrations/010_printer_settings.sql
```

### 1.2 Verificar tabelas criadas

```sql
-- Deve retornar as tabelas novas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'comi'
  AND table_name IN ('order_sequences', 'print_jobs', 'subscriptions');

-- Deve retornar as colunas de impressora
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'comi'
  AND table_name = 'restaurants'
  AND column_name LIKE 'printer_%';
```

---

## 2. Sistema web (Next.js)

```bash
cd c:/Users/Automação/projetos/comi
npm run dev
```

Acesse http://localhost:3000.

---

## 3. Cadastro e login do gerente

1. Acesse `/login` → registre um gerente
2. Acesse `/admin` → confirme que aparece o painel
3. Vá em **Admin → Configurações** e preencha o nome do restaurante

---

## 4. Configurar impressoras

1. **Admin → Configurações → Impressoras térmicas**
2. Preencha o IP e porta da cozinha (ex: `192.168.1.100`, porta `9100`)
3. Preencha o IP e porta do bar (ex: `192.168.1.101`, porta `9100`)
4. Clique **Salvar impressoras**
5. ✅ Toast "Impressoras salvas" deve aparecer

> Se não tiver impressora física, deixe o campo de IP vazio — o sistema faz log do ticket no console (modo teste).

---

## 5. Configurar categorias → impressora

1. **Admin → Cardápio**
2. Em cada categoria, clique no dropdown de impressora:
   - Comidas → **Cozinha**
   - Bebidas → **Bar**
3. ✅ Ícone de impressora aparece na aba da categoria

---

## 6. Fluxo completo de pedido (cliente)

### 6.1 Primeiro cliente na mesa

1. Abra o QR Code de uma mesa no admin ou acesse:
   `http://localhost:3000/checkin?table=<tableId>&restaurant=<restaurantId>`
2. Preencha nome + telefone
3. Clique **Sentar**
4. ✅ Deve ir para `/cardapio`

### 6.2 Segundo cliente na mesma mesa

1. No mesmo browser (aba anônima) ou outro dispositivo, acesse o mesmo QR code
2. ✅ Tela mostra: "Mesa X está com pessoas. Informe seu nome para abrir sua comanda separada"
3. Preencha apenas o nome (telefone é opcional)
4. Clique **Sentar**
5. ✅ Sessão separada criada — cada um tem sua própria comanda

### 6.3 Fazer pedido

1. Adicione itens ao carrinho
2. Acesse `/carrinho` → **Fazer pedido**
3. ✅ Toast com código do pedido (ex: `Pedido #0042 confirmado`)

### 6.4 Verificar no admin

1. **Admin → Pedidos**
2. ✅ Pedido aparece com `#0042` (código) e nome do cliente
3. O código nunca reseta — sempre aumenta globalmente

---

## 7. Impressão térmica

### 7.1 Agente de impressão standalone

```bash
cd comi-agent
npm install
cp .env.example .env
# Preencha: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID, IPs das impressoras
npm run dev
```

### 7.2 Verificar no terminal

Ao fazer um pedido, o agente deve logar:
```
[print-agent] Processando job <id> → kitchen
[print-agent] Job <id> impresso com sucesso
```

Se o IP estiver vazio: logará o conteúdo do ticket no console (modo teste).

### 7.3 Verificar no banco

```sql
SELECT id, printer, printed_at FROM comi.print_jobs ORDER BY created_at DESC LIMIT 5;
```
- `printed_at` deve estar preenchido após impressão

---

## 8. Troca de mesa

1. No admin, abra uma mesa ocupada → clique **Trocar de mesa**
2. ✅ Aparece grid com mesas livres
3. Clique na mesa destino
4. ✅ Todos os pedidos e sessões migram para a nova mesa
5. Verificar no banco:
```sql
SELECT table_id FROM comi.orders WHERE id = '<order_id>';
```

---

## 9. Divisão de conta

### 9.1 Por comanda (multi-pessoa)

1. Cliente acessa `/conta`
2. ✅ Se há múltiplas comandas, aparece aba **"Por comanda"**
3. Cada pessoa pode escolher método de pagamento separado (PIX, crédito, débito, dinheiro)

### 9.2 Divisão igualitária

1. Clique em **"Dividir igualmente"**
2. Informe o número de pessoas
3. ✅ Valor por pessoa calculado

### 9.3 Pagamento no caixa (admin)

1. **Admin → Pedidos** → clique em um pedido aberto
2. ✅ Modal de pagamento com opções: PIX, Crédito, Débito, **Dinheiro**
3. Selecione dinheiro → confirmar
4. ✅ Pedido marcado como pago, mesa liberada se todos pagos

---

## 10. App Desktop (Electron)

### 10.1 Pré-requisito: build do Next.js em modo standalone

```bash
# Raiz do projeto
$env:BUILD_TARGET = "desktop"
npm run build
```

Isso gera `.next/standalone/` com o `server.js`.

### 10.2 Configurar credenciais do Electron (dev)

```bash
# Copie o exemplo
cp comi-desktop/src/env.example.ts comi-desktop/src/env.ts
# Edite com suas credenciais reais do Supabase
```

### 10.3 Instalar deps e iniciar

```bash
cd comi-desktop
npm install
npm run dev
```

✅ Abre janela Electron carregando localhost:3000 (ou 3100 em dev).

### 10.4 Verificar agente de impressão embutido

1. Faça login como gerente no app
2. ✅ No terminal do Electron você deve ver:
   ```
   [ipc] set-restaurant-config: <restaurant_id>
   [print-agent] Iniciando para restaurante <id>
   [print-agent] Config carregada: {...}
   ```
3. Faça um pedido → ✅ aparece log de impressão

### 10.5 Verificação de licença

Se o restaurante estiver com subscription `suspended` ou `cancelled` no banco, o sistema bloqueia o acesso.

Testando offline: desligue a internet → o app continua abrindo (grace period).

---

## 11. Build do instalador (.exe)

### 11.1 Build local

```bash
# 1. Build Next.js standalone
cd c:/Users/Automação/projetos/comi
$env:BUILD_TARGET = "desktop"
npm run build

# 2. Criar credenciais do Electron
cp comi-desktop/src/env.example.ts comi-desktop/src/env.ts
# Edite comi-desktop/src/env.ts com as credenciais reais

# 3. Build do instalador
cd comi-desktop
npm install
npm run dist
```

✅ Gera `comi-desktop/dist/COMI Setup 1.0.0.exe`

### 11.2 Instalar e testar

1. Execute o instalador
2. ✅ App aparece no Menu Iniciar e na Área de Trabalho
3. Abra → faça login → ✅ funciona

---

## 12. Auto-update (CI/CD)

### 12.1 Configurar repositório GitHub

1. Vá em **Settings → Secrets and variables → Actions** no repositório `NearAutomacao/comi`
3. Adicione os secrets:

| Secret | Valor |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `MESA_SESSION_SECRET` | string aleatória 32+ chars |
| `NEXT_PUBLIC_APP_URL` | `https://seudominio.com` (ou deixe vazio em teste) |

> `GITHUB_TOKEN` é fornecido automaticamente pelo GitHub Actions — não precisa criar.

### 12.2 Publicar uma release

```bash
git tag v1.0.1
git push origin v1.0.1
```

✅ GitHub Actions:
1. Faz build do Next.js standalone
2. Gera `env.ts` com as credenciais
3. Compila TypeScript do Electron
4. Gera `COMI Setup 1.0.1.exe`
5. Cria Release no repositório `NearAutomacao/comi` com o instalador anexado

### 12.3 Verificar update no app instalado

1. Instale a versão antiga (v1.0.0)
2. Publique v1.0.1 via tag
3. ✅ O app detecta a nova versão ~10 segundos após iniciar
4. Toast aparece: "Nova versão disponível — COMI v1.0.1 está sendo baixado..."
5. Barra de progresso aparece no canto inferior direito
6. Na próxima vez que fechar o app → instala automaticamente

---

## 13. Checklist final

- [ ] SQL migrations 009 e 010 aplicados
- [ ] Categorias com impressoras configuradas
- [ ] IPs das impressoras salvos em Configurações
- [ ] Primeiro cliente escaneia QR → comanda aberta
- [ ] Segundo cliente escaneia mesmo QR → comanda separada na mesma mesa
- [ ] Pedido gera código sequencial (#0001, #0002, ...)
- [ ] Print job aparece em `comi.print_jobs` com `printed_at` preenchido
- [ ] Troca de mesa funciona (pedidos migram)
- [ ] Conta dividida por comanda mostra nomes corretos
- [ ] Dinheiro disponível como método de pagamento
- [ ] App Electron abre, faz login, print agent inicia
- [ ] Tag git dispara CI → .exe gerado no GitHub Releases
- [ ] Update detectado e instalado no app existente
