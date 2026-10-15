using AgendamentoApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// Descrição do serviço desejado e nomes das fotos de referência enviadas pela cliente.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261014140000_AdicionarDescricaoEImagens")]
    public partial class AdicionarDescricaoEImagens : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Appointments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "ReferenceImages",
                table: "Appointments",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Description", table: "Appointments");
            migrationBuilder.DropColumn(name: "ReferenceImages", table: "Appointments");
        }
    }
}
