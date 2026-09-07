#!/bin/bash
# WSL PostgreSQL 설정: listen_addresses를 *로 변경
PG_CONF="/etc/postgresql/16/main/postgresql.conf"

# listen_addresses 검색 및 변경
if grep -q "^#listen_addresses" "$PG_CONF"; then
    sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
elif grep -q "^listen_addresses" "$PG_CONF"; then
    sed -i "s/^listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
else
    echo "listen_addresses = '*'" >> "$PG_CONF"
fi

echo "=== 변경된 postgresql.conf (listen_addresses) ==="
grep "listen_addresses" "$PG_CONF"

# PostgreSQL 재시작
sudo service postgresql restart
sleep 2

# 상태 확인
sudo pg_isready
echo "=== WSL IP ==="
hostname -I | awk '{print $1}'
echo "=== 리스닝 포트 확인 ==="
ss -tlnp | grep 5432
