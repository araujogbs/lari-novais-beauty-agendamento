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
- **Dados do atendimento:** nome, WhatsApp (com máscara) e endereço.
- **Descrição obrigatória** de como a cliente quer o serviço.
- **Fotos de referência opcionais:** até 5 imagens (JPG, PNG ou WebP, 5 MB cada), com miniaturas e botão para remover.
- **Meus Agendamentos:** a cliente digita o WhatsApp, vê os agendamentos futuros confirmados e pode cancelar (com pelo menos 24 h de antecedência).

### Maquiadora (Painel Ateliê)
Acesso escondido: **toque longo de 4 segundos** no título da tela inicial, seguido de login (usuário e senha).
- Lista de atendimentos por dia, com serviço, horário, WhatsApp, endereço, descrição do pedido e **fotos de referência**.
- **Atalho do WhatsApp:** abre a conversa com uma mensagem de confirmação pronta.
- **Atalho do mapa:** abre o endereço no Google Maps (só aparece se houver endereço).
- **Desmarcar** um atendimento.
- **Bloquear agenda** (dia inteiro ou intervalo de horas, com motivo) e **desbloquear**.
- Sessão por JWT; ao expirar, o app volta para o login.

### Automações
- Confirmação por **WhatsApp** após o agendamento.
- Criação do evento no **Google Calendar** com nome, telefone, endereço, descrição, quantidade de fotos e valor.

---

## Estrutura do repositório

```
AgendamentoAPI/
├── AgendamentoApi/                  # Backend .NET
│   ├── Controllers/
│   │   ├── AppointmentsController.cs  # Agendamentos, horários, bloqueios, fotos, "meus agendamentos"
│   │   ├── AuthController.cs          # Login do administrador (JWT)
│   │   ├── ServicesController.cs      # Catálogo de serviços
│   │   └── WeatherForecastController.cs  # Sobra do template do .NET
│   ├── Data/AppDbContext.cs
│   ├── DTOs/
│   │   ├── CreateAppointmentDto.cs    # Criação (multipart: dados + imagens)
│   │   ├── BlockSlotDto.cs            # Bloqueio de agenda
│   │   └── MyAppointmentDto.cs        # Resposta enxuta da cliente + ClientCancelDto
│   ├── Models/                        # Appointment, ServiceItem
│   ├── Services/                      # WhatsApp e Google Calendar (interface + implementação)
│   ├── Migrations/                    # Histórico do banco
│   ├── uploads/                       # Fotos enviadas (criada em runtime, fora do Git)
│   └── Program.cs                     # CORS, JWT, EF Core, injeção de dependência
└── agendamento-mobile/              # App Expo
    ├── App.tsx                        # Telas e fluxo (cliente, login e painel admin)
    ├── src/services/api.ts            # Axios com o token JWT no header
    ├── src/services/auth.ts           # Login e armazenamento do token (AsyncStorage)
    └── assets/                        # Imagem de fundo, ícones
```

---

## Regras de negócio

- **Expediente:** 09:00 às 18:00, fuso de Brasília (`America/Sao_Paulo`). Tudo é gravado em **UTC** no banco e convertido na entrada e na saída.
- **Sem sobreposição de horários.** A regra é garantida em duas camadas:
  1. consulta no código (`InicioNovo < FimExistente` e `FimNovo > InicioExistente`);
  2. **constraint de exclusão do PostgreSQL** (`no_overlapping_appointments`, índice GiST com `tstzrange`), que impede conflito mesmo com duas marcações simultâneas. Nesse caso a API responde `409`.
- Agendamentos **cancelados** não ocupam horário.
- **Bloqueios** são gravados como agendamentos de status `Blocked`, então os horários somem da lista de livres automaticamente. Só é possível bloquear onde não há agendamento.
- Duração do atendimento vem do serviço; o fim é calculado como `início + duração`.
- **Descrição** é obrigatória (até 1000 caracteres); **fotos** são opcionais (máx. 5, 5 MB cada).
- **Cancelamento pela cliente:** só com **mais de 24 h** de antecedência. Com menos, a API devolve `400` orientando a cancelar pelo WhatsApp.
- Status usados: `Confirmed`, `Cancelled`, `Blocked`.

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
| ReferenceImages | text[] | Nomes dos arquivos em `uploads/` |
| ServiceItemId | int | FK para o serviço |
| StartTime / EndTime | timestamptz | UTC |
| Status | string | `Confirmed`, `Cancelled` ou `Blocked` |
| CreatedAt | timestamptz | |

