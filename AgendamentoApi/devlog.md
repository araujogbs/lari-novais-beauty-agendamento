# 📓 Diário de Desenvolvimento (DEVLOG) - Agendamento API

## [2026-09-26] - Setup Inicial do Ambiente e ORM

### 🎯 Objetivo do Projeto
- Construir a API backend em **C# / .NET** para o aplicativo de agendamento de serviços de maquiagem.
- Estruturar uma arquitetura limpa com PostgreSQL, Entity Framework Core e regras de negócio para gestão de horários e clientes.

---

### 🛠️ O que foi feito hoje

1. **Inicialização do Projeto WebAPI:**
   - Executado o scaffold da API com controllers tradicionais:
     ```bash
     dotnet new webapi -n AgendamentoApi --use-controllers
     ```

2. **Adição dos Pacotes do Entity Framework Core (PostgreSQL):**
   - Instalado o conector oficial do PostgreSQL para .NET:
     ```bash
     dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
     ```
   - Instaladas as ferramentas de design para suporte a Migrations:
     ```bash
     dotnet add package Microsoft.EntityFrameworkCore.Design
     ```

---

### ⚠️ Problemas Encontrados & Como Foram Resolvidos

- **Erro:** `The application 'new' does not exist or is not a managed .dll or .exe. No .NET SDKs were found.`
- **Causa:** O terminal conseguia enxergar o runtime básico do .NET, mas o **.NET SDK** (Software Development Kit) não estava instalado / configurado nas variáveis de ambiente do Windows.
- **Solução:**
  - Identificada a necessidade de instalar o instalador completo do SDK (x64) em vez de apenas o runtime.
  - Verificada a precedência do path em `C:\Program Files\dotnet\` para evitar conflito com versões de 32 bits (x86).
  - Após a instalação do SDK e reinicialização do terminal, o comando `dotnet new` funcionou normalmente.

---

### 💡 Aprendizados Técnicos

- **Diferença entre Runtime e SDK:** O runtime apenas executa binários já compilados; para criar projetos (`new`), compilar (`build`) e gerenciar pacotes/ferramentas (`add package`, `ef migrations`), o SDK é mandatório.
- **Divisão do Entity Framework Core:**
  - `Npgsql.EntityFrameworkCore.PostgreSQL`: É o *database provider*, responsável por traduzir as queries LINQ em SQL compatível com a sintaxe do PostgreSQL.
  - `Microsoft.EntityFrameworkCore.Design`: Contém a lógica usada em tempo de desenvolvimento para inspecionar os modelos e gerar os arquivos de migration que alteram o schema do banco.

---

### 📌 Próximos Passos
- [ ] Configurar a string de conexão do PostgreSQL no `appsettings.json`.
- [ ] Criar as primeiras entidades/Models (`Cliente`, `Servico`, `Agendamento`).
- [ ] Configurar o `AppDbContext` e registrar no container de injeção de dependência (`Program.cs`).

## [2026-09-26] - Banco de Dados, Migrations e Tabela de Serviços

### 🛠️ O que foi feito:
- Instalado e configurado o PostgreSQL local na porta padrão `5432`.
- Ajustada a string de conexão no `appsettings.json` com as credenciais do banco.
- Corrigida a ordem de injeção de dependência no `Program.cs` (serviços registrados estritamente antes do `builder.Build()`).
- Criada e aplicada a primeira Migration (`CriarTabelaServicos`).
- Executado o `dotnet ef database update` criando o banco `agendamento_db` e a tabela `Services`.

### 💡 Aprendizados Técnicos:
- **Ciclo de vida do ASP.NET Core:** Todo registro no container de DI (`builder.Services`) deve ocorrer antes da compilação do host com `builder.Build()`.
- **Comportamento do EF Core ao criar banco:** Na primeira execução do `database update`, o EF tenta conectar diretamente no banco alvo. Ao receber a recusa de que ele não existe, ele utiliza o banco padrão para emitir o `CREATE DATABASE` e prosseguir com o schema.
- **Tabela `__EFMigrationsHistory`:** É a tabela interna que o EF Core cria para saber exatamente quais migrations já foram rodadas naquela instância, evitando recriações duplicadas.

## [2026-10-01] - Integração do WhatsAppService e Correção de Duplicação no EF Core

### 🛠️ O que foi feito:
- Criada a interface `IWhatsAppService` e sua implementação para disparos de confirmação de agendamentos com mensagens personalizadas.
- Registrado o serviço no container de injeção de dependência do ASP.NET Core e integrado ao fluxo assíncrono do `AppointmentsController`.
- Identificado e resolvido o erro `23505 (PK_Appointments: chave duplicada)` causado pela chamada duplicada de `Add()` e `SaveChangesAsync()`.
- Testado com sucesso o fluxo completo de agendamento: validação de conflito de horários via PostgreSQL, persistência na tabela `Appointments` e simulação de envio da notificação via console.

### 💡 Aprendizados Técnicos:
- **Rastreamento de Entidades no EF Core:** Após o primeiro `SaveChangesAsync()`, o EF Core atribui o `Id` gerado pelo banco ao objeto em memória. Invocar `.Add()` novamente na mesma instância força uma tentativa de insert com ID já existente, violando a restrição de chave primária (`PK`).
- **Arquitetura de Notificações Desacoplada:** O uso de interfaces (`IWhatsAppService`) permite testar em ambiente de desenvolvimento sem custos ou risco de bloqueios via mock/simulação em log, possibilitando trocar facilmente pela API oficial ou gateway de mensageria em produção sem alterar o controller.

## [2026-10-01] - Conectividade de Rede, Correção no EF Core e Arquitetura de Produção

### 🛠️ O que foi feito hoje

1. **Configuração de Rede e Conectividade Local:**
   - Ajustado o binding do Kestrel no ficheiro `Properties/launchSettings.json` de `localhost` para `0.0.0.0:5102`, viabilizando o consumo da API por dispositivos externos na mesma rede local Wi-Fi.
   - Configurada a política global de CORS no `Program.cs` para permitir requisições a partir do navegador em desenvolvimento (`localhost:8081`).
   - Desativada a diretiva `app.UseHttpsRedirection()` em ambiente local para evitar rejeições de certificados autoassinados por clientes HTTP e browsers.
   - Padronizada a `baseURL` do Axios no frontend (`src/services/api.ts`) apontando para o protocolo HTTP com a porta ativa e o prefixo `/api`.

2. **Correção de Persistência no Entity Framework Core:**
   - Diagnosticada e eliminada a falha de chave primária duplicada na criação de agendamentos (`Npgsql.PostgresException 23505`).
   - Removida a chamada duplicada de `_context.Appointments.Add(appointment)` e `await _context.SaveChangesAsync()` dentro do método `CreateAppointment`.

3. **Validação do Fluxo de Agendamentos e Notificações:**
   - Confirmada a validação de sobreposição de horários via PostgreSQL com `SELECT EXISTS`.
   - Inserção relacional efetuada com sucesso na tabela `Appointments` com retorno do identificador sequencial gerado pelo banco.
   - Acionado o serviço desacoplado `IWhatsAppService`, simulando o envio da mensagem personalizada com nome da cliente, serviço, data e hora formatados.

4. **Alinhamento de Domínio e Segurança da Aplicação:**
   - Identificada a necessidade de suporte a atendimento a domicílio através do campo `clientAddress`, alinhando a tipagem TypeScript (`AppointmentItem`) com os modelos e DTOs do backend.
   - Conduzida a análise de segurança do painel administrativo, definindo a migração de proteção baseada em telas do frontend para autenticação profissional com tokens JWT (`Microsoft.AspNetCore.Authentication.JwtBearer`) e anotações `[Authorize]` nos endpoints sensíveis da API.

---

### ⚠️ Problemas Encontrados & Como Foram Resolvidos

- **Erro:** `AxiosError: Network Error` ao consumir os endpoints no navegador ou dispositivo físico.
- **Causa:** O middleware de redirecionamento HTTPS forçava códigos `307/308` rejeitados pelo cliente de desenvolvimento, associado ao facto de o servidor .NET escutar exclusivamente no loopback (`localhost`), rejeitando chamadas direcionadas ao IP local.
- **Solução:** Configurado o endereço `http://0.0.0.0:5102` nas configurações de arranque e comentada a linha `app.UseHttpsRedirection()` durante os testes de desenvolvimento.

