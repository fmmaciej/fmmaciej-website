# Terminal portfolio

## Cel dokumentu

Ten dokument opisuje wysokopoziomową architekturę terminala na
`fmmaciej.com`: jego dwa tryby wizualne, wirtualny system plików, deterministyczny
shell, integrację z nawigacją strony oraz granice odpowiedzialności komponentów.

Terminal jest alternatywnym interfejsem do publicznego portfolio. Nie zastępuje
klasycznej nawigacji i nie jest emulatorem prawdziwego systemu operacyjnego.
Strona pozostaje w pełni użyteczna bez aktywowania shella.

## Założenia produktu

Terminal realizuje trzy cele:

1. Buduje terminalowy charakter portfolio bez wymuszania interakcji.
2. Pozwala eksplorować te same publiczne treści za pomocą znajomych poleceń.
3. Tworzy bezpieczną, deterministyczną podstawę pod przyszłą komendę `ask`.

Aktualna wersja nie zawiera AI. Nie wykonuje prawdziwych programów, nie zapisuje
plików, nie ma dostępu do systemu użytkownika i nie interpretuje dowolnego kodu.

## Dwa tryby interfejsu

### Idle

Idle jest domyślnym stanem po wejściu na stronę. Terminal ma stałą wysokość i
odtwarza przypisane do bieżącej sekcji przykłady obsługiwanych komend. Odpowiedzi
są wyświetlane jako subtelna warstwa w tle treści strony.

Najważniejsze własności:

- stała wysokość zapobiega przesuwaniu layoutu przez dłuższe komendy;
- konfiguracja animacji pochodzi z `src/assets/terminal/`;
- animacja nie przechwytuje klawiatury;
- hover i fokus klawiatury pokazują delikatną, odsuniętą ramkę sugerującą
  możliwość aktywacji;
- ścieżka terminala odzwierciedla bieżącą trasę strony;
- przykłady używają wyłącznie poleceń i ścieżek dostępnych w aktywnym shellu.

### Loading, error i active shell

Kliknięcie terminala albo ustawienie na nim fokusu i naciśnięcie Enter/Space
zatrzymuje idle i dopiero wtedy pobiera manifest filesystemu. W trakcie tej
pierwszej próby terminal zachowuje stałą wysokość i pokazuje status ładowania.
Udany odczyt jest współdzielony przez kolejne aktywacje i tworzy dokładnie jeden
kontroler shella.

Jeśli manifest jest chwilowo niedostępny, terminal pozostaje zwinięty i pokazuje
stały komunikat błędu. Kliknięcie, Enter lub Space ponawia pobranie bez
przeładowania strony. Błąd shella nie blokuje klasycznej nawigacji portfolio.

Po udanym odczycie terminal rozwija się nad treścią strony, bez zmiany wysokości
dokumentu. Aktywny obszar otrzymuje wyraźniejszą ramkę, pełne tło, transcript i
pole polecenia.

Shell pozostaje otwarty dla poleceń eksploracyjnych. Zamyka się po:

- `open`, gdy udało się otworzyć stronę lub zasób;
- `exit`, które dodatkowo usuwa zapisaną sesję;
- Escape;
- kliknięciu poza terminalem.

Escape i kliknięcie poza terminalem zachowują sesję. Ponowne otwarcie przywraca
katalog roboczy, historię oraz transcript.

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: click lub focus + Enter
    Loading --> Active: manifest gotowy
    Loading --> Error: błąd manifestu
    Error --> Loading: ponowna aktywacja
    Active --> Active: help / ls / cd / cat / clear
    Active --> Idle: Escape lub click outside
    Active --> Idle: open
    Active --> Idle: exit + reset sesji
```

## Architektura build-time

Wirtualny filesystem nie jest ręcznie utrzymywaną kopią portfolio. Powstaje
podczas builda z tych samych publicznych źródeł, które zasilają szablony stron.

```mermaid
flowchart LR
    A[About i fragmenty Markdown] --> F[buildTerminalFilesystem]
    B[Katalog projektów] --> F
    C[Opublikowana kolekcja bloga] --> F
    D[Event, mix i photo view models] --> F
    E[Statyczna atrapa Linuksa] --> F
    F --> G[filesystem.json]
    G --> H[Deterministyczny shell w przeglądarce]
