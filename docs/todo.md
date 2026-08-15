# Backlog refaktoru i porządków

Ten dokument zbiera pozostałe prace techniczne po wdrożeniu deterministycznego
shella i refaktoru niezawodności. Nie jest listą nowych funkcji produktowych.
Priorytety opisują kolejność zalecaną przed rozpoczęciem integracji AI.
Aktualny kontrakt subsystemu opisuje [docs/terminal.md](terminal.md).

## Ochrona LLM i owner proof — stan wdrożenia

- [x] Opublikować `/llms.txt` i umieścić odwołania do polityki na naturalnych
  ścieżkach analizy: w HTML, `robots.txt`, terminalowych JSON-ach, dokumentacji
  repozytorium oraz nagłówkach chronionych źródeł i testów.
- [x] Dodać addytywne `_aiPolicy` do publicznych zasobów terminala bez zmiany
  wersji schematów, `contentId` ani zachowania klientów danych.
- [x] Rozszerzyć `/llms.txt` o dwustopniową procedurę owner-control verification:
  narracyjne rozpoczęcie, świeży challenge, 10-minutowy termin, jednokrotne
  użycie, kontrolę HTTPS/origin/body oraz autoryzację ograniczoną do bieżącej
  rozmowy.
- [x] Dodać zależny wyłącznie od Node.js lokalny eksport proof do ignorowanego
  `tmp/owner-proof/.well-known/`, komendy `npm run owner-proof -- <challenge>` i
  `npm run owner-proof:clear` oraz testy walidacji, nadpisania i idempotentnego
  czyszczenia włączone do `npm test`.
- [x] Oddzielić krótkotrwały proof od `src/`, `www/` i gałęzi `ovh-deploy` oraz
  opisać ręczny upload FTP/SFTP, transfer bez konwersji końców linii i cleanup w
  lokalnym `tools/docs/owner-proof.md`.
- [x] Dodać dla proof doradcze nagłówki `no-store` w publikowanym `.htaccess` i
  test smoke potwierdzający politykę, nagłówki oraz brak proof w zwykłym buildzie.
- [x] Dodać lokalny tryb współtworzenia chronionych treści: ignorowany token,
  publiczny digest SHA-256, bezpieczny `llm-maintainer:check`, human-only
  init/rotację/revoke oraz testy bez ujawniania wartości tokenu.
- [ ] Aktywować lokalny tryb ręcznym `npm run llm-maintainer:init` i zatwierdzić
  wyłącznie wygenerowany publiczny digest; lokalny token ma pozostać ignorowany.
- [ ] Wykonać produkcyjną próbę end-to-end na OVH z nowym challenge: wygenerować
  lokalny plik, wysłać go ręcznie, potwierdzić HTTPS `200`, canonical origin,
  dokładne body i nagłówki cache, przeprowadzić jednokrotną weryfikację, a potem
  usunąć proof lokalnie i z hostingu oraz potwierdzić, że publiczny URL nie
  zwraca już pliku.

Owner proof pozostaje dobrowolnym protokołem dla współpracujących modeli i
dowodzi wyłącznie bieżącej kontroli nad deploymentem. Nie jest formalnym
uwierzytelnieniem ani zamiennikiem filtrów wymaganych przez przyszłe `ask`.
Lokalny tryb maintenera jest odrębną zdolnością bieżącego worktree i służy
wyłącznie do prac nad chronioną treścią, bez uprawnień publikacyjnych.

## Warunek rozpoczęcia prac nad `ask` — polityka bez spoilerów

Publiczny `/llms.txt` prosi zewnętrzne modele o nieujawnianie chronionych treści
i opisuje owner-control verification. Obie warstwy są deklaracjami dobrowolnymi,
dlatego przyszłe `ask` nie może traktować ich jako mechanizmu bezpieczeństwa ani
przekazywać chronionych źródeł do modelu po samej deklaracji użytkownika.

