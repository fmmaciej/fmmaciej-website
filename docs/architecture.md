# Architektura fmmaciej.com

## Cel dokumentu

Ten dokument opisuje wysokopoziomowe działanie `fmmaciej.com`: sposób budowania
statycznych stron, przepływ danych i treści, zachowanie kodu w przeglądarce oraz
proces przygotowania i publikowania materiałów muzycznych.

Źródłem prawdy jest katalog `src/`. Eleventy generuje z niego kompletną stronę
w `www/`. Katalog wynikowy nie jest edytowany ani przechowywany w Git.

## Przegląd systemu

Projekt jest statyczną stroną opartą na Eleventy 3. Nie używa bundlera ani
frameworka frontendowego. Warstwa serwerowa działa wyłącznie podczas budowania,
a przeglądarka otrzymuje gotowy HTML, CSS, klasyczny JavaScript i zasoby
multimedialne.

```mermaid
flowchart LR
    A[Markdown i JSON] --> B[Buildery w src/_lib]
    B --> C[Adaptery danych Eleventy]
    C --> D[Szablony Nunjucks]
    D --> E[Eleventy]
    F[CSS, JS, obrazy i terminal JSON] --> E
    E --> G[Statyczny katalog www]
    G --> H[Przeglądarka]
```

System ma dwie wyraźne fazy:

1. **Build-time** — Eleventy zbiera treści, buduje view modele, renderuje
   szablony i kopiuje zasoby do `www/`.
2. **Runtime** — przeglądarka obsługuje motyw, terminal, menu mobilne,
   rozwijane kolekcje i animowane przejścia między wygenerowanymi stronami.

## Główne obszary strony

| Trasa | Odpowiedzialność |
| --- | --- |
| `/` | Profil software engineer, treść z fragmentu Markdown. |
| `/projects/` | Lista projektów z globalnego katalogu JSON. |
| `/blog/` | Archiwum wpisów pogrupowane według roku i miesiąca. |
| `/blog/<slug>/` | Pojedynczy wpis Markdown. |
| `/music/` | Punkt wejścia do części muzycznej i press kitu. |
| `/music/bio/`, `/music/rider/` | Strony tekstowe z fragmentów Markdown. |
| `/music/mixes/` | Miksy planowane, najnowsze i pogrupowane według platformy. |
| `/music/events/` | Nadchodzące wydarzenia oraz archiwum dekad i lat. |
| `/music/events/<wydarzenie>/` | Materiały przypisane do jednego wydarzenia. |
| `/music/photos/` | Zestawy zdjęć pogrupowane według roku. |
| `/music/links/` | Redakcyjny katalog odnośników muzycznych. |
| `/sitemap.xml`, `/robots.txt` | Automatycznie generowane dane dla robotów; `robots.txt` wskazuje też dobrowolną politykę AI bez ograniczania indeksowania. |
| `/llms.txt` | Dobrowolna polityka bez spoilerów dla zewnętrznych modeli, wskazana również z `<head>` każdej strony. |

## Organizacja źródeł

Najważniejsze katalogi:

- `src/_includes/` — wspólny layout, layout wpisu blogowego i makra Nunjucks;
- `src/_data/` — cienkie adaptery Eleventy oraz surowe katalogi JSON;
- `src/_lib/` — czyste buildery view modeli i narzędzia do rozwiązywania mediów;
- `src/blog/`, `src/music/`, `src/projects/`, `src/me/` — szablony i treści
  poszczególnych sekcji;
- `src/assets/css/` — style bazowe, komponentowe, efekty i style tras;
- `src/assets/js/` — klasyczny JavaScript wykonywany w przeglądarce;
- `src/assets/terminal/` — wersjonowana konfiguracja idle, globalne profile i
  pule poleceń oraz kontekstowe sekwencje poszczególnych tras;
- `src/assets/music/` — wygenerowane warianty obrazów oraz fallbacki;
- `tests/` — testy builderów, shella, koordynatorów runtime i smoke test builda;
- `docs/` — architektura, kontrakt terminala i backlog porządków technicznych;
- `tools/` — lokalne narzędzia generujące katalogi, obrazy i press kit;
- `www/` — wynik builda, nigdy źródło zmian.

