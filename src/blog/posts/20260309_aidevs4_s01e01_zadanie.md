---
title: "AIDevs4 s01e01: people"
description: "Zadanie: przypisz tagi podejrzanym"
date: 2026-03-09
tags: [AI, LLM, Python, aidev4]
layout: post.njk
permalink: "blog/{{ page.fileSlug }}/"
---

## Zadanie

Pobierz listę osób, które przeżyły 'Wielką Korektę' i które współpracują z systemem. Znajdziesz ją pod linkiem:
[https://hub.ag3nts.org/data/tutaj-twój-klucz/people.csv](https://hub.ag3nts.org/data/tutaj-tw%C3%B3j-klucz/people.csv)

Wiemy, że do organizacji transportów między elektrowniami angażowani są ludzie, którzy:

- są mężczyznami, którzy teraz w 2026 roku mają między 20, a 40 lat
- urodzonych w Grudziądzu
- pracują w branży transportowej

Każdą z potencjalnych osób musisz odpowiednio otagować. Mamy do dyspozycji następujące tagi:

- IT
- transport
- edukacja
- medycyna
- praca z ludźmi
- praca z pojazdami
- praca fizyczna

Jedna osoba może mieć wiele tagów. Nas interesują tylko ludzie pracujący w transporcie, którzy spełniają też poprzednie warunki.

Prześlij nam listę osób, którymi powinniśmy się zainteresować. Oczekujemy formatu odpowiedzi jak poniżej, wysłanego na adres [https://hub.ag3nts.org/verify]

Nazwa zadania to: **people**.

```json
{
  "apikey": "tutaj-twój-klucz-api",
  "task": "people",
  "answer": [
    {
      "name": "Jan",
      "surname": "Kowalski",
      "gender": "M",
      "born": 1987,
      "city": "Warszawa",
      "tags": ["tag1", "tag2"]
    },
    {
      "name": "Anna",
      "surname": "Nowak",
      "gender": "F",
      "born": 1993,
      "city": "Grudziądz",
      "tags": ["tagA", "tagB", "tagC"]
    }
  ]
}
```

### Co należy zrobić w zadaniu?

1. **Pobierz dane z hubu** - plik `people.csv` dostępny pod linkiem z treści zadania (wstaw swój klucz API z [https://hub.ag3nts.org/]). Plik zawiera dane osobowe wraz z opisem stanowiska pracy (`job`).
2. **Przefiltruj dane** - zostaw wyłącznie osoby spełniające wszystkie kryteria: płeć, miejsce urodzenia, wiek.
3. **Otaguj zawody modelem językowym** - wyślij opisy stanowisk (`job`) do LLM i poproś o przypisanie tagów z listy dostępnej w zadaniu. Użyj mechanizmu Structured Output, aby wymusić odpowiedź modelu w określonym formacie JSON. Szczegóły we Wskazówkach.
4. **Wybierz odpowiednie osoby** - z otagowanych rekordów wybierz wyłącznie te z tagiem `transport`.
5. **Wyślij odpowiedź** - prześlij tablicę obiektów na adres `https://hub.ag3nts.org/verify` w formacie pokazanym powyżej (nazwa zadania: `people`).
6. **Zdobycie flagi** - jeśli wysłane dane będą poprawne, Hub w odpowiedzi odeśle flagę w formacie {FLG:JAKIES_SLOWO} - flagę należy wpisać pod adresem: [https://hub.ag3nts.org/] (wejdź na tą stronę w swojej przeglądarce, zaloguj się kontem którym robiłeś zakup kursu i wpisz flagę w odpowiednie pole na stronie)

### Wskazówki

- **Structured Output - cel i sposób użycia:** Celem zadania jest zastosowanie mechanizmu Structured Output przy klasyfikacji zawodów przez LLM. Polega on na wymuszeniu odpowiedzi modelu w ściśle określonym formacie JSON przez przekazanie schematu (JSON Schema) w polu `response_format` wywołania API. Dokumentacja: [OpenAI](https://platform.openai.com/docs/guides/structured-outputs#supported-schemas), [Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Gemini](https://ai.google.dev/gemini-api/docs/structured-output?example=recipe). Zadanie da się rozwiązać bez Structured Output, na przykład prosząc model o zwrócenie JSON-a i parsując go ręcznie - ale Structured Output eliminuje całą klasę błędów. Możesz też użyć bibliotek jak **Instructor** ([Python](https://python.useinstructor.com/)/[JS/TypeScript](https://js.useinstructor.com/)), które obsługują ten mechanizm za Ciebie.
- **Batch tagging - jedno wywołanie dla wielu rekordów:** Zamiast wywoływać LLM osobno dla każdej osoby, możesz na przykład wysłać w jednym żądaniu ponumerowaną listę opisów stanowisk i poprosić o zwrócenie listy obiektów z numerem rekordu i przypisanymi tagami. Znacznie zredukuje to liczbę wywołań API.
- **Opisy tagów pomagają modelowi:** Do każdej kategorii dołącz krótki opis zakresu - pomaga to modelowi poprawnie sklasyfikować niejednoznaczne stanowiska.
- **Format pól w odpowiedzi:** Pole `born` to liczba całkowita (sam rok urodzenia). Pole `tags` to tablica stringów, nie jeden string z przecinkami.
