# Revenda

React + TypeScript (Express) + PostgreSQL.

## Rodar

1. Banco: `docker compose up -d` (ou use seu Postgres e ajuste `backend/.env`)
2. Backend: `cd backend && npm install && npm run dev`
   (as tabelas são criadas automaticamente ao iniciar)
3. Frontend, em outro terminal: `cd frontend && npm install && npm run dev`
4. Abra http://localhost:5173

Antes de publicar, troque o `JWT_SECRET` em `backend/.env`.
