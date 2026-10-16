using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <inheritdoc />
    public partial class AtualizarServicosSocial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Nova tabela de preços do Atendimento Social. O penteado reserva 90 min (o máximo do "60 a 90"),
            // para a agenda não atrasar. Os UPDATEs não fazem nada se o serviço não existir.
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 350, \"DurationMinutes\" = 60 WHERE \"Name\" = 'Maquiagem';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 350, \"DurationMinutes\" = 90 WHERE \"Name\" = 'Penteado';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 700, \"DurationMinutes\" = 150 WHERE \"Name\" = 'Maquiagem + Penteado';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 300, \"DurationMinutes\" = 60, \"Name\" = 'Escova e Babyliss' WHERE \"Name\" IN ('Escova/Babyliss', 'Escova e Babyliss');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 290, \"DurationMinutes\" = 60 WHERE \"Name\" = 'Maquiagem';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 290, \"DurationMinutes\" = 60 WHERE \"Name\" = 'Penteado';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 550, \"DurationMinutes\" = 120 WHERE \"Name\" = 'Maquiagem + Penteado';");
            migrationBuilder.Sql("UPDATE \"Services\" SET \"Price\" = 250, \"DurationMinutes\" = 60, \"Name\" = 'Escova/Babyliss' WHERE \"Name\" = 'Escova e Babyliss';");
        }
    }
}
