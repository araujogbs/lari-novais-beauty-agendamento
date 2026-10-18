# Lari Novais Beauty — Agendamento de Maquiagem a Domicílio

Sistema completo de agendamento para uma maquiadora que atende a domicílio: a **cliente** escolhe o serviço, o dia e o horário, descreve o que deseja e anexa fotos de referência; a **maquiadora** gerencia tudo por um painel protegido por login.

- **Backend:** ASP.NET Core Web API (.NET 10), Entity Framework Core e PostgreSQL
- **Mobile:** React Native + Expo (SDK 57), TypeScript e Axios
- **Integrações:** WhatsApp (confirmação) e Google Calendar (evento automático) — ambas rodam em modo simulação até serem configuradas

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Estrutura do repositório](#estrutura-do-repositório)
3. [Regras de negócio](#regras-de-negócio)
4. [Modelo de dados](#modelo-de-dados)
5. [Referência da API](#referência-da-api)
6. [Configuração e segredos](#configuração-e-segredos)
7. [Como rodar](#como-rodar)
8. [Testando no celular](#testando-no-celular)
9. [Segurança](#segurança)
10. [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)

---

## Funcionalidades

### Cliente
- **Escolha do serviço**, com duração e preço.
- **Calendário em português** e horários livres calculados na hora, em blocos de 30 minutos.
- **Dados do atendimento:** nome, WhatsApp (com máscara), **CEP** (máscara `00000-000`), endereço e número/complemento.
- **Taxa de deslocamento automática:** ao digitar o CEP, o app preenche rua e bairro e mostra a distância até o ateliê e a taxa (ou "deslocamento gratuito"). A taxa é somada ao valor total.
- **Descrição obrigatória** de como a cliente quer o serviço.
- **Fotos de referência opcionais:** até 5 imagens (JPG, PNG ou WebP, 5 MB cada), com miniaturas e botão para remover.
- **Meus Agendamentos:** a cliente digita o WhatsApp, vê os agendamentos futuros ("Em análise" ou "Confirmado") e pode cancelar (pedido em análise a qualquer momento; confirmado com mais de 24 h de antecedência).
- **Tela de agendamento concluído:** ao confirmar, a cliente vê o resumo e é levada (botão ou automaticamente após 6 s) para "Meus Agendamentos", já com o telefone preenchido.

### Maquiadora (Painel Ateliê)
Acesso escondido: **toque longo de 4 segundos** no título da tela inicial, seguido de login (usuário e senha). O mesmo painel existe no site, em `/#painel` (veja o README do Site).
- **Pedidos em análise** no topo do painel (de qualquer data), com **Aprovar** e **Recusar** (com motivo opcional). Só depois de aprovar a cliente recebe a confirmação e o evento vai para o Google Calendar.
- Lista de atendimentos por dia, com serviço, horário, WhatsApp, endereço, descrição do pedido e **fotos de referência**.
- **Atalho do WhatsApp:** abre a conversa com uma mensagem de confirmação pronta.
- **Atalho do mapa:** abre o endereço no Google Maps (só aparece se houver endereço).
- **Desmarcar** um atendimento confirmado.
- **Bloquear agenda** (dia inteiro ou intervalo de horas, com motivo) e **desbloquear**.
- Sessão por JWT; ao expirar, o app volta para o login.

### Automações
- **WhatsApp** em cada etapa: "pedido recebido, em análise" ao agendar; confirmação ao aprovar; aviso (com o motivo) ao recusar; aviso quando o pedido expira sem resposta. Opcionalmente, aviso de pedido novo para a maquiadora (`WhatsApp:OwnerPhone`).
- Criação do evento no **Google Calendar** ao **aprovar**, com nome, telefone, endereço, descrição, quantidade de fotos, valor e deslocamento.

---

## Estrutura do repositório

```
API e App/
├── AgendamentoApi/                  # Backend .NET
│   ├── Controllers/
│   │   ├── AppointmentsController.cs  # Agendamentos, horários, bloqueios, fotos, "meus agendamentos"
│   │   ├── AuthController.cs          # Login do administrador (JWT)
│   │   └── ServicesController.cs      # Catálogo de serviços
│   ├── Data/AppDbContext.cs
│   ├── DTOs/
│   │   ├── CreateAppointmentDto.cs    # Criação (multipart: dados + imagens)
│   │   ├── BlockSlotDto.cs            # Bloqueio de agenda
│   │   └── MyAppointmentDto.cs        # Resposta enxuta da cliente + ClientCancelDto
│   ├── Models/                        # Appointment, ServiceItem
│   ├── Services/
│   │   ├── TravelFeeService.cs        # CEP -> distância -> taxa de deslocamento
│   │   ├── WhatsAppService.cs         # Confirmação por WhatsApp (interface + implementação)
│   │   └── GoogleCalendarService.cs   # Evento no Google Calendar (interface + implementação)
│   ├── Migrations/                    # Histórico do banco
│   ├── uploads/                       # Fotos enviadas (criada em runtime, fora do Git)
│   ├── devlog.md                      # Diário de desenvolvimento
│   └── Program.cs                     # CORS, JWT, rate limit, EF Core, injeção de dependência
└── agendamento-mobile/              # App Expo
    ├── App.tsx                        # Raiz: navegação entre telas, aviso (toast) e visualizador de fotos
    ├── assets/                        # Imagem de fundo, ícones
    └── src/
        ├── screens/
        │   ├── WelcomeScreen.tsx        # Tela inicial (toque longo no título abre o painel)
        │   ├── booking/                 # Fluxo da cliente
        │   │   ├── BookingScreen.tsx      # Etapas e serviços
        │   │   ├── ServiceStep.tsx        # Etapa 1: lista de serviços
        │   │   ├── DetailsStep.tsx        # Etapa 2: dia, horário, dados e confirmação
        │   │   └── PeopleSelector · AddressSection · DescriptionSection · BookingTicket
        │   ├── SuccessScreen.tsx        # Agendamento concluído
        │   ├── MyAppointmentsScreen.tsx # Consulta e cancelamento pelo WhatsApp
        │   ├── AdminLoginScreen.tsx     # Login da maquiadora
        │   └── admin/                   # Painel Ateliê
        │       ├── AdminScreen.tsx        # Agenda do dia
        │       ├── AdminAppointmentCard.tsx
        │       └── BlockSchedule.tsx      # Bloqueio de dia ou intervalo
        ├── components/                # AppHeader, Toast, Lightbox, Stepper, Skeleton
        ├── hooks/                     # useToast, useBookingForm (estado do formulário)
        ├── services/
        │   ├── api.ts                 # Axios com o token JWT no header
        │   ├── auth.ts                # Login e armazenamento do token (AsyncStorage)
        │   └── appointments.ts        # Chamadas à API (cliente e painel)
        ├── utils/                     # Formatação, datas (fuso de Brasília), erros, links
        ├── styles/common.ts           # Estilos compartilhados entre telas
        ├── config/calendarLocale.ts   # Calendário em português
        └── theme.ts · constants.ts · types.ts
```

O site institucional fica em `../Site` e usa a mesma API (veja o [README do Site](../Site/README.md)).

---

## Regras de negócio

- **Expediente:** 06:00 às 22:00, fuso de Brasília (`America/Sao_Paulo`). Tudo é gravado em **UTC** no banco e convertido na entrada e na saída.
- **Sem sobreposição de horários.** A regra é garantida em duas camadas:
  1. consulta no código (`InicioNovo < FimExistente` e `FimNovo > InicioExistente`);
  2. **constraint de exclusão do PostgreSQL** (`no_overlapping_appointments`, índice GiST com `tstzrange`), que impede conflito mesmo com duas marcações simultâneas. Nesse caso a API responde `409`.
- **Todo agendamento novo nasce em análise** (`Pending`) e já **segura o horário**, para ninguém pedir o mesmo. A maquiadora aprova (`Confirmed`) ou recusa (`Rejected`).
- **Prazo de 3 dias** (`AppointmentStatus.PendingExpiration`): o `PendingExpirationService` roda ao subir a API e a cada 30 min, e passa para `Expired` os pedidos em análise criados há mais de 3 dias ou cujo horário já passou. O horário é liberado e a cliente recebe um aviso pelo WhatsApp. O painel mostra o prazo de cada pedido (`expiresAt`).
- Agendamentos **cancelados**, **recusados** e **expirados** não ocupam horário (lista `AppointmentStatus.FreeSlot`, a mesma da constraint do banco).
- **Bloqueios** são gravados como agendamentos de status `Blocked`, então os horários somem da lista de livres automaticamente. Só é possível bloquear onde não há agendamento.
- **A cliente escolhe o horário de início** (`startTime`). O servidor calcula o término somando a duração total: `término = startTime + duração do serviço × pessoas`. O atendimento inteiro precisa caber no expediente (se o término passar das 22:00, a API responde `400`). Os horários livres já vêm filtrados para isso.
- **Quantidade de pessoas (`People`):** o valor do serviço e a duração são multiplicados pelo número de pessoas; a taxa de deslocamento não.
- **Descrição** é obrigatória (até 1000 caracteres); **fotos** são opcionais (máx. 5, 5 MB cada).
- **Cancelamento pela cliente:** pedido em análise pode ser cancelado a qualquer momento; confirmado, só com **mais de 24 h** de antecedência. Com menos, a API devolve `400` orientando a cancelar pelo WhatsApp.
- **Taxa de deslocamento** (configurada em `TravelFee`, calculada no servidor a partir do CEP):
  - Os primeiros `FreeRadiusKm` (5 km) são isentos; acima disso, `(distância − 5) × R$ 3,00 por km × 2` (**ida e volta**), arredondado a 2 casas.
  - Coordenadas do CEP: **BrasilAPI** (`/api/cep/v2`), com fallback para **Nominatim/OpenStreetMap** quando vierem vazias.
  - Distância de carro: **OSRM**; se falhar ou passar de 3 s, usa Haversine × 1,3.
  - O `POST /appointments` recalcula a taxa a partir do `cep`; o valor enviado pelo app nunca é confiado.
- Status usados (constantes em `Models/AppointmentStatus.cs`): `Pending` (em análise), `Confirmed`, `Rejected`, `Expired` (3 dias sem resposta), `Cancelled`, `Blocked`.

---

## Modelo de dados

**ServiceItem** (`Services`)

| Campo | Tipo | Observação |
|---|---|---|
| Id | int | PK |
| Name | string | Ex.: "Maquiagem Social" |
| DurationMinutes | int | Duração do atendimento |
| Price | decimal | |
| IsActive | bool | Desativa sem apagar o histórico |

**Appointment** (`Appointments`)

| Campo | Tipo | Observação |
|---|---|---|
| Id | int | PK |
| ClientName | string | |
| ClientPhone | string | WhatsApp, salvo com máscara |
| ClientAddress | string? | Endereço do atendimento |
| Description | string? | Como a cliente quer o serviço |
| TravelFee | decimal? | Taxa de deslocamento (ida e volta) calculada pelo CEP |
| DistanceKm | double? | Distância até o ateliê, em km |
| ReferenceImages | text[] | Nomes dos arquivos em `uploads/` |
| ServiceItemId | int | FK para o serviço |
| People | int | Para quantas pessoas é o serviço (padrão 1) |
| StartTime / EndTime | timestamptz | UTC. `StartTime` é o início escolhido; `EndTime` é o término previsto, calculado |
| Status | string | `Pending`, `Confirmed`, `Rejected`, `Expired`, `Cancelled` ou `Blocked` |
| CreatedAt | timestamptz | |

**Migrations** (em ordem): `CriarTabelaServicos`, `CriarTabelaAgendamentos`, `AdicionarEnderecoAgendamento`, `AdicionarClientAddress`, `AdicionarConstraintSemSobreposicao` (anti-sobreposição), `AdicionarDescricaoEImagens` (`Description` e `ReferenceImages`), `AdicionarTaxaDeslocamento` (`TravelFee` e `DistanceKm`), `AdicionarQuantidadePessoas` (`People`), `AtualizarServicosSocial`, `AdicionarStatusPendente` (a constraint anti-sobreposição passa a ignorar também os recusados) e `AdicionarStatusExpirado` (e os expirados).

A migration `AtualizarServicosSocial` atualiza preços e durações dos serviços do Social, os mesmos mostrados no site:

| Serviço | Duração | Preço |
|---|---|---|
| Maquiagem | 60 min | R$ 350 |
| Penteado | 90 min | R$ 350 |
| Maquiagem + Penteado | 150 min | R$ 700 |
| Escova e Babyliss | 60 min | R$ 300 |

---

## Referência da API

Base: `http://<IP>:5102/api`. A documentação interativa (Swagger) fica em `/swagger`, só em ambiente de desenvolvimento.

### Serviços
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/services` | Público | Lista serviços ativos |
| GET | `/services/{id}` | Público | Busca um serviço |
| POST | `/services` | Admin | Cadastra serviço (o `Id` enviado é ignorado) |

### Autenticação
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/login` | Público (5/min por IP) | Body `{ "Username", "Password" }`. Devolve `{ token }` (JWT válido por 2 h). `401` se inválido, `503` se o admin não estiver configurado |

### Agendamentos
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/appointments/available-slots?date=AAAA-MM-DD&serviceId=1&people=1` | Público | Horários de **início** livres (`["10:00","10:30",...]`) em que a duração total (serviço × pessoas) cabe sem conflito até as 22:00. `people` é opcional (padrão 1, máx. 20) |
| POST | `/appointments` | Público (10 por 10 min por IP) | Cria agendamento. **`multipart/form-data`**: `clientName`, `clientPhone`, `clientAddress`, `description` (obrigatório), `serviceItemId`, `startTime` (ISO 8601 com offset/UTC: início do atendimento), `people` (1 a 20, padrão 1), `cep` (opcional, recalcula a taxa) e `images` (0 a 5 arquivos). `409` se o horário estiver ocupado |
| GET | `/appointments/estimate-fee?cep=` | Público (15/min por IP) | Rua, bairro, cidade, `distanceKm` e `travelFee` para o CEP. `400` CEP inválido, `404` não encontrado |
| GET | `/appointments/my-appointments?phone=` | Público (10/min por IP) | Agendamentos futuros confirmados daquele telefone |
| POST | `/appointments/{id}/client-cancel` | Público (10/min por IP) | Body `{ "phone": "..." }`. Cancela se o telefone bater e faltar mais de 24 h |
| GET | `/appointments?date=AAAA-MM-DD` | Admin | Lista os agendamentos do dia (inclui bloqueios) |
| GET | `/appointments/pending` | Admin | Pedidos futuros em análise, de qualquer data (cada um com `expiresAt`, o prazo para responder) |
| POST | `/appointments/{id}/approve` | Admin | Aprova um pedido em análise: vira `Confirmed`, envia a confirmação por WhatsApp e cria o evento no Google Calendar. `409` se não estiver mais em análise |
| POST | `/appointments/{id}/reject` | Admin | Recusa um pedido em análise (body opcional `{ "reason": "..." }`): vira `Rejected`, libera o horário e avisa a cliente. `409` se não estiver mais em análise |
| PATCH | `/appointments/{id}/status` | Admin | Desmarca um atendimento ou desfaz um bloqueio. Só aceita `"Cancelled"` (string JSON) |
| POST | `/appointments/block-slot` | Admin | Bloqueia agenda: `{ date, startTime?, endTime?, reason? }` (sem horários = expediente todo) |
| GET | `/appointments/images/{arquivo}` | Admin | Serve uma foto de referência |

Rotas de admin exigem o header `Authorization: Bearer <token>`.
Excedeu o limite de requisições por IP, a API responde `429`.

### Fotos de referência
- Salvas em `AgendamentoApi/uploads/` com nome aleatório (GUID); o nome original nunca é usado.
- O tipo é conferido pelos **primeiros bytes** do arquivo (JPEG, PNG, WebP), sem confiar em extensão ou Content-Type.
- Só a maquiadora logada acessa as fotos, pela rota protegida. Elas não ficam em pasta pública.
- Se o agendamento falhar (conflito ou erro de banco), as fotos já gravadas são apagadas.

---

## Configuração e segredos

Segredos **não** ficam no repositório. Em desenvolvimento use **User Secrets** (o projeto já tem `UserSecretsId`); em produção, variáveis de ambiente (`Chave__Subchave`).

| Chave | Obrigatória | Descrição |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | Sim | Conexão com o PostgreSQL |
| `Jwt:Key` | Sim | Chave de assinatura do JWT, **mínimo 32 bytes** (a API não sobe sem ela) |
| `Jwt:Issuer` / `Jwt:Audience` | Sim | Já definidos em `appsettings.json` (`AgendamentoApi`) |
| `Admin:Username` | Sim | Usuário do painel |
| `Admin:PasswordHash` | Sim | Hash da senha no formato do ASP.NET Identity (`PasswordHasher`). Nunca a senha em texto |
| `WhatsApp:ApiUrl` / `WhatsApp:ApiKey` | Não | Sem isso, a mensagem só aparece no log (simulação) |
| `WhatsApp:OwnerPhone` | Não | WhatsApp da maquiadora (ex.: `5511914834786`) para receber aviso de cada pedido novo |
| `GoogleCalendar:CredentialsJsonPath` / `GoogleCalendar:CalendarId` | Não | Sem isso, o evento só aparece no log (simulação) |
| `TravelFee:*` | Não | Já em `appsettings.json`: `OriginAddress`, `OriginCep`, `OriginLatitude`/`OriginLongitude`, `FreeRadiusKm` (5.0) e `PricePerKm` (3.00) |
| `Cors:AllowedOrigins` | Produção | Lista de origens de navegador permitidas (`Cors__AllowedOrigins__0`, `__1`...). Vazia fora de desenvolvimento = nenhuma origem liberada. O app mobile nativo não depende de CORS |

```bash
cd AgendamentoApi
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=agendamento;Username=postgres;Password=..."
dotnet user-secrets set "Jwt:Key" "uma-chave-aleatoria-com-pelo-menos-32-caracteres"
dotnet user-secrets set "Admin:Username" "lari"
dotnet user-secrets set "Admin:PasswordHash" "<hash gerado>"
```

**Gerando o `Admin:PasswordHash`:** num projeto de console temporário (fora do repositório), com o pacote `Microsoft.AspNetCore.Identity`:

```csharp
var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<string>();
Console.WriteLine(hasher.HashPassword("lari", "SUA_SENHA"));
```

O primeiro argumento (`"lari"`) deve ser igual ao `Admin:Username`.

---

## Como rodar

### Pré-requisitos
- .NET SDK 10
- PostgreSQL com extensão `btree_gist` (a migration cria com `CREATE EXTENSION IF NOT EXISTS`; o usuário do banco precisa de permissão para isso)
- Node.js e npm
- Ferramenta do EF Core: `dotnet tool install --global dotnet-ef`

### Backend
```bash
cd AgendamentoApi
dotnet ef database update          # aplica as migrations
dotnet run --launch-profile http   # sobe em http://0.0.0.0:5102
```
A API escuta em `0.0.0.0:5102` com CORS liberado, para o celular alcançá-la na rede local. Cadastre pelo menos um serviço (`POST /api/services` ou direto no banco) para a tela inicial ter o que listar.

### Mobile
```bash
cd agendamento-mobile
npm install
```
Edite `src/services/api.ts` e coloque o **IP da sua máquina** em `baseURL` (ex.: `http://192.168.0.2:5102/api`), e depois:
```bash
npx expo start --clear
```

Comandos úteis no app: `npx tsc --noEmit` (tipos) e `npx expo-doctor` (diagnóstico). Instale pacotes sempre com `npx expo install <pacote>`, para o Expo escolher a versão compatível.

---

## Testando no celular

1. PC e celular na **mesma rede Wi-Fi**.
2. Abra o **Expo Go** e escaneie o QR code (`exp://<IP-do-PC>:8081`).
3. No Windows, libere a porta da API no firewall (PowerShell como administrador):
   ```powershell
   New-NetFirewallRule -DisplayName "AgendamentoAPI 5102" -Direction Inbound -Protocol TCP -LocalPort 5102 -Action Allow -Profile Any
   ```
4. Para conferir a conexão, abra `http://<IP-do-PC>:5102/api/services` no navegador do celular. Deve aparecer um JSON.

**Problemas comuns**
- *"Não foi possível carregar os serviços"* — firewall bloqueando a 5102, IP errado em `api.ts`, ou API fora do ar. O app registra o motivo no terminal do Expo.
- *`Native module is null, cannot access legacy storage`* — versão do AsyncStorage incompatível com o Expo Go. O projeto usa a **2.2.0** (a que o Expo Go traz).
- *Build do .NET falha com "arquivo bloqueado"* — a API está rodando e trava o executável. Pare a API antes de compilar ou de rodar `dotnet ef`.
- *Erro de módulo nativo ao abrir o seletor de fotos* — faça um development build (`npx expo run:android` ou `eas build --profile development`).

---

## Segurança

Já implementado:
- Painel e rotas administrativas protegidos por **JWT** com papel `Admin` (validação de emissor, audiência, expiração e assinatura).
- Senha do admin guardada como **hash** (ASP.NET Identity), com comparação em tempo constante; a API recusa subir sem `Jwt:Key` forte.
- Upload de imagens validado por conteúdo, com limite de quantidade e tamanho. Os nomes são gerados no servidor, o que evita *path traversal*.
- Fotos das clientes só são servidas por rota autenticada.
- Cancelamento pela cliente devolve a **mesma resposta** para "não existe" e "telefone não confere", sem revelar agendamentos de terceiros.
- O app não registra senhas nem tokens nos logs.
- Segredos fora do Git (User Secrets e variáveis de ambiente).
- `POST /api/services` exige papel `Admin`; o `Id` enviado pelo cliente é ignorado.
- **Limite de requisições por IP** (`429`): login 5/min, consulta e cancelamento de agendamentos 10/min, criação de agendamentos 10 a cada 10 min. Dificulta força bruta de senha e a descoberta de telefones.
- **CORS restrito:** em produção só as origens de `Cors:AllowedOrigins`; liberado geral apenas em desenvolvimento, e só com os métodos e headers necessários.
- **HTTPS forçado em produção** (redirecionamento + HSTS) e headers `X-Content-Type-Options: nosniff` e `X-Frame-Options: DENY`.

---

## Limitações conhecidas e próximos passos

- **"Meus Agendamentos" usa só o telefone como prova de identidade.** O limite por IP dificulta, mas não impede, que alguém que saiba o WhatsApp de uma cliente veja e cancele os agendamentos dela. Para endurecer de vez: código de verificação por SMS/WhatsApp.
- **Em produção**, defina `Cors:AllowedOrigins` (se houver cliente web) e publique atrás de HTTPS (o redirecionamento exige que o servidor ou proxy exponha a porta HTTPS). Atrás de proxy reverso, configure `ForwardedHeaders` para o limite por IP enxergar o IP real da cliente.
- O cálculo de deslocamento depende de serviços gratuitos (BrasilAPI, Nominatim, OSRM público) sem garantia de disponibilidade; o OSRM público tem limites de uso, e em produção vale hospedar o próprio. Se o CEP não puder ser localizado, o agendamento segue sem taxa.
- Cancelar um atendimento **não remove** o evento do Google Calendar.
- O IP da API está fixo em `src/services/api.ts`; o ideal é usar variável de ambiente do Expo.
- Fotos ficam em disco local (`uploads/`); em produção, considere armazenamento em nuvem e backup.
- Horário de verão não é tratado no app (o fuso fixo `-03:00` é usado ao montar o horário); a API usa o fuso real de São Paulo.
- `GoogleCalendarService` usa `GoogleCredential.FromStream`, marcado como obsoleto pelo Google (aviso `CS0618` no build); migrar para `CredentialFactory` ao ligar a integração de verdade.
- Ideias: lembrete automático (24 h antes), reagendamento, cadastro de serviços pelo painel, notificações push para a maquiadora.