**Migrations:** criação das tabelas, endereço, `ClientAddress` opcional, constraint anti-sobreposição e `Description`/`ReferenceImages`.

---

## Referência da API

Base: `http://<IP>:5102/api`. A documentação interativa (Swagger) fica em `/swagger`, só em ambiente de desenvolvimento.

### Serviços
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/services` | Público | Lista serviços ativos |
| GET | `/services/{id}` | Público | Busca um serviço |
| POST | `/services` | Público ⚠️ | Cadastra serviço (veja [Limitações](#limitações-conhecidas-e-próximos-passos)) |

### Autenticação
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/login` | Público | Body `{ "Username", "Password" }`. Devolve `{ token }` (JWT válido por 2 h). `401` se inválido, `503` se o admin não estiver configurado |

### Agendamentos
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/appointments/available-slots?date=AAAA-MM-DD&serviceId=1` | Público | Horários livres (`["09:00","09:30",...]`) |
| POST | `/appointments` | Público | Cria agendamento. **`multipart/form-data`**: `clientName`, `clientPhone`, `clientAddress`, `description` (obrigatório), `serviceItemId`, `startTime` (ISO 8601 com offset/UTC) e `images` (0 a 5 arquivos). `409` se o horário estiver ocupado |
| GET | `/appointments/my-appointments?phone=` | Público | Agendamentos futuros confirmados daquele telefone |
| POST | `/appointments/{id}/client-cancel` | Público | Body `{ "phone": "..." }`. Cancela se o telefone bater e faltar mais de 24 h |
| GET | `/appointments?date=AAAA-MM-DD` | Admin | Lista os agendamentos do dia (inclui bloqueios) |
| PATCH | `/appointments/{id}/status` | Admin | Muda o status (body: string JSON, ex.: `"Cancelled"`) |
| POST | `/appointments/block-slot` | Admin | Bloqueia agenda: `{ date, startTime?, endTime?, reason? }` (sem horários = expediente todo) |
| GET | `/appointments/images/{arquivo}` | Admin | Serve uma foto de referência |

Rotas de admin exigem o header `Authorization: Bearer <token>`.

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
| `GoogleCalendar:CredentialsJsonPath` / `GoogleCalendar:CalendarId` | Não | Sem isso, o evento só aparece no log (simulação) |

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

---

## Limitações conhecidas e próximos passos

- **"Meus Agendamentos" usa só o telefone como prova de identidade.** Quem souber o WhatsApp de uma cliente vê e cancela os agendamentos dela. Para endurecer: código de verificação por SMS/WhatsApp e/ou limite de tentativas por IP.
- **`POST /api/services` é público:** qualquer um pode cadastrar serviços. Deveria exigir `[Authorize(Roles = "Admin")]`.
- **CORS liberado para qualquer origem** (`AllowAll`) — restrinja antes de ir para produção.
- **Sem HTTPS** no fluxo de desenvolvimento (HTTP simples na rede local). Em produção, use HTTPS.
- Cancelar um atendimento **não remove** o evento do Google Calendar.
- O texto da confirmação por WhatsApp pede para "responder esta mensagem" para desmarcar; vale atualizá-lo para citar o app (**Meus Agendamentos**).
- O IP da API está fixo em `src/services/api.ts`; o ideal é usar variável de ambiente do Expo.
- Fotos ficam em disco local (`uploads/`); em produção, considere armazenamento em nuvem e backup.
- Horário de verão não é tratado no app (o fuso fixo `-03:00` é usado ao montar o horário); a API usa o fuso real de São Paulo.
- `WeatherForecastController` é resto do template e pode ser removido.
- Ideias: lembrete automático (24 h antes), reagendamento, cadastro de serviços pelo painel, notificações push para a maquiadora.
