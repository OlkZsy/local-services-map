# Schemat bazy danych (MongoDB)

Baza: `local_services_map`. Wszystkie indeksy tworzą się **automatycznie** przy starcie aplikacji
(`backend/app/database.py` → `init_db()`), nie trzeba ich zakładać ręcznie.

---

## Kolekcja `users`

```json
{
  "_id": "ObjectId",
  "email": "jan@example.com",
  "username": "Jan Kowalski",
  "password_hash": "$2b$12$... (bcrypt)",
  "created_at": "ISODate",
  "last_login": "ISODate",
  "settings": {
    "default_radius": 1000,
    "language": "pl",
    "theme": "light"
  }
}
```

Indeksy:
- `email` — unikatowy.

---

## Kolekcja `services_cache`

Bufor obiektów pobranych z Overpass API.

```json
{
  "_id": "ObjectId",
  "osm_id": "node-123456789",
  "name": "Apteka Centrum",
  "category": "pharmacy",
  "address": { "street": "Krakowskie Przedmieście 5", "city": "Lublin", "postcode": "20-002" },
  "location": { "type": "Point", "coordinates": [22.5644, 51.2478] },
  "opening_hours": "Mo-Fr 08:00-20:00; Sa 09:00-15:00",
  "phone": "+48 81 123 45 67",
  "website": "https://example.com",
  "cached_at": "ISODate",
  "cache_expires_at": "ISODate"
}
```

> **Ważne:** w formacie GeoJSON współrzędne zapisuje się w kolejności `[długość, szerokość]` (`[lng, lat]`).

Indeksy:
- `location` — `2dsphere` (wyszukiwanie przestrzenne przez `$geoNear`);
- `category` — zwykły (filtrowanie);
- `osm_id` — unikatowy (upsert bez duplikatów);
- `cache_expires_at` — TTL (`expireAfterSeconds: 0`, MongoDB sam usuwa przeterminowane wpisy).

---

## Kolekcja `cache_areas`

Kolekcja pomocnicza: zapamiętuje, które obszary zostały już pobrane z Overpass
(klucz bufora = `category + geohash`).

```json
{
  "_id": "ObjectId",
  "category": "pharmacy",
  "geohash": "u3nzk",
  "fetched_at": "ISODate",
  "expires_at": "ISODate",
  "count": 23
}
```

Geohash o długości 5 znaków odpowiada komórce ok. 4,9 × 4,9 km. Przy chybieniu bufora dane
pobierane są w promieniu 8,5 km wokół środka komórki — pokrywa to całą komórkę plus maksymalny
promień wyszukiwania (5 km), dzięki czemu każde kolejne wyszukiwanie z tej komórki trafia już do bufora.

Indeksy:
- `(category, geohash)` — unikatowy złożony;
- `expires_at` — TTL.

---

## Kolekcja `search_history`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref users)",
  "query": "Apteka",
  "category": "pharmacy",
  "location": { "type": "Point", "coordinates": [22.5684, 51.2465] },
  "radius": 1000,
  "results_count": 12,
  "searched_at": "ISODate"
}
```

Indeksy:
- `(user_id, searched_at malejąco)` — złożony (pobieranie i sortowanie historii).

---

## Kolekcja `favorites`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref users)",
  "service_osm_id": "node-123456789",
  "service_name": "Apteka Centrum",
  "service_category": "pharmacy",
  "service_location": { "type": "Point", "coordinates": [22.5644, 51.2478] },
  "note": "Apteka całodobowa",
  "saved_at": "ISODate"
}
```

Dane obiektu są zdenormalizowane (zapisane na moment dodania), żeby ulubione pozostały
dostępne nawet po usunięciu obiektu z bufora przez TTL.

Indeksy:
- `(user_id, service_osm_id)` — unikatowy złożony (bez duplikatów).

---

## Kolekcja `reviews`

Opinie i oceny obiektów.

```json
{
  "_id": "ObjectId",
  "osm_id": "node-123456789",
  "user_id": "ObjectId (ref users)",
  "username": "Jan Kowalski",
  "rating": 5,
  "comment": "Polecam, miła obsługa",
  "created_at": "ISODate"
}
```

Pole `username` jest zdenormalizowane, żeby wyświetlać autora bez dodatkowego zapytania do `users`.

Indeksy:
- `(osm_id, user_id)` — unikatowy złożony (jedna opinia na użytkownika i obiekt);
- `(osm_id, created_at malejąco)` — pobieranie opinii obiektu od najnowszych.

---

## Dane testowe (opcjonalnie)

Plik `data/seed_data.json` zawiera 6 obiektów z Lublina. Import:

```bash
mongoimport --uri "mongodb://localhost:27017/local_services_map" \
  --collection services_cache --jsonArray --file data/seed_data.json
```

(albo przez MongoDB Compass: kolekcja `services_cache` → Add Data → Import JSON).
Przydaje się tylko, gdy chcemy sprawdzić działanie bez dostępu do Overpass API —
przy normalnej pracy bufor wypełnia się sam.
