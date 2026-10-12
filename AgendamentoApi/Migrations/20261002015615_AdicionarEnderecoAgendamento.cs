using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarEnderecoAgendamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientAddress",
                table: "Appointments",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClientAddress",
                table: "Appointments");
        }
    }
}
