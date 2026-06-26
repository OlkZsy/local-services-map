# Dokumentacja API

Adres bazowy: `http://localhost:8000`. Interaktywna dokumentacja (Swagger): `http://localhost:8000/docs`.

Punkty końcowe oznaczone 🔒 wymagają nagłówka `Authorization: Bearer <access_token>`.

---

## Konfiguracja

### `GET /api/config`

Publiczna konfiguracja dla frontendu.

```json
{
  "maptiler_api_key": null,
  "default_radius": 1000,
  "default_center": { "lat": 51.2465, "lng": 22.5684 }
}
```

`maptiler_api_key: null` oznacza, że frontend używa darmowych kafelków OpenStreetMap.

---

## Autoryzacja — `/api/auth`

### `POST /api/auth/register`

```json
{ "email": "jan@example.com", "username": "Jan Kowalski", "password": "secret123" }
```

Odpowiedź `201`: dane użytkownika. Błędy: `409` — e-mail zajęty, `422` — niepoprawne dane.

### `POST /api/auth/login`

```json
{ "email": "jan@example.com", "password": "secret123" }
```

Odpowiedź `200`:

```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

Błąd `401` — błędny e-mail lub hasło.

### `POST /api/auth/logout`

Token JWT nie jest przechowywany na serwerze — klient po prostu go usuwa. Odpowiedź: `{"message": "..."}`.

### `GET /api/auth/me` 🔒

Dane zalogowanego użytkownika:

```json
{
  "id": "65a...",
  "email": "jan@example.com",
  "username": "Jan Kowalski",
  "created_at": "2026-06-01T10:00:00Z",
  "settings": { "default_radius": 1000, "language": "pl", "theme": "light" }
}
```

---

## Obiekty — `/api/services`

### `GET /api/services/search`

| Parametr | Typ | Opis |
|---|---|---|
| `lat` | float | szerokość geograficzna (wymagany) |
| `lng` | float | długość geograficzna (wymagany) |
| `radius` | int | promień w metrach, 500–5000 (domyślnie 1000) |
| `category` | string | klucz kategorii, np. `pharmacy` (wymagany) |
| `sort` | string | `distance` (domyślnie) albo `opening_hours` |

Przykład:

```
GET /api/services/search?lat=51.2465&lng=22.5684&radius=1000&category=pharmacy&sort=distance
```

Odpowiedź:

```json
{
  "count": 12,
  "results": [
    {
      "osm_id": "node-123456789",
      "name": "Apteka Centrum",
      "category": "pharmacy",
      "address": { "street": "Krakowskie Przedmieście 5", "city": "Lublin", "postcode": "20-002" },
      "lat": 51.2478,
      "lng": 22.5644,
      "opening_hours": "Mo-Fr 08:00-20:00; Sa 09:00-15:00",
      "phone": "+48 81 123 45 67",
      "website": null,
      "distance": 312.4,
      "is_open": true
    }
  ]
}
```

`is_open`: `true` — otwarte teraz, `false` — zamknięte, `null` — brak danych o godzinach otwarcia.

Jeżeli zapytanie zostało wysłane z tokenem JWT, wyszukiwanie zapisuje się w historii użytkownika.

### `GET /api/services/geocode?q=<adres>`

Geokodowanie adresu przez Nominatim (adres → współrzędne, do 5 wyników, tylko Polska).

### `GET /api/services/{osm_id}`

Szczegóły jednego obiektu z bufora. `404`, jeśli obiektu nie ma w buforze.

---

## Użytkownik — `/api/users` (wszystkie 🔒)

### `GET /api/users/history`

Ostatnie 50 wyszukiwań: `{"history": [{id, query, category, lat, lng, radius, results_count, searched_at}]}`.

### `DELETE /api/users/history`

Czyści historię. Odpowiedź: `{"deleted": N}`.

### `GET /api/users/favorites`

`{"favorites": [{service_osm_id, service_name, service_category, lat, lng, note, saved_at}]}`.

### `POST /api/users/favorites`

```json
{ "osm_id": "node-123456789", "note": "Apteka całodobowa" }
```

`note` jest opcjonalne. Ponowne dodanie nie tworzy duplikatu (upsert). `404`, jeśli obiektu nie ma w buforze (trzeba najpierw wykonać wyszukiwanie).

### `DELETE /api/users/favorites/{osm_id}`

`404`, jeśli wpisu nie ma.

### `PATCH /api/users/settings`

Częściowa aktualizacja — można przesłać dowolny podzbiór pól:

```json
{ "default_radius": 1500, "theme": "dark", "language": "en" }
```

Odpowiedź — końcowe ustawienia.

---

## Opinie — `/api/reviews`

### `GET /api/reviews/{osm_id}`

Średnia ocena i lista opinii o obiekcie (publicznie; z tokenem JWT zaznacza własną opinię polem `is_mine`):

```json
{
  "osm_id": "node-123456789",
  "average": 4.5,
  "count": 2,
  "reviews": [
    { "id": "65a...", "username": "Jan", "rating": 5, "comment": "Super", "created_at": "...", "is_mine": true }
  ]
}
```

### `POST /api/reviews/{osm_id}` 🔒

```json
{ "rating": 5, "comment": "Polecam" }
```

`rating` 1–5 (wymagany), `comment` opcjonalny (do 500 znaków). Jedna opinia na użytkownika i obiekt — ponowne wysłanie aktualizuje istniejącą (upsert).

### `DELETE /api/reviews/{osm_id}` 🔒

Usuwa własną opinię. `404`, jeśli jej nie ma.

---

## Kategorie — `/api/categories`

### `GET /api/categories`

```json
{
  "categories": [
    { "key": "pharmacy", "icon": "💊", "names": { "pl": "Apteka", "en": "Pharmacy" } }
  ]
}
```

13 kategorii: pharmacy, hospital, clinic, supermarket, convenience, restaurant, cafe, fast_food, bank, atm, fuel, dentist, post_office.