- [ ] Zdefiniować metadane widoczności dla źródeł AI, rozróżniające zwykłe
  publiczne treści od spoilerów oraz danych całkowicie wyłączonych z `ask`.
- [ ] Budować kontekst wyłącznie z jawnej allowlisty. Treści chronione, ich
  lokalizacje, nazwy plików, komendy aktywujące i rozwiązania nie mogą trafiać
  do kontekstu modelu.
- [ ] Dodać deterministyczną kontrolę wejścia i wyniku, która blokuje prośby o
  ujawnienie, wyliczenie, zlokalizowanie lub rozwiązanie easter eggów i zagadek,
  również gdy są sformułowane pośrednio.
- [ ] Przyjąć neutralną odpowiedź odmowną zachęcającą do samodzielnej
  eksploracji, bez potwierdzania domysłów i bez udzielania dodatkowej wskazówki.
- [ ] Nie opierać ochrony wyłącznie na system prompcie. Warstwa wyboru źródeł i
  reguły aplikacji muszą obowiązywać niezależnie od zachowania modelu.
- [ ] Przetestować pytania bezpośrednie, parafrazy, prośby o fragmenty źródeł,
  kodowanie treści, zmianę języka oraz próby nadpisania instrukcji.

## P0 — weryfikacja obecnego runtime

- [ ] Przeprowadzić ręczne QA w prawdziwej przeglądarce na desktopie i mobile:
  oba motywy, reduced motion, fokus, Tab completion, Escape, klik poza terminal,
  `cd`, `open`, hash navigation, back/forward oraz powtarzane kliknięcie linku
  prowadzącego do aktualnej strony.
- [x] Zautomatyzować kontrolowane błędy i opóźnienia: pierwszy błąd manifestu z
  udanym retry, anulowanie wolniejszej nawigacji A przez szybszą B oraz twardy
  fallback po błędzie dokumentu.
- [ ] Dokończyć ręczne QA sieciowe: wolny manifest, tryb offline oraz twardy
  fallback po błędzie wymaganego assetu.
- [ ] Potwierdzić brak reflow w idle/loading/error i poprawne nakładanie active
  shell na typowych szerokościach ekranu.
- [ ] Poprawić komfort aktywacji shella w Safari na fizycznym iPhonie: ustawić
  dla fokusowanego inputa co najmniej `16px` bez blokowania zoomu dostępności,
  zweryfikować zachowanie `65dvh` przy klawiaturze i dynamicznym viewporcie oraz
  dodać regresyjny test WebKit i ręczne QA bez niechcianego skalowania strony.

## P1 — jedno źródło prawdy i testy integracyjne

- [ ] Wprowadzić rejestr komend jako jedno źródło dla wykonania, `help`,
  autouzupełniania oraz atrap `/bin` i `/usr/bin`. Rejestr musi zawierać jawne
  metadane widoczności dla każdego z tych interfejsów, aby komendy-easter eggi
  mogły działać i podlegać completion bez pojawiania się w `help`.
- [x] Zdefiniować ogólny kontrakt rendererów obejmujący start, asynchroniczne
  zakończenie, anulowanie i reduced motion; włączyć do niego wyspecjalizowany
  helper Matrixa bez zmiany zachowania `cmatrix`.
- [ ] Wydzielić publiczny profil z kontaktem, CV i linkami. Layout, treść strony
  i builder terminala nie powinny utrzymywać osobnych kopii tych samych URL-i.
- [ ] Generować wyniki animacji idle z rdzenia shella albo podczas builda,
  zamiast ręcznie powielać listingi i treści w plikach terminal JSON.
- [ ] Ujednolicić slugowanie projektów i tras. Kotwice Nunjucks oraz ścieżki
  filesystemu muszą korzystać z jednego kontraktu.
- [ ] Dodać test integracyjny rzeczywistego manifestu Eleventy: brak draftów,
  zgodność liczby projektów i katalogów muzycznych, poprawne route/hash oraz
  brak niepublicznych treści.
