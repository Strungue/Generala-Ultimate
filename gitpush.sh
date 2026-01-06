#!/bin/bash
# Script para automatizar git add, commit y push

# Verifica que se haya pasado un mensaje
if [ -z "$1" ]; then
  echo "Uso: ./gitpush.sh \"mensaje del commit\""
  exit 1
fi

# Ejecuta los comandos
git add .
git commit -m "$1"
git push