- **Erro:** `Npgsql.PostgresException (0x80004005): 23505: duplicar valor da chave viola a restrição de unicidade "PK_Appointments"`.
- **Causa:** O controlador executava duas vezes consecutivas o bloco `.Add()` e `.SaveChangesAsync()`. Após a primeira execução, a entidade recebia o `Id` gerado pelo banco; na segunda chamada, o EF Core tentava emitir um `INSERT` forçando a mesma chave primária já existente.
- **Solução:** Removidas as instruções redundantes no `AppointmentsController.cs`, mantendo um único ciclo de persistência por requisição.

- **Erro:** `Property 'clientAddress' does not exist on type 'AppointmentItem'.ts(2339)`.
- **Causa:** O componente tentava aceder ao endereço do agendamento sem que o contrato estivesse declarado na interface TypeScript correspondente.
- **Solução:** Adicionada a propriedade `clientAddress?: string` na interface do frontend e mapeada a necessidade da respetiva migration no EF Core.

---

### 💡 Aprendizados Técnicos

- **Escuta em Todas as Interfaces (`0.0.0.0` vs `localhost`):** O binding em `localhost` isola o tráfego estritamente à máquina anfitriã. Para permitir que telemóveis ou clientes na mesma rede local alcancem o servidor de desenvolvimento, a aplicação deve escutar em `0.0.0.0`.
- **Rastreamento de Estado no EF Core:** O Entity Framework Core monitoriza o ciclo de vida das instâncias anexadas. Após persistir um novo registo, ele preenche a propriedade chave com o valor devolvido pela base de dados. Tentar readicionar a mesma entidade resulta numa operação com chave explícita duplicada.
- **Princípio da Responsabilidade em Segurança de APIs:** Validações de acesso e permissões de perfil executadas apenas no cliente (frontend) são vulneráveis a bypass direto. A integridade dos dados e o controlo de acesso a informações de clientes e agendas devem ser garantidos no backend através de tokens assinados (JWT) e autorização por roles.

