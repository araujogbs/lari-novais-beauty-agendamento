@AGENTS.md
# Projeto: Lari Novais Beauty — Agendamento de maquiagem a domicílio (API .NET + Mobile Expo)

Visão completa, regras de negócio e referência da API: `../README.md`. O site institucional (`../../Site`) usa a mesma API.

## 📌 Visão Geral
- **Backend:** C# / ASP.NET Core Web API (.NET 10), Entity Framework Core, PostgreSQL (`../AgendamentoApi`).
- **Mobile:** React Native com Expo SDK 57, TypeScript e Axios (esta pasta).
- **Ambiente local:** API em `http://0.0.0.0:5102`; o IP da máquina fica em `src/services/api.ts`.

## 🧱 Backend (.NET)
- `Controllers/`: `AppointmentsController`, `AuthController` (JWT), `ServicesController`.
- `Data/AppDbContext.cs`, `Models/` (`Appointment`, `ServiceItem`), `DTOs/`.
- `Services/`: `TravelFeeService`, `WhatsAppService` e `GoogleCalendarService` (os dois últimos em simulação/log até serem configurados).

## 📱 Mobile (Expo)
**Não usa Expo Router.** A navegação é um `viewMode` em `App.tsx` (`welcome`, `client`, `success`, `myAppointments`, `adminLogin`, `admin`). O `App.tsx` só liga as telas; a lógica fica em `src/`:
- `screens/`: telas (`WelcomeScreen`, `SuccessScreen`, `MyAppointmentsScreen`, `AdminLoginScreen`) e as pastas `booking/` (fluxo da cliente) e `admin/` (painel).
- `components/`: `AppHeader`, `Toast`, `Lightbox`, `Stepper`, `Skeleton`.
- `hooks/`: `useToast` (aviso em tela, no lugar de `Alert`), `useBookingForm` (estado do formulário de agendamento).
- `services/`: `api.ts` (Axios + token JWT), `auth.ts` (login/token no AsyncStorage) e `appointments.ts` (todas as chamadas à API).
- `utils/`: formatação (`format.ts`), datas no fuso de Brasília (`date.ts`), mensagens de erro, links (WhatsApp/mapa).
- `styles/common.ts`: estilos usados por mais de uma tela; o resto fica no arquivo da tela. Cores em `theme.ts`.
- Tipos em `types.ts`, constantes em `constants.ts`.

Para criar uma tela nova: componente em `src/screens/`, novo valor em `ViewMode` (`types.ts`) e um caso em `App.tsx`. Chamadas à API vão em `services/appointments.ts`, nunca direto na tela.

## 🎯 Regras de Negócio Importantes
1. Horários não podem colidir: o código consulta e o PostgreSQL garante com constraint de exclusão (`409` em conflito).
2. A cliente escolhe o horário de **início** (`startTime`); a API calcula o término somando `duração × pessoas`. O app envia o horário com `-03:00` (Brasília, sem horário de verão).
3. O ID de entidades geradas no banco nunca deve ser setado manualmente na criação.
4. Taxa de deslocamento e preço são recalculados no servidor; o app só exibe a estimativa.
5. Mensagens de confirmação disparam após a persistência no banco via `IWhatsAppService`.
6. O painel da maquiadora exige JWT (`[Authorize(Roles = "Admin")]`); o app guarda o token e volta ao login quando a API responde 401/403.
7. Preços e durações dos serviços vêm do banco (migration `AtualizarServicosSocial`) e devem bater com o site.

## ✅ Antes de dar uma tarefa como pronta
`npx tsc --noEmit` (tipos). No backend, `dotnet build` (pare a API antes, ou o executável fica travado).
