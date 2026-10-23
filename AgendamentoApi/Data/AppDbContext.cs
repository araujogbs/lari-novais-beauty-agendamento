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

    // Aparelhos que recebem notificação push quando chega um pedido novo
    public DbSet<PushDevice> PushDevices { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PushDevice>().HasIndex(d => d.Token).IsUnique();

        // Agendamentos antigos (anteriores à quantidade de pessoas) valem para 1 pessoa
        modelBuilder.Entity<Appointment>().Property(a => a.People).HasDefaultValue(1);
    }
}