## Przepływ danych podczas builda

### Zasada ogólna

Dane przechodzą przez cztery warstwy:

```text
surowe źródło → czysty builder w src/_lib → cienki adapter Eleventy → szablon
```

Builder odpowiada za normalizację, sortowanie, grupowanie oraz utworzenie view
modelu. Nie mutuje wejścia. Adapter jedynie wczytuje źródło, uruchamia builder i
eksportuje wynik. Szablon zajmuje się renderowaniem, a nie obliczeniami
domenowymi.

### Blog

`.eleventy.js` tworzy kolekcję `blog` ze wszystkich opublikowanych wpisów w
`src/blog/posts/`. Wpisy z `draft: true` są wykluczane z kolekcji i nie tworzą
własnej strony.

Lokalny adapter `src/blog/index.11tydata.js` przekazuje kolekcję do
`buildBlogArchive`. Builder tworzy strukturę `rok → miesiąc → wpisy`, którą
renderuje `src/blog/index.njk`. Adapter jest lokalny, ponieważ tylko strona
archiwum potrzebuje tego view modelu i zależy on od `collections.blog`.

### Events, mixes i photos

Surowe katalogi `events.json`, `mixes.json` oraz `photos.json` mają wspólny
szkielet:

- `defaults` — ustawienia kolekcji;
- `items` — pola redakcyjne i relacje domenowe;
- `media` — wygenerowane dane techniczne obrazów.

Każda domena ma osobny builder:

- `buildEventData` rozwiązuje media, tworzy upcoming/archive, grupy lat i dekad
  oraz dane używane przez strony szczegółów;
- `buildMixData` przygotowuje daty prezentacyjne, fallbacki, planned/latest i
  grupy platform;
- `buildPhotoData` normalizuje dane autorów, łączy zestawy z mediami i grupuje
  je według roku.

Adaptery `eventData.js`, `mixData.js` i `photoData.js` eksportują gotowe obiekty
dla Nunjucks. `allEvents.js` udostępnia `eventData.all` mechanizmowi paginacji,
który generuje po jednej stronie na wydarzenie.

### Pozostałe dane

Projekty i linki muzyczne są prostymi katalogami JSON konsumowanymi bez
rozbudowanej transformacji. `site.js` przechowuje publiczny adres strony używany
między innymi przez sitemapę.

## Renderowanie Eleventy

`.eleventy.js` konfiguruje:

- katalog wejściowy `src/` i wyjściowy `www/`;
- Nunjucks jako silnik szablonów;
- Markdown-it wraz z regułami dla linków zewnętrznych, ZIP i PDF;
- kolekcję bloga;
- filtry dat i miniaturek YouTube;
- shortcode `importMd`, który osadza wybrany fragment Markdown w szablonie;
- passthrough copy dla `llms.txt`, CSS, JavaScriptu, ikon, terminal JSON i
  muzycznych wariantów WebP.

Każda publiczna strona ma frontmatter z layoutem, permalinkiem oraz opcjonalnie:

- `terminalFile` — konfiguracją terminala dla danej trasy;
- `pageStyles` — stylami dołączanymi tylko na tej stronie;
- `pageScripts` — skryptami strony;
- `collectionPage` — deklaratywną konfiguracją rozwijanych kolekcji.

Wspólny `layout.njk` tworzy nagłówek, nawigację, terminal, `<main>`, stopkę,
menu mobilne i zestaw skryptów bazowych. Szablony stron dostarczają jedynie
zawartość `<main>`.

## Działanie w przeglądarce

```mermaid
flowchart TD
    A[Kliknięcie linku] --> B{Typ akcji}
    B -->|wewnętrzna| C[Komenda terminala]
    C --> D[Fetch następnego HTML]
    D --> E[Podmiana content-host i zachowanie terminala]
    E --> F[Synchronizacja CSS i skryptów strony]
    F --> G[Ponowna inicjalizacja komponentów]
    B -->|mail, download, zewnętrzny| H[Komenda terminala]
    H --> I[Natywna akcja przeglądarki]
```

