# WebAPI Tester

Webowy tester interfejsów REST API z lokalnym serwerem proxy i modułem importu specyfikacji OpenAPI. Prototyp pracy inżynierskiej realizowanej na Wydziale Elektrycznym UMG.

## Architektura

Monorepo z trzema procesami uruchamianymi równolegle:

| Proces | Ścieżka | Port | Technologia |
| --- | --- | --- | --- |
| Klient webowy | `apps/web` | 5173 | Vite + React + TypeScript + Tailwind |
| Backend aplikacji | `apps/server` | 3001 | Node.js + Express + TypeScript + PostgreSQL |
| Lokalny serwer proxy | `apps/proxy` | 3002 | Node.js + Express + TypeScript |

Współdzielone typy DTO w `packages/shared`. API backendu udostępniane jest pod prefiksem `/api`, a pozostałe ścieżki obsługuje frontend (aplikacja jednostronicowa).

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
Backend API: `http://localhost:3001/api`
Lokalny serwer proxy: `http://localhost:3002`

## Lokalny serwer proxy

Serwer proxy przekazuje żądania z aplikacji webowej do wskazanego adresu docelowego i dołącza nagłówki CORS, dzięki którym przeglądarka może odczytać odpowiedź. Jest uruchamiany ręcznie i nie startuje automatycznie wraz z systemem.

Serwer proxy jest opcjonalny. Aplikacja wysyła żądania wprost z przeglądarki, a serwer proxy jest potrzebny wtedy, gdy serwer docelowy nie udostępnia nagłówków CORS albo gdy testowany API działa na `localhost` albo w sieci lokalnej.

### Tryby wysyłania żądań

Tryb wybiera się w interfejsie (przycisk **Serwer proxy** w pasku u góry):

| Tryb | Zachowanie |
| --- | --- |
| Serwer proxy, gdy jest dostępny | Żądanie idzie przez serwer proxy, a gdy nie odpowiada, aplikacja próbuje wysłać je wprost z przeglądarki |
| Zawsze przez serwer proxy | Żądanie idzie wyłącznie przez serwer proxy; brak serwera proxy kończy się czytelnym komunikatem |
| Zawsze bezpośrednio z przeglądarki | Serwer proxy nie jest w ogóle używany |

Adres serwera proxy oraz klucz współdzielony wkleja się w tym samym panelu. Klucz można też ustawić w pliku `.env` (zmienne `VITE_PROXY_URL` i `VITE_PROXY_SHARED_SECRET`), a wtedy nie trzeba go wklejać przy każdym uruchomieniu. Ustawienia zapisane w przeglądarce mają pierwszeństwo.

Przycisk **Serwer proxy** pokazuje stan połączenia: zielona kropka oznacza serwer proxy działający z poprawnym kluczem, bursztynowa błędny klucz, szara brak klucza, czerwona brak odpowiedzi serwera proxy.

### Uruchomienie w kontenerze

```bash
# Buduje obraz z repozytorium i uruchamia serwer proxy
docker compose up -d proxy

# Klucz współdzielony wypisuje się w logach
docker compose logs proxy
```

### Uruchomienie z obrazu w GitHub Container Registry

```bash
docker run --rm -p 127.0.0.1:3002:3002 \
  -e PROXY_SHARED_SECRET=twoj-staly-klucz \
  ghcr.io/aquinnos/webapi-tester-agent:latest
```

Bez zmiennej `PROXY_SHARED_SECRET` serwer proxy generuje losowy klucz przy każdym uruchomieniu i wypisuje go w logu, więc klucz wklejany do aplikacji przestaje pasować po restarcie kontenera. Podanie własnej zmiennej unieruchamia klucz.

Uwaga na port 3002: jeśli równolegle działa `pnpm dev`, to lokalny serwer proxy z repozytorium zajmuje ten port i kontener nie może się do niego podpiąć. Wtedy albo zatrzymujemy tylko część developerską, albo publikujemy kontener na innym porcie, na przykład `-p 127.0.0.1:3003:3002`, i w aplikacji wpisujemy adres `http://127.0.0.1:3003`.

### Adresy usług lokalnych z kontenera

Serwer proxy uruchomiony w kontenerze wchodzi do sieci wirtualnej Dockera, w której `127.0.0.1` oznacza sam kontener, a nie komputer użytkownika. Adres `localhost` wskazany w polu URL będzie więc zawsze odrzucany komunikatem „Nie udało się połączyć z podanym adresem", nawet gdy usługa na hoście działa poprawnie. Komputer użytkownika jest widoczny w kontenerze pod adresem `host.docker.internal` (Docker Desktop i OrbStack zapewniają ten alias automatycznie).

| Sytuacja | Adres usługi docelowej | Uwagi |
| --- | --- | --- |
| Serwer proxy w kontenerze, usługa na hoście | `http://host.docker.internal:5001/...` | Adres usługi podajemy w polu URL w aplikacji |
| Serwer proxy w kontenerze, usługa w innym kontenerze | `http://nazwa-uslugi:port/...` | Po nazwie usługi w sieci Dockera, nie po `127.0.0.1` |
| Serwer proxy uruchomiony natywnie na hoście | `http://127.0.0.1:5001/...` | Kontener nie jest wtedy w grze i zwykły `localhost` działa |

Adres samego serwera proxy wpisywany w aplikacji jest zawsze adresem hosta, na przykład `http://127.0.0.1:3002`, ponieważ przeglądarka łączy się z nim przez opublikowany port, a nie przez sieć wewnętrzną kontenera.

### Uruchomienie z kodu źródłowego

