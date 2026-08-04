# Backlog refaktoru i porządków

Ten dokument zbiera pozostałe prace techniczne po wdrożeniu deterministycznego
shella i refaktoru niezawodności. Nie jest listą nowych funkcji produktowych.
Priorytety opisują kolejność zalecaną przed rozpoczęciem integracji AI.
Aktualny kontrakt subsystemu opisuje [docs/terminal.md](terminal.md).

## P0 — weryfikacja obecnego runtime

- [ ] Przeprowadzić ręczne QA w prawdziwej przeglądarce na desktopie i mobile:
  oba motywy, reduced motion, fokus, Tab completion, Escape, klik poza terminal,
  `cd`, `open`, hash navigation oraz back/forward.
- [ ] Sprawdzić scenariusze z throttlingiem i offline: wolny manifest, pierwszy
  błąd i udany retry, anulowanie wolniejszej nawigacji A przez szybszą B oraz
  twardy fallback po błędzie dokumentu lub assetu.
- [ ] Potwierdzić brak reflow w idle/loading/error i poprawne nakładanie active
  shell na typowych szerokościach ekranu.

## P1 — jedno źródło prawdy i testy integracyjne

- [ ] Wprowadzić rejestr komend jako jedno źródło dla wykonania, `help`,
  autouzupełniania oraz atrap `/bin` i `/usr/bin`.
- [ ] Zdefiniować ogólny kontrakt rendererów obejmujący start, asynchroniczne
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
- [ ] Dodać real-browser smoke suite dla nawigacji, lifecycle shella, fokusu i
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
- [ ] Dodać jedno polecenie typu `npm run check`, które uruchamia testy, build,
  smoke test i kontrole repozytorium bez regeneracji katalogów muzycznych.

## Zasady realizacji

- Każdy punkt wykonywać jako osobny, możliwy do zweryfikowania refaktor bez
  jednoczesnej zmiany produktu.
- Nie dodawać AI, zapisu filesystemu, potoków ani wykonywania programów w ramach
  prac porządkowych.
- Nie regenerować mediów i nie wdrażać strony, jeśli konkretne zadanie tego nie
  wymaga.
- Po każdej zmianie aktualizować `docs/terminal.md`, `docs/architecture.md` lub
  ten backlog, jeśli zmienia się kontrakt albo status zadania.