### Terminal

Terminal ma dwa tryby: deterministyczny idle oraz aktywny, interaktywny shell.
Konfiguracja idle używa schematu 3: plik globalny definiuje selekcję, profile
czasu i pule, a pliki tras zawierają wyłącznie tablice `contextual`. Chronione
wpisy pozostają w źródłach konfiguracji i nie są wyliczane w dokumentacji.
Każdy publikowany zasób JSON terminala rozpoczyna się od doradczego pola
`_aiPolicy`, które kieruje agentów do `https://www.fmmaciej.com/llms.txt` i jest
ignorowane przez runtime.

Aktywny shell ładuje manifest filesystemu leniwie i retry'owalnie.
`buildTerminalFilesystem` tworzy read-only manifest schematu 2 z metadanymi
systemu, kontami, grupami i wpisami publicznego portfolio. Chronione dane
redakcyjne są dołączane przez cienki adapter, lecz przed ich analizą obowiązuje
[`src/llms.txt`](../src/llms.txt).
Addytywne `_aiPolicy` nie zmienia wersji schematu ani `contentId`, który nadal
opisuje wyłącznie operacyjną zawartość manifestu.

`terminal-shell-core.js` jest niezależny od DOM i odpowiada za parser,
ścieżki, uprawnienia, polecenia, completion oraz trwałą sesję.
`terminal-shell-coordinator.js` współdzieli ładowanie manifestu, a
`terminal-shell.js` wiąże model z DOM, fokusem i transcriptem. Bindingi są
disposable i bezpieczne po częściowej nawigacji.

Efekty dekoracyjne korzystają ze współdzielonego modelu canvas, obsługują
anulowanie i reduced motion. Ich chronione wyzwalacze oraz przebieg są celowo
pominięte. Narracyjne dane klienta są publiczne i nie stanowią granicy
bezpieczeństwa; polityka no-spoiler jest dobrowolną wskazówką dla
współpracujących agentów.

### Animowane przejścia

`transitions.js` przechwytuje obsługiwane linki wewnętrzne. Skrypt:

1. anuluje starszą, niezakończoną nawigację;
2. pobiera następny dokument przez `fetch`;
3. parsuje HTML bez pełnego przeładowania;
4. synchronizuje `pageStyles` i `pageScripts`;
5. wykonuje cleanup terminala i skryptów strony;
6. podmienia `.content-host`, zachowując istniejący terminal i jego sesję;
7. aktualizuje historię i ponownie inicjalizuje komponenty;
8. uruchamia animację wejścia treści.

Jeśli View Transitions API jest dostępne, aktualizacja jest wykonywana wewnątrz
przejścia. Bez tego API zachowany zostaje ten sam częściowy przepływ, ale bez
animacji przeglądarkowej. Zmiana wyłącznie hasha omija pobieranie dokumentu.
Zwykła nawigacja jest fallbackiem dla błędu sieci, HTTP, parsowania, wymaganych
assetów lub dokumentu bez oczekiwanej struktury. Nieaktualna odpowiedź nigdy nie
zmienia DOM ani historii.

### Rozwijane kolekcje

Blog, events, mixes i photos używają wspólnego makra opartego na semantycznym
`<details>`. Konfiguracja z `collectionPage` trafia jako `data-*` na `<main>`, a
`page-boot.js` inicjalizuje komponent bez rozpoznawania konkretnych tras.

`collection-page.js` odpowiada za animacje, aktywną grupę, hashe URL i suffix
ścieżki terminala. Przy bezpośrednim wejściu na zagnieżdżony hash otwiera także
grupy nadrzędne. Blog nie synchronizuje grup z URL ani terminalem; events,
mixes i photos robią to zgodnie z konfiguracją. Wewnętrzne zestawy zdjęć
pozostają natywnymi `<details>`.

### Pozostałe komponenty

- `theme.js` przełącza motyw, a wybór jest zapisywany w `localStorage`; przy
  braku wyboru używany jest motyw systemowy;
