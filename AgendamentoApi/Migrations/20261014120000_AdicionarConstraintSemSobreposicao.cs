using AgendamentoApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// Impede, no nível do banco, dois agendamentos (não cancelados) com horários sobrepostos.
    /// Fecha a race condition entre o AnyAsync de conflito e o SaveChangesAsync.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261014120000_AdicionarConstraintSemSobreposicao")]
    public partial class AdicionarConstraintSemSobreposicao : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");

            // Falha com 23P01 (exclusion_violation) se houver sobreposição; o controller converte em HTTP 409
            migrationBuilder.Sql("""
                ALTER TABLE "Appointments"
                ADD CONSTRAINT no_overlapping_appointments
                EXCLUDE USING gist (
                    tstzrange("StartTime", "EndTime") WITH &&
                ) WHERE ("Status" <> 'Cancelled');
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS no_overlapping_appointments;""");
        }
    }
}