```bash
# Jednorazowa instalacja zależności (w katalogu głównym repozytorium)
pnpm install

# Uruchomienie samego serwera proxy
pnpm --filter @webapi-tester/proxy dev
```

Serwer proxy nasłuchuje na porcie `3002` (zmienny przez `PROXY_PORT`) i na adresie `127.0.0.1` (zmiennym przez `PROXY_BIND_HOST`; wewnątrz kontenera ustawianym na `0.0.0.0`, przy czym port jest publikowany wyłącznie na `127.0.0.1` hosta). Przyjmuje wyłącznie żądania zawierające nagłówek `X-Proxy-Key` zgodny z kluczem współdzielonym; niezgodny lub brakujący nagłówek kończy się odpowiedzią 401. Obsługuje metody `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` i `HEAD` oraz ciała binarne.

Serwer proxy udostępnia dwa endpointy pomocnicze: `GET /health` sprawdza, czy odpowiada, a `GET /session` z nagłówkiem `X-Proxy-Key` sprawdza, czy klucz jest prawidłowy. Oba zwracają nagłówki CORS, więc przeglądarka może je odczytać.

### Klucz współdzielony

Gdy zmienna `PROXY_SHARED_SECRET` jest ustawiona, serwer proxy używa jej jako klucza. Gdy jej nie ma, generuje losowy klucz przy pierwszym uruchomieniu, zapisuje go w pliku `PROXY_KEY_FILE` (domyślnie `.webapi-tester-agent-key`) i wypisuje go w logu startowym. Klucz trzeba wkleić w aplikacji webowej w panelu serwera proxy, dlatego nie trafia on do publicznego pakietu aplikacji webowej.

## Wdrożenie publiczne

Publiczne wdrożenie składa się z trzech elementów:

| Element | Gdzie | Uwagi |
| --- | --- | --- |
| Baza danych | Neon (darmowy PostgreSQL) | Adres w formacie `postgresql://...?sslmode=require` |
| Backend i frontend | Render, web service (Node 20) | Jeden adres dla API (`/api`) i dla aplikacji |
| Serwer proxy | Na komputerze użytkownika | Obraz z GitHub Container Registry |

Backend na Renderze serwuje jednocześnie API pod prefiksem `/api` i zbudowany frontend, więc aplikacja działa pod jednym adresem, a przeglądarka nie potrzebuje dodatkowych uprawnień CORS. Serwer proxy celowo nie jest wdrażany publicznie: publicznie dostępny serwer przekazujący żądania byłby otwartym proxy, przez które każdy mógłby wysyłać ruch do sieci wewnętrznej.

### Kroki wdrożenia

1. **Baza na Neon.** Zakład darmowy plan, w sekcji *Connection string* kopiujemy adres PostgreSQL z parametrem `sslmode=require`.
2. **Usługa na Render.** W panelu wybieramy *New > Blueprint*, wskazujemy to repozytorium i Render odczyta plik `render.yaml`. Uzupełniamy zmienne `POSTGRES_URL` (adres z Neon) oraz opcjonalnie `WEB_ORIGIN` (adres frontu, gdyby frontend był serwowany z innego miejsca). `JWT_SECRET_KEY` Render generuje sam. Adres usługi pojawia się po wdrożeniu, np. `https://webapi-tester.onrender.com`.
3. **Serwer proxy użytkownika.** Obraz `ghcr.io/aquinnos/webapi-tester-agent:latest` uruchamiamy lokalnie, a adres i klucz wklejamy w panelu *Serwer proxy* w aplikacji.

Baza jest schemą idempotentną, więc migracja (`pnpm migrate`) jest stosowana przy każdym starcie usługi i nie trzeba jej wywoływać ręcznie.

Darmowy plan Render usypia nieużywaną usługę po około 15 minutach, więc pierwsze żądanie po takiej przerwie trwa dłużej (do około minuty). Wymagania niefunkcjonalne mówią o reakcji interfejsu poniżej 200 ms, co dotyczy pracy z już uruchomioną usługą.

### Bezpieczeństwo wdrożenia

| Zabezpieczenie | Gdzie |
| --- | --- |
| Hasła z bcrypt i losową solą | `apps/server/src/services/password.ts` |
| JWT z krótkim czasem życia i rotacją tokenu odświeżania | `apps/server/src/services/jwt.ts` |
| Limit 60 żądań na 15 minut dla logowania i rejestracji | `apps/server/src/app.ts` |
| Blokada importu specyfikacji z adresów sieci wewnętrznej | `apps/server/src/lib/ssrf-guard.ts` |
| Ograniczenie CORS do listy dozwolonych originów | `apps/server/src/config.ts` |

## Testy

```bash
# Wszystkie testy (serwer + serwer proxy + aplikacja webowa)
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

Dodatkowe zmienne, które przydają się przy wdrożeniu na platformie chmurowej:

| Zmienna | Znaczenie |
| --- | --- |
| `PORT` | Port nasłuchu (platforma wstrzykuje go sama, lokalnie używany jest `SERVER_PORT`) |
| `BIND_HOST` | Adres nasłuchu, domyślnie `0.0.0.0` |
| `WEB_ORIGIN` | Lista originów dopuszczanych przez CORS (po przecinku), pusta oznacza tryb deweloperski |
| `WEB_DIST_DIR` | Katalog ze zbudowanym frontendem, domyślnie szukany w repozytorium |
| `OPENAPI_IMPORT_ALLOWED_HOSTS` | Lista hostów, z których wolno importować specyfikację OpenAPI (po przecinku) |
| `BCRYPT_COST` | Koszt hashowania hasła, na wolnym planie Render warto obniżyć do `10` |