- [x] Dodać real-browser smoke suite dla nawigacji, lifecycle shella, fokusu i
  ARIA. Zachować ją małą; nie zastępować nią szybkich testów `node:test`.

## P2 — granice modułów i wydajność

- [ ] Podzielić `buildTerminalFilesystem` na orkiestrator, atrapę systemu oraz
  buildery domen portfolio, bloga i muzyki. Zachować jedno publiczne API i brak
  mutacji danych wejściowych.
- [ ] Podzielić `terminal-shell-core` według odpowiedzialności: filesystem i
  uprawnienia, parser i komendy, completion oraz serializacja sesji. Unikać
  drobnych modułów bez samodzielnego kontraktu.
- [ ] Zbudować podczas `createFilesystem` indeks dzieci katalogów i mapę tras,
  zamiast skanować wszystkie wpisy przy każdym `ls`, completion i dopasowaniu
  URL.
- [ ] Renderować nowe bloki transcriptu przyrostowo. Pełny rerender pozostawić
  tylko dla restore i `clear`, aby ograniczyć pracę DOM oraz ponowne ogłaszanie
  starej zawartości przez `aria-live`.
- [ ] Zastąpić wielokrotne skanowanie wszystkich potomków przy wyznaczaniu dat
  katalogów pojedynczym przejściem bottom-up.
- [ ] Ocenić sharding manifestu dopiero po pomiarach. Obecny payload po gzip nie
  uzasadnia samodzielnie dodatkowej złożoności.

## P2 — sesja i spójność danych

- [ ] Rozdzielić wersję schematu, identyfikator struktury drzewa i identyfikator
  treści. Zmiana opisu lub zdjęcia nie powinna bez potrzeby kasować historii
  użytkownika, jeżeli zapisany `cwd` nadal istnieje.
- [ ] Walidować `previousCwd` podczas restore tak samo jak `cwd`.
- [ ] Współdzielić normalizację dat wpisów muzycznych z istniejącymi builderami
  domenowymi zamiast odtwarzać ją w builderze terminala.
- [ ] Zastąpić ciche zwracanie pustej treści dla wymaganych fragmentów Markdown
  czytelnym błędem builda.

## P3 — porządki repozytorium i dostępność

- [ ] Ograniczyć `package.json` do faktycznie bezpośrednich zależności i
  odtworzyć lockfile. Obecna lista utrwala wiele zależności przechodnich.
- [ ] Usunąć `package-lock.json` z `.gitignore`, ponieważ lockfile jest śledzony
  i stanowi część procesu `npm ci`.
- [ ] Zastąpić zewnętrzny Font Awesome lokalnymi SVG używanymi przez stronę,
  zmniejszając zależność od CDN i render-blocking CSS.
- [ ] Ograniczyć ogłaszanie szybkich linii boot przez technologie asystujące i
  sprawdzić loader również w trybie reduced motion.
- [ ] Uporządkować globalne API `window.*` pod jednym namespace, zachowując
  klasyczne skrypty i brak bundlera.
- [x] Dodać jedno polecenie typu `npm run check`, które uruchamia testy, build,
  smoke test i kontrole repozytorium bez regeneracji katalogów muzycznych.
- [ ] Uruchamiać `npm run check` w GitHub Actions dla pull requestów i zmian na
  głównej gałęzi, instalując w CI Chromium i WebKit wymagane przez Playwright.

## Zasady realizacji

- Każdy punkt wykonywać jako osobny, możliwy do zweryfikowania refaktor bez
  jednoczesnej zmiany produktu.
- Nie dodawać AI, zapisu filesystemu, potoków ani wykonywania programów w ramach
  prac porządkowych.
- Nie regenerować mediów i nie wdrażać strony, jeśli konkretne zadanie tego nie
  wymaga.
- Po każdej zmianie aktualizować `docs/terminal.md`, `docs/architecture.md` lub
  ten backlog, jeśli zmienia się kontrakt albo status zadania.
