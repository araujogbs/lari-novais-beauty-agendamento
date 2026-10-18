using AgendamentoApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// Pedidos em análise sem resposta em 3 dias passam a "Expired" (PendingExpirationService) e liberam o horário,
    /// então a constraint anti-sobreposição também passa a ignorá-los.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261018190000_AdicionarStatusExpirado")]
    public partial class AdicionarStatusExpirado : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS no_overlapping_appointments;
                ALTER TABLE "Appointments"
                ADD CONSTRAINT no_overlapping_appointments
                EXCLUDE USING gist (
                    tstzrange("StartTime", "EndTime") WITH &&
                ) WHERE ("Status" NOT IN ('Cancelled', 'Rejected', 'Expired'));
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Appointments" SET "Status" = 'Rejected' WHERE "Status" = 'Expired';
                ALTER TABLE "Appointments" DROP CONSTRAINT IF EXISTS no_overlapping_appointments;
                ALTER TABLE "Appointments"
                ADD CONSTRAINT no_overlapping_appointments
                EXCLUDE USING gist (
                    tstzrange("StartTime", "EndTime") WITH &&
                ) WHERE ("Status" NOT IN ('Cancelled', 'Rejected'));
                """);
        }
    }
}