```

`src/_lib/terminal/buildTerminalFilesystem.js` jest czystym builderem. Nie
mutuje wejścia i tworzy wersjonowany manifest z płaską listą wpisów.
`src/terminal-filesystem.11ty.js` jest cienką warstwą Eleventy: wczytuje
publiczne treści, przekazuje je do buildera i publikuje wynik jako:

```text
/assets/terminal/filesystem.json
```

Manifest ma `schemaVersion`, `contentId`, informacje o użytkowniku i hoście oraz
listę wpisów. `contentId` zmienia się razem z zawartością i pozwala bezpiecznie
unieważnić niekompatybilną sesję zapisaną w przeglądarce.

## Wirtualny system plików

Shell startuje jako użytkownik `fm` na hoście `void`, z katalogiem domowym:

```text
/home/fm
```

System jest inspirowany typowym Linuksem i zawiera katalogi takie jak `/bin`,
`/dev`, `/etc`, `/home`, `/proc`, `/tmp`, `/usr` i `/var`. Nie próbuje wiernie
odtwarzać konkretnej wersji dystrybucji.

Najważniejsza gałąź to publiczne portfolio:

```text
/home/fm/
├── about.md
├── contact.txt
├── cv/
├── links/
├── projects/
├── blog/
└── music/
    ├── bio/
    ├── rider/
    ├── events/
    ├── mixes/
    ├── photos/
    └── links/
