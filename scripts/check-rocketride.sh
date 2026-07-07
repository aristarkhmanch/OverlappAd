#!/usr/bin/env bash
# Быстрая проверка связи с RocketRide Cloud. Запуск: ./check-rocketride.sh
set -euo pipefail
cd "$(dirname "$0")"

# грузим .env
set -a; [ -f .env ] && . ./.env; set +a
: "${ROCKETRIDE_URI:?нет ROCKETRIDE_URI в .env}"
: "${ROCKETRIDE_AUTH:?нет ROCKETRIDE_AUTH в .env}"

AUTH=(-H "Authorization: Bearer ${ROCKETRIDE_AUTH}")

echo "URI: ${ROCKETRIDE_URI}"
ver=$(curl -fsS -m 10 "${ROCKETRIDE_URI}/version") && echo "version: ${ver}"

code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${ROCKETRIDE_URI}/status")
if [ "$code" = "200" ]; then
  echo "auth:    OK (status 200) ✅"
else
  echo "auth:    ПРОБЛЕМА (status $code) ❌  — проверь ключ"
  exit 1
fi

n=$(curl -fsS -m 12 "${AUTH[@]}" "${ROCKETRIDE_URI}/services" \
    | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]["services"]))')
echo "services: доступно нод — ${n}"
echo "Всё работает."
