#!/bin/sh
# Backup diário do banco e das fotos de referência. Agende no cron do servidor:
#   0 3 * * * /caminho/deploy/backup.sh >> /var/log/lari-backup.log 2>&1
# Depois copie a pasta backups/ para fora do servidor (ex.: rclone para Backblaze B2 ou Google Drive).
set -eu
cd "$(dirname "$0")"

DEST=./backups
STAMP=$(date +%F)
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U agendamento -d agendamento_db -Fc > "$DEST/db-$STAMP.dump"

rm -rf "$DEST/uploads-tmp"
docker compose cp api:/data/uploads "$DEST/uploads-tmp"
tar czf "$DEST/uploads-$STAMP.tgz" -C "$DEST/uploads-tmp" .
rm -rf "$DEST/uploads-tmp"

# Mantém 14 dias
find "$DEST" -type f -mtime +14 -delete

echo "Backup $STAMP concluído"
