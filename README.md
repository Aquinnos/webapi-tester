# WebAPI Tester

Webowy tester interfejsów REST API z lokalnym agentem proxy i modułem importu specyfikacji OpenAPI. Prototyp pracy inżynierskiej realizowanej na Wydziale Elektrycznym UMG.

## Architektura

Monorepo z trzema procesami uruchamianymi równolegle:

| Proces | Ścieżka | Port | Technologia |
| --- | --- | --- | --- |
| Klient webowy | `apps/web` | 5173 | Vite + React + TypeScript + Tailwind |
| Backend aplikacji | `apps/server` | 3001 | Node.js + Express + TypeScript + PostgreSQL |
| Lokalny agent proxy | `apps/proxy` | 3002 | Node.js + Express + TypeScript |

Współdzielone typy DTO w `packages/shared`.

## Quickstart

```bash
# 1. Instalacja zależności
pnpm install

# 2. Uruchomienie bazy danych w kontenerze
docker compose up -d postgres

# 3. Zastosowanie schematu bazy danych (po zakończeniu Etapu B)
pnpm migrate

# 4. Uruchomienie wszystkich trzech procesów
pnpm dev
```

Aplikacja webowa: `http://localhost:5173`
Backend API: `http://localhost:3001`
Lokalny agent proxy: `http://localhost:3002`

## Konfiguracja

Skopiuj `.env.example` do `.env` i uzupełnij wartości. Każdy `apps/*` wczytuje tylko swoje zmienne środowiskowe.

W środowisku produkcyjnym należy zmienić:
- `JWT_SECRET_KEY` (minimum 32 znaki losowe)
- `PROXY_SHARED_SECRET` (współdzielony z aplikacją webową przez nagłówek `X-Proxy-Key`)
- `POSTGRES_URL` (z silnym hasłem)
- Wszystkie adresy URL z `localhost` na docelowe hosty