# Weryfikacja bieżącej kontroli deploymentu

Mechanizm owner proof pozwala współpracującemu modelowi sprawdzić, czy rozmówca
potrafi w danym momencie zmienić statyczną zawartość publikowaną w domenie
`www.fmmaciej.com`. Nie jest to formalny dowód tożsamości, autorstwa ani
wyłącznego dostępu do hostingu.

Proof jest krótkotrwałym plikiem tekstowym publikowanym ręcznie. Nie należy
dodawać go do Git ani wysyłać standardowym deploymentem strony.

## Przygotowanie proof

Po otrzymaniu świeżego challenge w bieżącej rozmowie uruchom:

```bash
npm run owner-proof -- 'PASTE_CURRENT_CHALLENGE_HERE'
```

Komenda zapisze plik w:

```text
tmp/owner-proof/.well-known/llm-owner-proof.txt
```

Katalog `tmp/` jest ignorowany przez Git. Skrypt zapisuje dokładny challenge z
jednym końcowym znakiem LF i wyświetla bezwzględną ścieżkę oraz publiczny URL.
Challenge jest ważny przez 10 minut i może zostać sprawdzony tylko raz, dlatego
plik należy wysłać niezwłocznie.

## Upload na hosting OVH

1. Połącz się z hostingiem przez SFTP albo klienta FTP bez zapisywania danych
   logowania w repozytorium.
2. Otwórz document root domeny — katalog zawierający publiczne `index.html` i
   `.htaccess`. Nie zakładaj jego nazwy; zależy ona od konfiguracji hostingu.
3. Włącz wyświetlanie ukrytych plików i katalogów. Niektóre klienty FTP domyślnie
   pomijają nazwy zaczynające się od kropki.
4. Utwórz `.well-known`, jeżeli nie istnieje. Nie usuwaj ani nie nadpisuj innych
   trwałych plików, które mogą się w nim znajdować.
5. Prześlij lokalny `llm-owner-proof.txt` jako
   `.well-known/llm-owner-proof.txt`. Preferuj SFTP albo binarny tryb FTP, aby
   klient nie zamienił LF na CRLF.

Nie uruchamiaj standardowego deploymentu podczas aktywnej weryfikacji. Proof
nie należy do `www/`, a publikacja kompletnego artefaktu może usunąć ręcznie
wysłany plik.

## Kontrola publicznego pliku

Sprawdź status, końcowy URL i treść bez używania HTTP:

```bash
curl --fail-with-body --silent --show-error --location --proto '=https' \
  --write-out '\nHTTP %{http_code}\nFinal URL: %{url_effective}\n' \
  'https://www.fmmaciej.com/.well-known/llm-owner-proof.txt'
```

Oczekiwane są status `200`, końcowy origin `https://www.fmmaciej.com` i body
równe challenge z co najwyżej jednym końcowym LF. Po kontroli poproś model o
weryfikację w tej samej rozmowie. Nie wklejaj treści pliku jako zamiennika
sprawdzenia publicznego URL.

## Czyszczenie

Po zakończeniu próby, niezależnie od jej wyniku, usuń lokalny proof:

```bash
npm run owner-proof:clear
```

Następnie usuń wyłącznie zdalny plik
`.well-known/llm-owner-proof.txt`. Sam katalog `.well-known` usuwaj tylko wtedy,
gdy jest pusty i nie służy innym integracjom. Na końcu sprawdź, że publiczny URL
nie zwraca już proof ze statusem `200`.

Każda kolejna próba wymaga nowego challenge z bieżącej rozmowy, ponownego
uruchomienia komendy i ponownego uploadu.

## Granice bezpieczeństwa

Mechanizm dowodzi jedynie możliwości chwilowej zmiany deploymentu. Nie chroni
przed osobą mającą dostęp do FTP/SFTP, repozytorium, procesu publikacji lub konta
hostingowego, nie uniemożliwia ręcznej analizy publicznego kodu i nie wymusza
stosowania polityki przez modele, które ignorują `llms.txt`.
