FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY AgendamentoApi.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# Pasta das fotos de referência (montada como volume no docker-compose); dona é o usuário sem privilégios
RUN mkdir -p /data/uploads && chown -R $APP_UID /data
COPY --from=build /app .
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080 \
    Storage__UploadsPath=/data/uploads
EXPOSE 8080
ENTRYPOINT ["dotnet", "AgendamentoApi.dll"]
