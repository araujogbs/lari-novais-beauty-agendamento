using AgendamentoApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// Agendamentos novos passam a nascer como "Pending" (em análise) e podem ser recusados ("Rejected").
    /// Recusados liberam o horário, então a constraint anti-sobreposição passa a ignorá-los, como já fazia com os cancelados.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261018150000_AdicionarStatusPendente")]
    public partial class AdicionarStatusPendente : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS no_overlapping_appointments;
                ALTER TABLE "Appointments"
                ADD CONSTRAINT no_overlapping_appointments
                EXCLUDE USING gist (
                    tstzrange("StartTime", "EndTime") WITH &&
                ) WHERE ("Status" NOT IN ('Cancelled', 'Rejected'));
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Appointments" SET "Status" = 'Cancelled' WHERE "Status" = 'Rejected';
                UPDATE "Appointments" SET "Status" = 'Confirmed' WHERE "Status" = 'Pending';
                ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS no_overlapping_appointments;
                ALTER TABLE "Appointments"
                ADD CONSTRAINT no_overlapping_appointments
                EXCLUDE USING gist (
                    tstzrange("StartTime", "EndTime") WITH &&
                ) WHERE ("Status" <> 'Cancelled');
                """);
        }
    }
}