```

### Źródła treści

- `about.md` i teksty muzyczne pochodzą z istniejących fragmentów Markdown;
- projekty są generowane z katalogu projektów i zawierają `README.md`, stack,
  status oraz publiczne linki;
- blog zawiera wyłącznie opublikowane wpisy, bez draftów i frontmatteru;
- events, mixes i photos odwzorowują pełne publiczne katalogi oraz media;
- CV i pliki `.url` prowadzą do istniejących publicznych zasobów;
- systemowe pliki w `/etc`, `/proc` i `/var/log` są bezpieczną, statyczną
  atrapą budującą kontekst.

W filesystemie nie mogą pojawiać się informacje, których nie ma w publicznych
źródłach strony. Dodanie nowego projektu do shella wymaga najpierw dodania go do
normalnego katalogu portfolio.

### Typy wpisów

Manifest rozróżnia:

| Typ | Zastosowanie |
| --- | --- |
| `directory` | Katalogi systemowe i sekcje portfolio. |
| `file` | Markdown, tekst, linki, media i dokumenty. |
| `symlink` | Linuksowe aliasy ścieżek, np. polecenia w `/bin`. |
| `device` | Kontrolowane atrapy `/dev/null`, `/dev/tty` itd. |
| `executable` | Widoczne wpisy odpowiadające obsługiwanym poleceniom. |

Każdy wpis posiada tryb dostępu, właściciela, grupę, datę modyfikacji i rozmiar.
Katalog `/root` oraz `/etc/shadow` demonstracyjnie egzekwują brak uprawnień.
Cały filesystem jest read-only.

## Deterministyczny shell

`terminal-shell-core.js` zawiera logikę niezależną od DOM:

- tokenizację bez `eval`;
- normalizację ścieżek bezwzględnych i względnych;
- obsługę `~`, `.`, `..` i `cd -`;
- rozwiązywanie symlinków wraz z wykrywaniem cykli;
- sprawdzanie dostępu do plików i katalogów;
- wykonanie wspieranych komend;
- autouzupełnianie poleceń i ścieżek;
- serializację i odtwarzanie sesji.

Obsługiwane polecenia:

| Polecenie | Zachowanie |
| --- | --- |
| `help` | Lista możliwości i skrótów klawiaturowych. |
| `pwd` | Bieżący katalog wirtualnego filesystemu. |
| `ls [-al] [path]` | Listing katalogu; `-a` pokazuje dotfiles, `-l` metadane. |
| `cd [path]` | Zmiana katalogu oraz opcjonalna synchronizacja strony. |
| `cat <file> [...]` | Pełna treść pliku w przewijanym transcripcie. |
| `open <path>` | Otwarcie strony, linku, pobrania lub publicznego medium. |
| `clear` | Usunięcie transcriptu bez kasowania historii poleceń. |
| `history` | Historia poleceń bieżącej, trwałej sesji. |
| `whoami`, `hostname`, `uname` | Informacje o wirtualnej sesji. |
| `exit` | Zamknięcie shella i usunięcie zapisanej sesji. |

Parser wspiera cudzysłowy i podstawowe escapowanie. Potoki, przekierowania,
operatory łączenia, substytucje poleceń oraz wykonywanie kodu są jawnie
odrzucane jako nieobsługiwana składnia.

## Integracja ze stroną

Shell i klasyczna strona korzystają z jednej mapy położenia:

- katalog może mieć przypisaną `route` odpowiadającą publicznej stronie;
- `cd` do katalogu z trasą aktualizuje URL i treść pod terminalem, ale pozostawia
  shell otwarty;
- `open` odsłania wybrany cel i wraca do idle;
- katalogi systemowe bez trasy zmieniają wyłącznie `cwd`;
- klasyczne kliknięcie linku aktualizuje `cwd` do odpowiadającej mu ścieżki;
- back/forward synchronizuje stronę oraz shell bez dublowania historii.

`transitions.js` zachowuje istniejący DOM terminala podczas nawigacji. Podmienia
jedynie `.content-host`, synchronizuje zasoby strony i aktualizuje konfigurację
idle. Koordynator anuluje starszą nawigację, gdy rozpoczyna się nowsza, oraz nie
pozwala nieaktualnej odpowiedzi zmienić DOM lub historii. Zmiana samego hasha nie
pobiera ponownie HTML. Błąd sieci, dokumentu albo wymaganego assetu wraca do
klasycznej nawigacji przeglądarki.

Istniejący system terminalowych akcji dla linków nadal działa w idle: kliknięcia
wewnętrzne wyglądają jak `cd` lub `cat`, linki zewnętrzne jak `open`, a pobrania
jak `wget`. Jest to warstwa prezentacji klasycznej nawigacji, niezależna od
wykonywania komend przez aktywny shell.

## Runtime i odpowiedzialności

| Obszar | Odpowiedzialność |
| --- | --- |
| `terminal.js` | Animator idle, ścieżka strony, zegar, output w tle i lifecycle. |
| `terminal-shell-core.js` | Czysta logika filesystemu, parsera, komend i sesji. |
| `terminal-shell-coordinator.js` | Współdzielone ładowanie manifestu i stany runtime. |
| `terminal-shell.js` | DOM aktywnego shella, fokus, klawiatura, transcript i akcje. |
| `terminal-actions*.js` | Terminalowa prezentacja zwykłych kliknięć na stronie. |
| `navigation-coordinator.js` | Anulowanie, kolejność i fallback nawigacji. |
| `transitions.js` | Nawigacja HTML, historia i zachowanie terminala między trasami. |
| `terminal.css` | Stały idle, hover/focus affordance oraz rozwinięty panel active. |

Inicjalizacja jest odporna na wielokrotne wywołanie. Binding aktywatora powstaje
synchronicznie, jeszcze przed pobraniem manifestu. Przy przejściu do kolejnej
strony komponent odpina poprzednie listenery i timery, wiąże trwały kontroler z
aktualnym DOM i nie tworzy równoległych cykli animacji.

`boot.js` jest ładowany raz przez layout. Uruchamia animację przy każdym pełnym
załadowaniu dokumentu, ale nie podczas częściowej nawigacji. Idempotentny
kontroler chroni przed wieloma overlayami i czyści wszystkie timery; reduced
motion pomija animowaną sekwencję.

## Trwała sesja

Sesja jest zapisywana lokalnie w przeglądarce pod osobnym, wersjonowanym kluczem.
Nie opuszcza urządzenia użytkownika.

Zapisywane są:

- `cwd` i poprzedni katalog;
- maksymalnie 100 poleceń historii;
- maksymalnie 100 bloków transcriptu;
- identyfikator wersji manifestu.

Transcript ma limit 200 KB. Najstarsze bloki są usuwane, a pojedynczy output
większy od limitu nie jest odtwarzany po kolejnej wizycie. W bieżącej sesji
`cat` nadal pokazuje pełny plik.

Tryb active i niedokończony input nie są zapisywane. Każda wizyta wizualnie
zaczyna się od idle. Uszkodzony zapis, nieznana wersja albo nieistniejący `cwd`
powodują bezpieczny reset do ścieżki odpowiadającej aktualnej stronie.

## Klawiatura, dostępność i responsywność

- Tab przenosi fokus na aktywator, Enter/Space otwiera shell;
- w aktywnym shellu Tab autouzupełnia, strzałki przeglądają historię;
- Escape zwija terminal, `Ctrl+L` czyści transcript, `Ctrl+C` czyści input;
- aktywator utrzymuje `aria-expanded`, transcript ma semantykę logu, a input
  posiada etykietę dla technologii asystujących;
- fokus nie jest zamykany w terminalu jak w modalu;
- `prefers-reduced-motion` usuwa niepotrzebne przejścia;
- active ma ograniczoną wysokość i własny scroll, większy względny limit na
  urządzeniach mobilnych;
- ramki hover/focus i active nie zmieniają wymiarów layoutu.

## Bezpieczeństwo i granice

Shell nie jest sandboxem dla obcego kodu, ponieważ żadnego kodu nie wykonuje.
Wspierane polecenia zwracają dane lub deskryptor dozwolonej akcji. Wszystkie
wyniki są renderowane przez `textContent`, a nie jako HTML.

Najważniejsze ograniczenia:

- brak zapisu i mutacji filesystemu;
- brak prawdziwych procesów i dostępu do urządzenia;
- brak `eval`, potoków, przekierowań i substytucji;
- otwierane są wyłącznie cele zapisane w publicznym manifeście;
- pliki chronione i urządzenia zwracają kontrolowane wyniki;
- AI i komenda `ask` pozostają poza aktualnym kontraktem.

## Rozszerzanie

### Nowe treści

Najpierw należy dodać treść do właściwego źródła portfolio. Builder terminala
powinien jedynie odwzorować publiczny model, bez tworzenia drugiej redakcyjnej
bazy danych.

### Nowa komenda deterministyczna

Komenda powinna zostać dodana do czystego rdzenia, `help`, autouzupełniania oraz
atrapy katalogów poleceń. Musi zwracać tekst lub jawny deskryptor akcji, a jej
zachowanie wymaga testów jednostkowych.

### Przyszłe `ask`

`ask` powinno pozostać pojedynczą komendą korzystającą wyłącznie z publicznych
treści manifestu lub ich źródeł. Awaria AI nie może wpływać na pozostałe
komendy, nawigację ani idle. Odpowiedzi powinny wskazywać źródła i odmawiać
odpowiedzi, jeśli portfolio nie zawiera wymaganych informacji.

## Testowanie i walidacja

`npm run test:terminal` sprawdza builder, parser, ścieżki, symlinki, uprawnienia,
komendy, autouzupełnianie i trwałość sesji. `npm run test:runtime` sprawdza
anulowanie nawigacji, fallbacki, lazy loading manifestu oraz retry shella.
`npm run test:data` chroni istniejące buildery danych, a wspólne `npm test`
uruchamia wszystkie trzy zestawy. Po `npm run build`, `npm run test:smoke`
weryfikuje pojedynczy boot i kolejność skryptów w wygenerowanym HTML.

Zmiany interakcji lub CSS wymagają dodatkowo sprawdzenia w przeglądarce:

- desktop i mobile;
- jasny i ciemny motyw;
- hover, fokus i pełna obsługa klawiaturą;
- reduced motion;
- `cd`, `open`, back/forward i bezpośrednie wejścia na podstrony;
- brak przesuwania treści w idle i podczas aktywacji.

## Niezmienniki

- Klasyczne portfolio działa niezależnie od shella.
- Idle i active korzystają z tych samych prawdziwych ścieżek oraz komend.
- Wirtualny filesystem zawiera wyłącznie dane publiczne.
- Shell pozostaje deterministyczny, read-only i bezpieczny po stronie klienta.
- Nawigacja nie niszczy aktywnej sesji terminala.
- `src/` pozostaje źródłem prawdy; wygenerowany `www/` nie jest edytowany.
