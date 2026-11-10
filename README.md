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

# 3. Zastosowanie schematu bazy danych
pnpm migrate

# 4. Uruchomienie wszystkich trzech procesów
pnpm dev
```

Aplikacja webowa: `http://localhost:5173`
Backend API: `http://localhost:3001`
Lokalny agent proxy: `http://localhost:3002`

## Lokalny agent proxy

Agent proxy przekazuje żądania z aplikacji webowej do wskazanego adresu docelowego i dołącza nagłówki CORS, dzięki którym przeglądarka może odczytać odpowiedź. Jest uruchamiany ręcznie i nie startuje automatycznie wraz z systemem.

### Uruchomienie w kontenerze

```bash
# Buduje obraz z repozytorium i uruchamia agenta
docker compose up -d proxy

# Klucz współdzielony wypisuje się w logach
docker compose logs proxy
```

### Uruchomienie z obrazu w GitHub Container Registry

```bash
docker run --rm -p 127.0.0.1:3002:3002 ghcr.io/aquinnos/webapi-tester-agent:latest
```

### Uruchomienie z kodu źródłowego

```bash
# Jednorazowa instalacja zależności (w katalogu głównym repozytorium)
pnpm install

# Uruchomienie samego agenta
pnpm --filter @webapi-tester/proxy dev
```

Agent nasłuchuje na porcie `3002` (zmienny przez `PROXY_PORT`) i na adresie `127.0.0.1` (zmiennym przez `PROXY_BIND_HOST`; wewnątrz kontenera ustawianym na `0.0.0.0`, przy czym port jest publikowany wyłącznie na `127.0.0.1` hosta). Przyjmuje wyłącznie żądania zawierające nagłówek `X-Proxy-Key` zgodny z kluczem współdzielonym; niezgodny lub brakujący nagłówek kończy się odpowiedzią 401. Obsługuje metody `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` i `HEAD` oraz ciała binarne.

### Klucz współdzielony

Gdy zmienna `PROXY_SHARED_SECRET` jest ustawiona, agent używa jej jako klucza. Gdy jej nie ma, agent generuje losowy klucz przy pierwszym uruchomieniu, zapisuje go w pliku `PROXY_KEY_FILE` (domyślnie `.webapi-tester-agent-key`) i wypisuje go w logu startowym. Klucz trzeba wkleić w aplikacji webowej w polu klucza agenta, dlatego nie trafia on do publicznego pakietu aplikacji webowej.

## Testy

```bash
# Wszystkie testy (serwer + agent)
pnpm test

# Testy z pomiarem pokrycia kodu
pnpm test:coverage
```

Testy integracyjne serwera działają na osobnej bazie danych (`webapi_tester_test`, port 5433), a nie na bazie deweloperskiej. Kontener testowy podnosi się automatycznie skryptem `pretest`, dlatego wymaga uruchomionego Dockera. Dane deweloperskie pozostają nietknięte: testy czyszczą wyłącznie swoją bazę.

## Konfiguracja

Skopiuj `.env.example` do `.env` i uzupełnij wartości. Każdy `apps/*` wczytuje tylko swoje zmienne środowiskowe.

W środowisku produkcyjnym należy zmienić:
- `JWT_SECRET_KEY` (minimum 32 znaki losowe)
- `PROXY_SHARED_SECRET` (współdzielony z aplikacją webową przez nagłówek `X-Proxy-Key`)
- `POSTGRES_URL` (z silnym hasłem)
- Wszystkie adresy URL z `localhost` na docelowe hosty