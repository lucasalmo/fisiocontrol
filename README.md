# FisioControl

Aplicação web para controle de sessões de fisioterapia e reabilitação: contador de dias desde a cirurgia, sessões, ciclos de pagamento, bônus, eventos, calendário, linha do tempo, importação do histórico em texto, estatísticas e backups.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind CSS 4 · ESLint · Neon PostgreSQL (`@neondatabase/serverless`) · Zod · Recharts · Lucide · Vitest.

---

## 1. Instalação

Requisitos: Node.js 22+ (o driver do Neon usa o `WebSocket` nativo) e uma conta no [Neon](https://neon.tech).

```bash
npm install
cp .env.example .env.local
```

## 2. Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Neon. |
| `APP_PASSWORD` | em produção | Senha de acesso à aplicação. |
| `SESSION_SECRET` | em produção | Segredo aleatório (32+ caracteres) que assina o cookie de sessão. |
| `TEST_DATABASE_URL` | não | Banco **descartável** para os testes de integração. |

### Como obter a `DATABASE_URL`

1. No console do Neon, abra o projeto → **Connect**.
2. Escolha o banco e o papel (role) e copie a *connection string* (pode ser a versão *pooled*).
3. Cole em `.env.local`:

```env
DATABASE_URL=postgresql://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

A conexão acontece **somente no servidor** (`lib/db/client.ts` importa `server-only`). Nunca use o prefixo `NEXT_PUBLIC_` nessa variável. `.env.local` está no `.gitignore`.

Gere o `SESSION_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Migrations

As migrations SQL versionadas ficam em `migrations/` e são aplicadas em ordem, cada uma em sua própria transação, com registro e checksum na tabela `schema_migrations`:

```bash
npm run db:migrate   # aplica as pendentes
npm run db:status    # lista aplicadas / pendentes
```

| Arquivo | Conteúdo |
|---|---|
| `0001_initial_schema.sql` | Tabelas, chaves, índices, triggers de integridade e a view `cycle_overview`. |
| `0002_seed_defaults.sql` | 13 categorias, marcos (30/60/90/180/365), configurações e a cirurgia em 31/03/2026. |
| `0003_cycle_overview_max_completed.sql` | Suporte a ciclos importados de histórico parcial. |
| `0004_cycle_extra_allowance.sql` | Sessões extras por ciclo (padrão 3: um ciclo de 40 aceita até a 43ª). |

Nunca edite uma migration já aplicada — crie uma nova (o script avisa se o checksum mudar).

Se a `DATABASE_URL` usar o endpoint *pooled* do Neon (`-pooler` no host), o script de migrations troca automaticamente para a conexão direta, recomendada para alterações de schema. A aplicação continua usando a conexão *pooled*.

## 4. Executar

```bash
npm run dev          # desenvolvimento: http://localhost:3000
npm run build        # build de produção
npm start            # servir o build
```

## 5. Qualidade

```bash
npm run lint         # ESLint
npm run typecheck    # tipos gerados das rotas + tsc --noEmit
npm test             # Vitest
```

Os testes de integração com banco (`tests/db.integration.test.ts`) só rodam quando `TEST_DATABASE_URL` aponta para um banco **descartável** — o schema `public` desse banco é apagado e recriado. Crie um *branch* separado no Neon para isso. Sem a variável, esses testes são ignorados.

```bash
TEST_DATABASE_URL=postgresql://...branch-de-teste... npm test
```

<details>
<summary>Testar contra um Postgres local (opcional)</summary>

O driver do Neon fala WebSocket; para usar um Postgres local é preciso o proxy oficial:

```bash
docker network create fisio-net
docker run -d --rm --name fisio-pg --network fisio-net -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine
docker run -d --rm --name fisio-wsproxy --network fisio-net -e APPEND_PORT=fisio-pg:5432 -e ALLOW_ADDR_REGEX='.*' -p 55433:80 ghcr.io/neondatabase/wsproxy:latest
docker exec fisio-pg psql -U postgres -c "CREATE DATABASE fisio_test"

NEON_LOCAL_WSPROXY=localhost:55433/v1 \
TEST_DATABASE_URL=postgres://postgres:postgres@fisio-pg:5432/fisio_test npm test
```

`NEON_LOCAL_WSPROXY` é só para desenvolvimento/testes; não defina em produção.
</details>

---

## Funcionalidades

- **Contador desde a cirurgia** — calculado a partir de duas datas de calendário (nunca de um cronômetro). Dia da cirurgia = dia 0 decorrido; a contagem inclusiva aparece separada como “Nº dia do calendário pós-operatório”. Mostra semanas + dias, meses + dias, marcos alcançados, próximo marco e dias restantes. Atualiza sozinho à meia-noite local e ao voltar para a aba. Data futura mostra “dias para a cirurgia”.
- **Sessões** — CRUD, conclusão/reabertura em um clique (atualização otimista), busca, filtros por status/categoria/ciclo/período, ordenação, paginação e exportação CSV. Número no ciclo independente do status; número global atribuído uma vez e nunca renumerado. Número duplicado gera erro com sugestão do próximo livre, aplicada só com confirmação.
- **Ciclos e pagamentos** — registrar pagamento abre um ciclo novo numa transação, sem tocar nos anteriores. Limite configurável por ciclo (padrão 40). Exclusão só de ciclos vazios.
- **Sessões extras** — cada ciclo aceita sessões além do limite pago sem precisar de bônus (padrão 3: até a 43ª sessão num ciclo de 40). Saldo e progresso continuam calculados sobre o limite pago (40 + bônus); as sessões acima dele aparecem como “excedentes”. O valor é gravado em cada ciclo ao ser criado (alterar o padrão nas configurações não muda ciclos antigos) e pode ser editado por ciclo.
- **Bônus** — cada bônus é uma linha; o limite total é sempre `limite inicial + SOMA(bônus)`, calculado pela view, portanto nunca é contado duas vezes.
- **Eventos** — cirurgia, feriado, pausa, retorno e personalizado (pagamento e bônus têm fluxo próprio). Eventos nunca viram sessões. Editar a cirurgia de referência move o contador.
- **Linha do tempo** e **calendário** — sessões, cirurgia, pagamentos, bônus e eventos, com filtros por tipo/período, cores por categoria, navegação por teclado no calendário e cadastro direto a partir de uma data.
- **Importação do histórico** — parser em `lib/parsers/history.ts` (independente da UI, com testes). Prévia no servidor sem gravar nada, edição e exclusão de linhas, avisos de dia da semana incorreto, datas inválidas, viradas de ano, duplicatas e limite de ciclo. Gravação em transação única; repetir a importação não duplica nada.
- **Estatísticas** — sessões por mês/semana (média móvel), frequência por categoria, dia da semana, categorias × mês, categorias recentes, intervalos entre sessões, histórico por ciclo. Cada gráfico tem visualização em tabela. Apenas sessões concluídas entram nos indicadores.
- **Configurações** — data da cirurgia, marcos personalizados, limite padrão, fuso horário, categorias (criar, renomear, desativar/reativar, excluir só se sem uso, frequência de uso), tema claro/escuro/sistema, exportação JSON/CSV e restauração de backup (em banco vazio, ou substituição total com confirmação digitada “SUBSTITUIR”).

### Regras de integridade no banco

- `UNIQUE (cycle_id, number_in_cycle)` e `UNIQUE (global_number)`.
- Trigger impede sessão com número acima do máximo do ciclo (base + bônus + extras); outro trigger impede reduzir o limite, as extras ou remover um bônus já em uso.
- `ON DELETE RESTRICT` protege ciclos e categorias com sessões.
- Datas de calendário em `DATE` (lidas como texto `AAAA-MM-DD`, sem conversão de fuso); instantes em `TIMESTAMPTZ`.
- Chaves de importação (`import_key`) garantem idempotência.

### Regras de importação (resumo)

| Linha | Interpretação |
|---|---|
| `[✓] 17 - Sexta 16/10 - Adaptado explosão` | Sessão 17 concluída, categoria reconhecida sem depender de acento/maiúsculas. |
| `[ ] 18 - Segunda 19/10` | Sessão pendente sem categoria. |
| `[ ] ====== Cirurgia dia 31/03 ======` | Evento de cirurgia. |
| `[ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====` | Novo ciclo com limite 40; a numeração local reinicia. |
| `[ ] => Sexta 05/06 => Feriado` | Feriado (não é sessão). |
| `[ ] => Ganhei 3 sessões por zerar o eletro` | Bônus de 3 sessões no ciclo corrente (sem data: usa a da linha anterior, com aviso). |
| `[ ] 19 -` | Sessão pendente sem data: aparece na prévia com aviso e não é importada (agende depois pelo app). |

O **ano de referência** é o ano da primeira data sem ano. Depois disso, o ano avança pela ordem cronológica; cada virada é sinalizada (como informação, se confirmada pelo dia da semana; como aviso, se não). Datas com ano explícito (`16/10/2026`) também são aceitas. Categorias desconhecidas curtas podem ser criadas automaticamente (opção na tela).

**Histórico parcial:** se um ciclo começa no meio (ex.: sessões 35–41), os números abaixo do maior registrado contam como já utilizados no saldo do ciclo, e a tela informa isso.

---

## Segurança

- Autenticação por senha única (`APP_PASSWORD`) com cookie `httpOnly` assinado por HMAC (`SESSION_SECRET`), válido por 30 dias.
- O `proxy.ts` faz o redirecionamento otimista para `/login`; a verificação real ocorre **no servidor** em toda página (`load()`), Server Action (`runAction()`) e Route Handler de exportação.
- Em desenvolvimento, sem `APP_PASSWORD`, o acesso é liberado com um aviso visível. Em produção, sem a configuração, todo acesso é negado.
- Consultas sempre parametrizadas; erros do banco são convertidos em mensagens seguras e logs omitem a string de conexão.
- CSV exportado neutraliza fórmulas de planilha.

**Limitações de segurança:** há um único usuário (sem contas/perfis), não existe limitação de tentativas por IP além de um atraso fixo no login, e o logout não invalida cookies já emitidos (troque `SESSION_SECRET` para invalidar todas as sessões). Para uso público, coloque a aplicação atrás de HTTPS.

## Estrutura

```text
app/
  (app)/            páginas autenticadas (painel, sessões, ciclos, calendário, linha do tempo, eventos, estatísticas, importar, configurações)
  api/export/       backup JSON e CSV de sessões
  login/            tela de acesso
components/         UI por domínio (dashboard, sessions, cycles, events, calendar, timeline, charts, import, settings, ui)
features/           regras de negócio e Server Actions (surgery, cycles, sessions, events, import, statistics, settings, auth)
lib/
  db/               cliente Neon, erros, repositórios (acesso a dados)
  parsers/          parser do histórico em texto
  dates/            datas de calendário e formatação pt-BR
  auth/ actions/ validation/ data/ utils/
hooks/  types/  migrations/  scripts/  tests/
```

## Limitações conhecidas

- Usuário único; não há multiusuário.
- O fuso horário de “hoje” no servidor vem das configurações (padrão `America/Sao_Paulo`); o contador no navegador usa o fuso local do dispositivo.
- Números globais de sessões importadas seguem a ordem da importação; importar um histórico antigo depois de sessões novas gera números globais fora da ordem cronológica (nunca são renumerados).
- O seletor de data usa o controle nativo do navegador, que exibe DD/MM/AAAA conforme o idioma do sistema.
- Estatísticas são indicadores de frequência, não avaliação clínica; marcos são indicadores temporais, não garantias de recuperação.
