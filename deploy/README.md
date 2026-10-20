# Deploy da AgendamentoApi

PostgreSQL + API + Caddy num VPS com Docker. O Caddy cuida do HTTPS (Let's Encrypt) e repassa o IP real da cliente para a API.

## 1. DNS
- Registro **A** de `api.<seu-domínio>` apontando para o IP do VPS.
- Na Cloudflare, deixe esse registro como **"DNS only" (nuvem cinza)**. Com o proxy laranja, o IP que chega na API seria o da Cloudflare e o rate limiting por IP deixaria de funcionar.

## 2. Servidor (Ubuntu)
```bash
curl -fsSL https://get.docker.com | sh
git clone <repo> && cd <repo>/deploy
cp .env.example .env && nano .env      # preencha tudo (menos o hash da senha)
./set-admin-password.sh                # senha do Painel Ateliê: digitada sem aparecer, só o hash vai para o .env
docker compose up -d --build
docker compose logs -f api             # as migrations rodam sozinhas ao subir
```

Libere no firewall só as portas 22, 80 e 443.

## 3. Primeira vez: cadastrar os serviços
```bash
docker compose exec -T db psql -U agendamento -d agendamento_db < seed-servicos.sql
```

Teste: `https://api.<seu-domínio>/health` e `https://api.<seu-domínio>/api/services`.

## 4. Google Calendar (opcional)
1. No Google Cloud, crie uma *service account* e baixe o JSON da chave.
2. Salve o arquivo como `deploy/secrets/google-calendar.json`.
3. Na agenda da Lari, compartilhe com o e-mail da service account ("Fazer alterações nos eventos").
4. Coloque o ID da agenda em `GOOGLE_CALENDAR_ID` e rode `docker compose up -d`.

## 5. Backup
```bash
chmod +x backup.sh
crontab -e   # 0 3 * * * /caminho/deploy/backup.sh >> /var/log/lari-backup.log 2>&1
```
Copie `backups/` para fora do servidor (ex.: `rclone` para Backblaze B2 ou Google Drive).

Restaurar o banco: `docker compose exec -T db pg_restore -U agendamento -d agendamento_db --clean < backups/db-AAAA-MM-DD.dump`

## Atualizar
```bash
git pull && docker compose up -d --build
```