---

### 📌 Próximos Passos
- [ ] Adicionar o campo `ClientAddress` na entidade `Appointment.cs` e no DTO de criação.
- [ ] Criar e aplicar a migration `AdicionarClientAddress` via EF Core no PostgreSQL.
- [ ] Implementar a autenticação com JWT no ASP.NET Core (`Microsoft.AspNetCore.Authentication.JwtBearer`).
- [ ] Proteger os endpoints administrativos de listagem e cancelamento com o atributo `[Authorize(Roles = "Admin")]`.
- [ ] Configurar interceptores no Axios para transmissão automática do Bearer Token seguro no app mobile.
## [2026-10-18] - Organização do projeto e divisão do App.tsx

### 🛠️ O que foi feito
- Os READMEs foram atualizados: preços do Social alinhados (Maquiagem R$ 350, Penteado R$ 350, Maquiagem + Penteado R$ 700, Escova e Babyliss R$ 300), caminhos entre os projetos corrigidos e estrutura de pastas refeita.
- O `App.tsx` do app (cerca de 2.000 linhas) foi dividido em `src/screens`, `components`, `hooks`, `services`, `utils`, `styles` e `theme`. Mesmo comportamento: o `App.tsx` ficou só com a navegação entre telas.
- As chamadas à API do app foram reunidas em `src/services/appointments.ts`.
- Removidos `WeatherForecastController` e `WeatherForecast.cs` (resto do template do .NET) e atualizado o `AgendamentoApi.http`.
- `CLAUDE.md` e `AGENTS.md` do app corrigidos (o projeto não usa Expo Router).
- Agendamentos passam a nascer **em análise** (`Pending`), com aprovar/recusar no painel (app e site) e a cliente escolhendo o horário de **início**.
- **Prazo de 3 dias** para pedidos em análise: o `PendingExpirationService` expira os parados (status `Expired`, migration `AdicionarStatusExpirado`), libera o horário e avisa a cliente. Aprovar, recusar e expirar usam `UPDATE ... WHERE Status = 'Pending'`, para um não sobrescrever o outro.
- Corrigido o "hoje" do app (`todayISO`), que usava a data em UTC e virava o dia seguinte a partir das 21h; o site passou a usar Brasília também.

