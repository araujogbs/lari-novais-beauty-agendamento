using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendamentoApi.Migrations
{
    /// <summary>
    /// Vários serviços por pedido (nome e valor gravados no pedido), sinal com PIX e novos preços do Atendimento Social.
    /// </summary>
    public partial class SinalEVariosServicos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DepositAmount",
                table: "Appointments",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DepositPaidAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<List<int>>(
                name: "ServiceItemIds",
                table: "Appointments",
                type: "integer[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<string>(
                name: "ServiceNames",
                table: "Appointments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalPrice",
                table: "Appointments",
                type: "numeric",
                nullable: true);

            // Pedidos antigos: grava o serviço, o nome e o valor que valiam na época (preço x pessoas)
            migrationBuilder.Sql("""
                UPDATE "Appointments" a
                SET "ServiceItemIds" = ARRAY[a."ServiceItemId"], "ServiceNames" = s."Name", "TotalPrice" = s."Price" * a."People"
                FROM "Services" s
                WHERE s."Id" = a."ServiceItemId" AND a."Status" <> 'Blocked';
                """);

            // Novos valores: maquiagem e penteado a R$ 380 cada. Quem quer os dois marca os dois (valor e duração somam),
            // então o combo "Maquiagem + Penteado" sai do site sem apagar o histórico.
            migrationBuilder.Sql("""UPDATE "Services" SET "Price" = 380 WHERE "Name" IN ('Maquiagem', 'Penteado');""");
            migrationBuilder.Sql("""UPDATE "Services" SET "IsActive" = FALSE WHERE "Name" = 'Maquiagem + Penteado';""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Services" SET "Price" = 350 WHERE "Name" IN ('Maquiagem', 'Penteado');""");
            migrationBuilder.Sql("""UPDATE "Services" SET "IsActive" = TRUE WHERE "Name" = 'Maquiagem + Penteado';""");

            migrationBuilder.DropColumn(name: "DepositAmount", table: "Appointments");
            migrationBuilder.DropColumn(name: "DepositPaidAt", table: "Appointments");
            migrationBuilder.DropColumn(name: "ServiceItemIds", table: "Appointments");
            migrationBuilder.DropColumn(name: "ServiceNames", table: "Appointments");
            migrationBuilder.DropColumn(name: "TotalPrice", table: "Appointments");
        }
    }
}
