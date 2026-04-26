#!/bin/sh
# Generates a locally-trusted TLS certificate for local development.
# The cert covers localhost, api.localhost, and 127.0.0.1.
# Run once before `docker compose up`.
#
# Preferred method: mkcert (https://github.com/FiloSottile/mkcert)
#   Automatically installs the CA into system + browser trust stores.
#   Install: https://github.com/FiloSottile/mkcert#installation
#
# Fallback: self-signed with OpenSSL — requires manual trust steps (see output).

set -e

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/docker/nginx/certs"
mkdir -p "$CERTS_DIR"

CERT="$CERTS_DIR/cert.pem"
KEY="$CERTS_DIR/key.pem"

# ── mkcert path ────────────────────────────────────────────────────────────────
if command -v mkcert > /dev/null 2>&1; then
    echo "mkcert found — generating a locally-trusted certificate."
    mkcert -install
    mkcert \
        -cert-file "$CERT" \
        -key-file  "$KEY" \
        localhost api.localhost 127.0.0.1
    echo ""
    echo "Certificate written to:"
    echo "  $CERT"
    echo "  $KEY"
    echo ""
    echo "The certificate is automatically trusted by your system and browsers."
    exit 0
fi

# ── OpenSSL fallback ───────────────────────────────────────────────────────────
echo "mkcert not found — falling back to a self-signed OpenSSL certificate."
echo "For zero-hassle trust, install mkcert: https://github.com/FiloSottile/mkcert#installation"
echo ""

CFG="$CERTS_DIR/openssl.cnf"

cat > "$CFG" <<'EOF'
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names
keyUsage       = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
DNS.2 = api.localhost
IP.1  = 127.0.0.1
EOF

openssl req -x509 \
  -newkey rsa:2048 \
  -sha256 \
  -days 3650 \
  -nodes \
  -keyout "$KEY" \
  -out    "$CERT" \
  -config "$CFG"

rm "$CFG"
chmod 600 "$KEY"

echo ""
echo "Certificate written to:"
echo "  $CERT"
echo "  $KEY"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo " IMPORTANT: trust the certificate so that browser fetch() works"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  macOS:"
echo "    sudo security add-trusted-cert -d -r trustRoot \\"
echo "      -k /Library/Keychains/System.keychain $CERT"
echo ""
echo "  Linux — system store (Firefox reads this; Chrome needs the extra step below):"
echo "    # Debian / Ubuntu:"
echo "    sudo cp $CERT /usr/local/share/ca-certificates/layer-provider.crt"
echo "    sudo update-ca-certificates"
echo ""
echo "    # Fedora / RHEL:"
echo "    sudo cp $CERT /etc/pki/ca-trust/source/anchors/layer-provider.crt"
echo "    sudo update-ca-trust"
echo ""
echo "  Linux — Chrome / Chromium (uses its own NSS database):"
echo "    # Install certutil if missing: sudo apt install libnss3-tools"
echo "    mkdir -p \$HOME/.pki/nssdb"
echo "    certutil -d sql:\$HOME/.pki/nssdb -N --empty-password 2>/dev/null || true"
echo "    certutil -d sql:\$HOME/.pki/nssdb -A -t \"C,,\" \\"
echo "      -n \"layer-provider-localhost\" -i $CERT"
echo "    echo \"Restart Chrome/Chromium for the change to take effect.\""
echo ""
echo "  Windows (PowerShell as Administrator):"
echo "    Import-Certificate -FilePath \"$CERT\" \\"
echo "      -CertStoreLocation Cert:\\LocalMachine\\Root"