### 💡 Histórico que este diário não cobre (de 02/10 a 16/10)
Pelas migrations e pelo README: endereço do atendimento, autenticação JWT e painel protegido, constraint de exclusão contra horários sobrepostos, descrição e fotos de referência, taxa de deslocamento por CEP (BrasilAPI, OSRM e Nominatim), quantidade de pessoas, horário "pronta às" e atualização dos serviços do Social.

### 📌 Próximos Passos
- [ ] Publicar: API com HTTPS, `.env.production` do site, CORS com o domínio do site, serviços cadastrados no banco de produção.
- [ ] Ligar de verdade o WhatsApp e o Google Calendar (hoje só simulação em log).
- [ ] Tirar `public/fotos/` (144 MB) do build do site.
- [ ] Mover o IP da API do app (`src/services/api.ts`) para variável de ambiente do Expo.

## [2026-10-19] - Preparação para produção e calendário de disponibilidade

### 🛠️ O que foi feito
- **Deploy:** `Dockerfile` da API e pasta `deploy/` com `docker-compose` (PostgreSQL + API + Caddy com HTTPS automático), `.env.example`, `seed-servicos.sql` e `backup.sh`.
- **Proxy reverso:** fora de desenvolvimento a API usa `UseForwardedHeaders`. Sem isso, atrás do Caddy todo mundo teria o IP do proxy e dividiria a mesma cota do rate limiting (5 logins por minuto para o site inteiro).
- **Fotos em volume:** a pasta de uploads vem de `Storage:UploadsPath` (no Docker, `/data/uploads`), para não sumir a cada deploy.
- **Migrations ao subir** com `Database:MigrateOnStartup` e rota `GET /health` para monitoramento.
- **Novo endpoint `GET /appointments/availability`:** quantos horários livres há em cada dia de um período, numa consulta só. Alimenta o calendário do site (dias livres, últimos horários e lotados).
- O cálculo de horários foi extraído para `ComputeSlots` (usado pelos dois endpoints) e passou a **pular horários que já passaram**.

### 💡 Aprendizados Técnicos
- Atrás de proxy, `RemoteIpAddress` é o IP do proxy. O `ForwardedHeadersOptions` só confia em proxies conhecidos (por padrão, o loopback); no Docker o Caddy está em outra rede, então foi preciso limpar `KnownIPNetworks`/`KnownProxies`, o que só é seguro porque a porta da API não é exposta.

### 📌 Próximos Passos
- [ ] Contratar domínio e VPS e seguir o `deploy/README.md`.
- [ ] Recusar `startTime` no passado também no `POST /appointments`.
- [ ] Ajustar o `WhatsAppService` ao formato da Evolution API v2 ao ligar o WhatsApp.

## [2026-10-20] - API em produção

