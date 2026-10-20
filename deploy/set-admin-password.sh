#!/bin/sh
# Define a senha do Painel Ateliê sem que ela apareça na tela nem fique salva em lugar nenhum:
# grava só o hash (formato ASP.NET Identity v3, o mesmo que o AuthController confere) no .env.
#   ./set-admin-password.sh && docker compose up -d
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "Crie o .env antes (cp .env.example .env)."; exit 1; }

USERNAME=$(sed -n 's/^ADMIN_USERNAME=//p' .env)
[ -n "$USERNAME" ] || { echo "Defina ADMIN_USERNAME no .env."; exit 1; }

HASH=$(python3 - <<'EOF'
import base64, getpass, hashlib, os, struct, sys

pw = getpass.getpass("Nova senha do Painel: ")
if len(pw) < 10:
    sys.exit("Use pelo menos 10 caracteres.")
if getpass.getpass("Repita a senha: ") != pw:
    sys.exit("As senhas não conferem.")

# Identity v3: 0x01 | PRF (2 = HMACSHA512) | iterações | tamanho do salt | salt | subchave (big-endian)
iterations, salt = 100_000, os.urandom(16)
subkey = hashlib.pbkdf2_hmac("sha512", pw.encode(), salt, iterations, 32)
blob = b"\x01" + struct.pack(">III", 2, iterations, len(salt)) + salt + subkey
print(base64.b64encode(blob).decode())
EOF
)

# Troca (ou acrescenta) a linha no .env sem passar o hash por sed (ele tem "/" e "+")
grep -v '^ADMIN_PASSWORD_HASH=' .env > .env.tmp || true
printf 'ADMIN_PASSWORD_HASH=%s\n' "$HASH" >> .env.tmp
chmod 600 .env.tmp && mv .env.tmp .env
echo "Senha de \"$USERNAME\" atualizada. Aplique com: docker compose up -d"