- `nav.js` obsługuje mobilny drawer, backdrop, klawiaturę i atrybuty ARIA;
- `loader.js` i `boot.js` realizują efekty wejściowe;
- animacje respektują `prefers-reduced-motion`.

## CSS i zasoby

CSS jest ładowany bez bundlowania i podzielony według odpowiedzialności:

- `base/` — tokeny, layout i reguły globalne;
- `components/` — terminal, nawigacja, kolekcje, karty i inne elementy wspólne;
- `effects/` — boot, Markdown i przejścia;
- `sections/` — style właściwe dla konkretnych tras.

Layout ładuje style bazowe zawsze, a `pageStyles` tylko tam, gdzie są potrzebne.
Obrazy muzyczne mają zapisane w katalogach wymiary i warianty używane przez
`srcset`. Font Awesome jest ładowany z zewnętrznego CDN, a brakująca lokalna
miniatura miksu YouTube może wskazywać na `img.youtube.com`. Śledzone zasoby
projektu są serwowane jako pliki statyczne.

## Workflow mediów muzycznych

Źródłowe obrazy znajdują się lokalnie w ignorowanych katalogach `originals/`.
Ich nazwy są częścią kontraktu danych:

```text
YYYYMMDD__slug__NN.ext
shared__slug__NN.ext   # tylko współdzielone obrazy miksów
```

Polecenia `build:events`, `build:mixes` i `build:photos` wykonują kolejno:

1. walidację nazw i katalogu;
2. generowanie wariantów WebP przez lokalne narzędzie photos4web;
3. odczyt wymiarów i hashy;
4. połączenie danych technicznych z polami redakcyjnymi;
5. atomowy zapis JSON.

Hash źródła pozwala zachować pola redakcyjne po zmianie nazwy pliku. Events i
photos generują warianty `480`, `960`, `1600`, a mixes `480`, `960`.
Wygenerowane pliki oraz odpowiadający im JSON są częścią źródeł strony.

`bundle:press-kit` buduje deterministyczny ZIP z bio, ridera, notatek o miksach,
danych kontaktowych i zdjęć. `npm run rebuild` regeneruje media, katalogi i
press kit przed właściwym buildem Eleventy; dlatego może zmienić wiele plików.

## Budowanie, testowanie i publikacja

Najważniejsze polecenia:

| Polecenie | Zastosowanie |
| --- | --- |
| `npm ci` | Instalacja zależności zgodnie z lockfile. |
| `npx playwright install chromium webkit` | Instalacja Chromium i WebKit wymaganych przez E2E. |
| `npm run dev` | Serwer developerski Eleventy z obserwowaniem zmian. |
| `npm run build` | Standardowy build `src/` → `www/` i zapis hasha źródeł. |
| `npm test` | Wszystkie testy danych, terminala, runtime i lokalnego owner proof. |
| `npm run test:data` | Testy czystych builderów i adapterów danych. |
| `npm run test:terminal` | Testy filesystemu, komend, sesji, selektora idle, profili, schedulera, modelu Matrixa i spójności treści. |
| `npm run test:runtime` | Testy anulowania/fallbacku nawigacji, lazy init, retry i bootu. |
| `npm run test:owner-proof` | Testy walidacji, eksportu i idempotentnego czyszczenia lokalnego owner proof. |
| `npm run test:smoke` | Kontrola wygenerowanego HTML oraz publikacji i odwołań do `/llms.txt` po `npm run build`. |
| `npm run test:e2e` | Testy Playwright w Chromium desktop/mobile i WebKit/iPhone. |
| `npm run test:e2e:iphone` | Wyłącznie projekt WebKit z emulowanym iPhone 16 Pro. |
| `npm run test:e2e:headed` / `test:e2e:ui` | Widoczna przeglądarka lub interaktywny runner do diagnozy E2E. |
| `npm run check` | Testy Node, build, smoke, E2E i kontrola `git diff --check`. |
| `npm run rebuild` | Pełna regeneracja mediów, danych, press kitu i strony. |
| `python3 -m unittest discover -s tools/tests -v` | Lokalne testy synchronizacji katalogów. |