### 🛠️ O que foi feito
- **VPS no ar** (Ubuntu 24.04): usuário `deploy` só com chave SSH, root e senha desligados, firewall (22, 80, 443), fail2ban, atualizações de segurança automáticas, swap e logs do Docker rotacionados. Passo a passo em `deploy/README.md`.
- **API, PostgreSQL e Caddy** rodando em `https://api.larinovaisbeauty.com.br`, com certificado Let's Encrypt, os 4 serviços cadastrados e backup diário às 03:00.
- **`deploy/set-admin-password.sh`:** a senha do Painel é digitada no servidor sem aparecer e só o hash (Identity v3, PBKDF2-SHA512) vai para o `.env`. O formato foi conferido contra o `PasswordHasher` do ASP.NET.
- **Taxa de deslocamento corrigida:** a BrasilAPI devolve o centro de São Paulo para todos os CEPs da cidade, e todo endereço saía com 6,5 km. Agora a rua é localizada no Nominatim (busca estruturada, com cache por CEP).
- **R$ 5,00 por km** e logs sem cada consulta SQL em produção.
- **Teste de ponta a ponta** no site publicado: serviços, calendário, horários, taxa e confirmação, com o agendamento de teste apagado depois.

### 💡 Aprendizados Técnicos
- O Caddy tenta emitir o certificado assim que sobe. Antes do DNS apontar, isso gasta tentativas do Let's Encrypt; por isso, sem DNS, suba só `db` e `api`.
- Na imagem Ubuntu da Hostinger, o `50-cloud-init.conf` liga o login por senha. Como no sshd vale o primeiro valor lido, a configuração de segurança precisa do prefixo `00-`.

### 📌 Próximos Passos
- [ ] WhatsApp pela API oficial da Meta (de preferência em coexistência com o número atual).
- [ ] Google Calendar com conta de serviço, apagando o evento quando o agendamento é cancelado.
- [ ] Cópia do backup fora do servidor e monitoramento (UptimeRobot).

## [2026-10-23] - Mensagem pelo WhatsApp da Lari, avisos no iPhone e painel no celular

### 🛠️ O que foi feito
- **WhatsApp automático adiado:** a Meta só libera coexistência (manter o app no mesmo número) para parceiros. No lugar, `GET /appointments/{id}/client-message` devolve um link `wa.me` com a mensagem pronta (confirmação com sinal e PIX, ou recusa com motivo) e o painel mostra o botão "Enviar pelo WhatsApp". Mensagens sem emoji: o `�` aparecia porque o emoji se perdia no texto do link.
- **Aviso de pedido novo por Web Push** (`WebPushService`, `PushController`, tabela `WebPushSubscriptions`), com chaves VAPID no `.env` do servidor. Funciona no iPhone com o painel na Tela de Início. Testado de ponta a ponta com 3 pedidos reais.
- **Validação de WhatsApp** (`PhoneNumber`): um "55" digitado no lugar do DDD gerava um número que não existe no WhatsApp.
- **Sessão do painel de 30 dias** (`Jwt:ExpiryDays`) e opção "Manter conectada neste aparelho" no site.
- **PIX e QR Code somem** quando a Lari marca o sinal como recebido (a tela da cliente se atualiza sozinha).
- Push do app Expo continua no código, mas o app foi deixado de lado: a Lari usa iPhone.
- Layout de celular do painel e de "Meus agendamentos" refeito (cartões em coluna, botões de 44 px, campo de data do iOS com altura fixa, aviso no fluxo da página).

### 💡 Aprendizados Técnicos
- O pacote `WebPush` envia no formato antigo (`aesgcm`), que o serviço de push da Apple descarta sem erro; a `Lib.Net.Http.WebPush` usa `aes128gcm` + `vapid`. A diferença só apareceu ao montar um receptor local para ler o que era enviado.
- No iOS, remover o app da Tela de Início apaga a permissão e a assinatura de push: é preciso tocar em "Ativar avisos" de novo.
- `input type="date"` no iOS ignora `height` sem `appearance: none` e pode desmontar a linha em volta; flex com altura explícita resolve.

### 📌 Próximos Passos
- [ ] Corrigir o WhatsApp dos agendamentos de teste antigos (digitados com 55 no lugar do DDD).
- [ ] Conferir em produção a taxa de deslocamento: o OSRM público respondeu 403 e a taxa pode estar saindo zerada.
- [ ] Google Calendar com conta de serviço e cópia do backup fora do servidor.
