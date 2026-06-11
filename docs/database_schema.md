# Схема базы данных (MongoDB)

База: `local_services_map`. Все индексы создаются **автоматически** при старте приложения
(`backend/app/database.py` → `init_db()`), вручную их создавать не нужно.

---

## Коллекция `users`

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

Индексы:
- `email` — уникальный.

---

## Коллекция `services_cache`

Кеш заведений из Overpass API.

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

> **Важно:** GeoJSON хранит координаты в порядке `[долгота, широта]` (`[lng, lat]`).

Индексы:
- `location` — `2dsphere` (геопоиск через `$geoNear`);
- `category` — обычный (фильтрация);
- `osm_id` — уникальный (upsert без дублей);
- `cache_expires_at` — TTL (`expireAfterSeconds: 0`, MongoDB сам удаляет устаревшие записи).

---

## Коллекция `cache_areas`

Служебная коллекция: какие области уже загружены из Overpass (раздел 9 спецификации,
ключ кеша = `category + geohash`).

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

Geohash точностью 5 символов ≈ ячейка 4.9 × 4.9 км. При промахе кеша данные загружаются
радиусом 8.5 км вокруг центра ячейки — это покрывает ячейку целиком плюс максимальный
радиус поиска (5 км), поэтому любой следующий поиск из той же ячейки попадает в кеш.

Индексы:
- `(category, geohash)` — уникальный составной;
- `expires_at` — TTL.

---

## Коллекция `search_history`

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

Индексы:
- `(user_id, searched_at desc)` — составной (выборка и сортировка истории).

---

## Коллекция `favorites`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref users)",
  "service_osm_id": "node-123456789",
  "service_name": "Apteka Centrum",
  "service_category": "pharmacy",
  "service_location": { "type": "Point", "coordinates": [22.5644, 51.2478] },
  "note": "Дежурная аптека",
  "saved_at": "ISODate"
}
```

Данные заведения денормализованы (снимок на момент сохранения), чтобы избранное
оставалось доступным даже после очистки кеша по TTL.

Индексы:
- `(user_id, service_osm_id)` — уникальный составной (нет дублей).

---

## Тестовые данные (опционально)

`data/seed_data.json` содержит 6 заведений Люблина. Импорт:

```bash
mongoimport --uri "mongodb://localhost:27017/local_services_map" \
  --collection services_cache --jsonArray --file data/seed_data.json
```

(или через MongoDB Compass: коллекция `services_cache` → Add Data → Import JSON).
Это нужно только если хочется проверить работу без доступа к Overpass API —
при обычной работе кеш наполняется автоматически.