Szybkie testy `node:test` chronią czyste modele i koordynatory, smoke sprawdza
wygenerowany HTML, a `tests/e2e/` weryfikuje rzeczywiste trasy, nawigację,
terminal, fokus, ARIA, motyw i reduced motion. Projekty obejmują Chromium na
desktopie i emulowanym Pixelu 7 oraz WebKit na emulowanym iPhonie 16 Pro w
portrait. Playwright uruchamia Eleventy na `127.0.0.1:8080`, nie korzysta z
zewnętrznej sieci i zapisuje ignorowane `test-results/` oraz
`playwright-report/` do diagnozy błędów. Nie używa golden screenshotów.

Emulacja iPhone'a ustawia WebKit, viewport, ekran, user agent i obsługę dotyku,
ale nie zastępuje Safari uruchomionego na fizycznym urządzeniu.

Po zmianach wizualnych sam build i E2E nie wystarczają — należy nadal sprawdzić
layout w przeglądarce, szczególnie na fizycznym urządzeniu.

Publikacja jest oddzielona od builda. `deploy:check` wymaga gałęzi `main`,
czystego drzewa, zgodności z `origin/main` i aktualnego `www/build.txt`.
`deploy:ovh` tworzy tymczasowe repozytorium z zawartością `www/` i publikuje je
na gałęzi `ovh-deploy`. Poleceń deploy nie należy uruchamiać jako zwykłej części
walidacji.

Krótkotrwały owner proof również pozostaje oddzielony od builda i deploymentu.
Lokalny skrypt zapisuje go pod ignorowanym `tmp/owner-proof/.well-known/`, skąd
operator wysyła wyłącznie plik proof ręcznie przez FTP/SFTP do document root
domeny. Zapobiega to zapisaniu challenge w źródłach lub historii gałęzi
`ovh-deploy`. Procedurę, czyszczenie i model zagrożeń opisuje
[`docs/owner-proof.md`](owner-proof.md).

## Typowe punkty rozszerzania

- **Nowa strona tekstowa:** szablon z frontmatter i fragment Markdown; style lub
  skrypty zadeklarować przez `pageStyles`/`pageScripts`.
- **Nowy wpis blogowy:** plik Markdown w `src/blog/posts/`; `draft: true`
  pozostawia go poza buildem publicznym.
- **Nowa kolekcja danych:** surowe źródło, czysty builder w `_lib`, cienki
  adapter Eleventy i szablon konsumujący stabilny view model.
- **Nowa rozwijana kolekcja:** użyć istniejącego makra oraz `collectionPage`;
  nie dodawać warunków zależnych od URL do `page-boot.js`.
- **Nowe media muzyczne:** użyć odpowiedniej konwencji nazw i polecenia
  `build:<collection>` zamiast ręcznej edycji pól technicznych.
- **Nowe zachowanie przeglądarkowe:** zachować klasyczny skrypt, inicjalizację
  odporną na brak elementu oraz cleanup zgodny z animowaną nawigacją.

## Najważniejsze niezmienniki

- `src/` jest źródłem prawdy; `www/` jest jednorazowym wynikiem builda.
- Logika domenowa nie trafia do szablonów ani adapterów danych.
- Surowe katalogi zachowują pola redakcyjne podczas regeneracji mediów.
- Wewnętrzna nawigacja musi działać również bez View Transitions API.
- Starsza nawigacja nie może nadpisać DOM ani historii po rozpoczęciu nowszej;
  błędy runtime muszą wracać do klasycznej nawigacji.
- Manifest shella jest pobierany dopiero przy aktywacji, a nie podczas startu
  strony; błąd musi pozostawiać możliwość ponowienia.
- Komponenty przeglądarkowe muszą być bezpieczne po wielokrotnej inicjalizacji i
  zwalniać listenery, obserwatory i timery.
- Zmiany dostępności, responsywności i obu motywów wymagają weryfikacji w
  przeglądarce.
