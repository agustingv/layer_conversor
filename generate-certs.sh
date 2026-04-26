#!/bin/sh
# Generates a self-signed TLS certificate for local development.
# The cert covers localhost, api.localhost, and 127.0.0.1.
# Run once before `docker compose up`.

set -e

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/docker/nginx/certs"
mkdir -p "$CERTS_DIR"

CERT="$CERTS_DIR/cert.pem"
KEY="$CERTS_DIR/key.pem"
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
echo "To avoid browser warnings, trust the certificate:"
echo ""
echo "  macOS:"
echo "    sudo security add-trusted-cert -d -r trustRoot \\"
echo "      -k /Library/Keychains/System.keychain $CERT"
echo ""
echo "  Linux (Debian / Ubuntu):"
echo "    sudo cp $CERT /usr/local/share/ca-certificates/layer-provider.crt"
echo "    sudo update-ca-certificates"
echo ""
echo "  Linux (Fedora / RHEL):"
echo "    sudo cp $CERT /etc/pki/ca-trust/source/anchors/layer-provider.crt"
echo "    sudo update-ca-trust"
echo ""
echo "  Windows (PowerShell as Administrator):"
echo "    Import-Certificate -FilePath \"$CERT\" \\"
echo "      -CertStoreLocation Cert:\\LocalMachine\\Root"
