# Specyfikacja projektu

## 1. Opis ogólny

Projekt to aplikacja webowa do wyszukiwania usług lokalnych (aptek, sklepów,
restauracji, banków itp.) z wykorzystaniem geolokalizacji użytkownika. Głównym
celem projektu jest pokazanie zastosowania dokumentowej bazy danych MongoDB
w aplikacji webowej — w szczególności modelu dokumentowego, indeksów oraz
zapytań przestrzennych.

Aplikacja uruchamiana jest lokalnie (`localhost:8000`) i działa w przeglądarce
na komputerze oraz telefonie (responsywny układ). Użytkownik widzi mapę
wyśrodkowaną na swoim położeniu, wpisuje rodzaj obiektu, ustawia promień
wyszukiwania, a na mapie pojawiają się znaczniki pasujących miejsc. Na dole
wysuwa się panel z listą wyników, którą można sortować. Zalogowani użytkownicy
mogą zapisywać miejsca ulubione, przeglądać historię wyszukiwań oraz wystawiać
opinie.

## 2. Stos technologiczny

### Backend
- Python 3.11 — język programowania
- FastAPI — framework REST API z automatyczną dokumentacją
- Uvicorn — serwer ASGI
- Motor — asynchroniczny sterownik MongoDB
- Pydantic v2 — walidacja danych
- python-jose — tokeny JWT
- passlib + bcrypt — haszowanie haseł
- httpx — zapytania do Overpass API
- python-dotenv — konfiguracja ze zmiennych środowiskowych

### Baza danych
- MongoDB 7 — baza dokumentowa, indeksy przestrzenne 2dsphere
- MongoDB Compass — podgląd danych

### Frontend
- HTML5, CSS3, JavaScript (ES2022) — bez frameworków (aplikacja jednostronicowa)
- Tailwind CSS (CDN) — układ responsywny
- Leaflet 1.9.4 — mapa
- Leaflet.markercluster — grupowanie znaczników
- Lucide Icons — ikony

### Zewnętrzne API
- Overpass API (OSM) — dane o obiektach
- Nominatim (OSM) — geokodowanie adresów
- MapTiler — kafelki mapy (opcjonalnie; bez klucza używane są kafelki OSM)

## 3. Architektura systemu

Aplikacja działa w modelu klient–serwer. Ten sam serwer (FastAPI + Uvicorn)
udostępnia REST API oraz pliki frontendu, wszystko na jednym porcie 8000.

```
Przeglądarka (localhost:8000)
        │
        ├── GET /          → index.html
        ├── GET /static/*  → CSS, JS, ikony
        └── /api/*         → REST API
                ├── /api/auth/*       → rejestracja, logowanie, JWT
                ├── /api/services/*   → wyszukiwanie obiektów
                ├── /api/users/*      → profil, ulubione, historia
                ├── /api/reviews/*    → opinie
                └── /api/categories   → kategorie
                        │
                        ├── MongoDB (users, services_cache, cache_areas,
                        │            search_history, favorites, reviews)
                        └── Overpass API (przy chybieniu bufora)
```

Dane o obiektach pobierane są z Overpass API i buforowane w MongoDB, żeby nie
odpytywać usługi zewnętrznej przy każdym wyszukiwaniu.

## 4. Baza danych

Sześć kolekcji: `users`, `services_cache`, `cache_areas`, `search_history`,
`favorites`, `reviews`. Szczegółowy opis dokumentów i indeksów znajduje się
w pliku [database_schema.md](database_schema.md).

Najważniejsze indeksy:
- `2dsphere` na polu `location` w `services_cache` — wyszukiwanie przestrzenne;
- TTL na `cache_expires_at` — automatyczne usuwanie przeterminowanego bufora;
- indeksy unikatowe zapobiegające duplikatom kont, ulubionych i opinii.

## 5. API

Pełny opis punktów końcowych znajduje się w pliku
[api_reference.md](api_reference.md). Główne grupy: autoryzacja, obiekty
(wyszukiwanie), dane użytkownika, opinie oraz kategorie. Punkty chronione
wymagają tokenu JWT w nagłówku `Authorization: Bearer <token>`.

## 6. Kategorie obiektów

| Klucz | Nazwa (PL) | Tag OSM |
|---|---|---|
| `pharmacy` | Apteka | `amenity=pharmacy` |
| `hospital` | Szpital | `amenity=hospital` |
| `clinic` | Przychodnia | `amenity=clinic` |
| `supermarket` | Supermarket | `shop=supermarket` |
| `convenience` | Sklep spożywczy | `shop=convenience` |
| `restaurant` | Restauracja | `amenity=restaurant` |
| `cafe` | Kawiarnia | `amenity=cafe` |
| `fast_food` | Fast food | `amenity=fast_food` |
| `bank` | Bank | `amenity=bank` |
| `atm` | Bankomat | `amenity=atm` |
| `fuel` | Stacja paliw | `amenity=fuel` |
| `dentist` | Dentysta | `amenity=dentist` |
| `post_office` | Poczta | `amenity=post_office` |

## 7. Buforowanie danych

Klucz bufora to `kategoria + geohash` obszaru. Przy wyszukiwaniu sprawdzany jest
aktualny wpis dla danej kategorii i komórki; przy jego braku dane pobierane są
z Overpass, zapisywane w buforze i zwracane. Bufor żyje 7 dni (`CACHE_TTL_DAYS`),
a przeterminowane wpisy usuwa indeks TTL.

## 8. Status „otwarte / zamknięte”

Status wyznaczany jest z pola `opening_hours` (format OSM, np.
`Mo-Fr 08:00-20:00`) przez własny parser. Gdy pole jest puste lub nierozpoznane,
status przyjmuje wartość „brak danych”.

## 9. Uruchomienie

Instrukcja instalacji i uruchomienia znajduje się w pliku
[setup_guide.md](setup_guide.md).
