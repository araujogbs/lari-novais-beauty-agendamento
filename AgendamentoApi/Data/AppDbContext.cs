using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Models;

namespace AgendamentoApi.Data;

public class AppDbContext : DbContext
{
    // O construtor recebe as configurações (como a connection string) e repassa para a classe base do EF Core
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Cada DbSet<T> vira uma TABELA no seu PostgreSQL!
    // Aqui estamos dizendo: "Crie e gerencie a tabela 'Services' baseada no modelo ServiceItem"
    public DbSet<ServiceItem> Services { get; set; }

// Nova tabela de agendamentos
    public DbSet<Appointment> Appointments { get; set; }
}