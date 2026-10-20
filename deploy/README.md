# Deploy da AgendamentoApi

PostgreSQL + API + Caddy num VPS com Docker. O Caddy cuida do HTTPS (Let's Encrypt) e repassa o IP real da cliente para a API.

## 1. DNS
- Registro **A** de `api.<seu-domínio>` apontando para o IP do VPS.
- Na Cloudflare, deixe esse registro como **"DNS only" (nuvem cinza)**. Com o proxy laranja, o IP que chega na API seria o da Cloudflare e o rate limiting por IP deixaria de funcionar.

## 2. Preparar o servidor (Ubuntu 24.04, uma vez, como root)
O que foi feito no VPS de produção, para repetir num servidor novo:

- **Usuário `deploy`** com sudo e a mesma chave SSH do root (`/home/deploy/.ssh/authorized_keys`). Teste o login com ele **antes** do passo seguinte.
- **SSH só por chave e sem root:** `/etc/ssh/sshd_config.d/00-hardening.conf` com `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AllowUsers deploy`. O prefixo `00-` importa, porque o `50-cloud-init.conf` da imagem liga a senha e no sshd vale o primeiro valor lido. Confira com `sshd -T`.
- **Firewall (ufw):** entrada bloqueada, menos 22/tcp, 80/tcp, 443/tcp e 443/udp. Só o Caddy publica portas no Docker; banco e API ficam na rede interna.
- **fail2ban** na jail `sshd` (`/etc/fail2ban/jail.local`, banimento progressivo).
- **Atualizações de segurança automáticas** (`unattended-upgrades`), com reinício às 04:30 quando necessário. Os containers voltam sozinhos (`restart: unless-stopped`).
- **Swap de 2 GB** (`vm.swappiness=10`), para o build da imagem .NET não estourar a memória.
- **Fuso** `America/Sao_Paulo` (horário do cron do backup).
- **Docker** com logs rotacionados (`/etc/docker/daemon.json`: `max-size 10m`, `max-file 5`) e `deploy` no grupo `docker`.
- Código em **`/opt/lari/api`** (clone deste repositório).

Sem acesso SSH (chave perdida), use o console de emergência do painel da hospedagem.

## 3. Subir a API
```bash
curl -fsSL https://get.docker.com | sh
git clone <repo> && cd <repo>/deploy
cp .env.example .env && nano .env      # preencha tudo (menos o hash da senha)
./set-admin-password.sh                # senha do Painel Ateliê: digitada sem aparecer, só o hash vai para o .env
docker compose up -d --build
docker compose logs -f api             # as migrations rodam sozinhas ao subir
```

Em produção ficam em `/opt/lari/api/deploy`. Suba o Caddy (HTTPS) só depois que o DNS do `api` apontar para o servidor; antes disso, `docker compose up -d --build db api`, para não gastar tentativas de certificado do Let's Encrypt.

## 4. Primeira vez: cadastrar os serviços
```bash
docker compose exec -T db psql -U agendamento -d agendamento_db < seed-servicos.sql
```

Teste: `https://api.<seu-domínio>/health` e `https://api.<seu-domínio>/api/services`.

## 5. Google Calendar (opcional)
1. No Google Cloud, crie uma *service account* e baixe o JSON da chave.
2. Salve o arquivo como `deploy/secrets/google-calendar.json`.
3. Na agenda da Lari, compartilhe com o e-mail da service account ("Fazer alterações nos eventos").
4. Coloque o ID da agenda em `GOOGLE_CALENDAR_ID` e rode `docker compose up -d`.

## 6. Backup
```bash
chmod +x backup.sh
crontab -e   # 0 3 * * * /opt/lari/api/deploy/backup.sh >> /opt/lari/api/deploy/backups/backup.log 2>&1
chmod 700 backups   # os dumps têm dados das clientes
```
Copie `backups/` para fora do servidor (ex.: `rclone` para Backblaze B2 ou Google Drive).

Restaurar o banco: `docker compose exec -T db pg_restore -U agendamento -d agendamento_db --clean < backups/db-AAAA-MM-DD.dump`

## Atualizar
```bash
git pull && docker compose up -d --build
```
