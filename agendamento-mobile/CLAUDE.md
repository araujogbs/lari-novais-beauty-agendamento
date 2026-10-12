@AGENTS.md
# Projeto: Agendamento de Serviços (API .NET + Mobile Expo)

## 📌 Visão Geral
Sistema de agendamento de atendimentos de maquiagem.
- **Backend:** C# / ASP.NET Core Web API, Entity Framework Core, PostgreSQL.
- **Frontend:** React Native com Expo, TypeScript, Axios.
- **Ambiente Local:** API rodando em `http://0.0.0.0:5102` com CORS liberado.

## 🧱 Arquitetura Backend (.NET)
- `Controllers/`: `ServicesController.cs`, `AppointmentsController.cs`.
- `Data/`: `AppDbContext.cs` com Npgsql.
- `Models/`: `ServiceItem.cs`, `Appointment.cs`.
- `DTOs/`: `CreateAppointmentDto.cs`.
- `Services/`: `IWhatsAppService.cs`, `WhatsAppService.cs` (Mock/Log local).

## 📱 Frontend (Expo)
- `src/services/api.ts`: Instância do Axios apontando para `http://<IP_LOCAL>:5102/api`.
- `src/types/`: Tipagens TypeScript (`AppointmentItem`, `ServiceItem`).

## 🎯 Regras de Negócio Importantes
1. Horários de agendamento não podem colidir (validação via query com `SELECT EXISTS` no EF Core).
2. O ID de entidades geradas no banco (`Appointments`) nunca deve ser setado manualmente na criação.
3. Mensagens de confirmação disparam após a persistência no banco via `IWhatsAppService`.
4. O painel administrativo deve evoluir para autenticação via JWT (`[Authorize]`).