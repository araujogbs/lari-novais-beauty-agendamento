using AgendamentoApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// O pacote "Maquiagem + Penteado" volta ao site (R$ 700, mais barato que os dois separados a R$ 380).
    /// Agora cada pessoa escolhe os próprios serviços, então o pacote é um serviço à parte.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261024120000_ReativarPacoteMaquiagemPenteado")]
    public partial class ReativarPacoteMaquiagemPenteado : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Services" SET "IsActive" = TRUE, "Price" = 700, "DurationMinutes" = 150 WHERE "Name" = 'Maquiagem + Penteado';""");
            migrationBuilder.Sql("""
                INSERT INTO "Services" ("Name", "DurationMinutes", "Price", "IsActive")
                SELECT 'Maquiagem + Penteado', 150, 700, TRUE
                WHERE NOT EXISTS (SELECT 1 FROM "Services" WHERE "Name" = 'Maquiagem + Penteado');
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Services" SET "IsActive" = FALSE WHERE "Name" = 'Maquiagem + Penteado';""");
        }
    }
}
