# API Reference

Базовый URL: `http://localhost:8000`. Интерактивная документация (Swagger): `http://localhost:8000/docs`.

Все защищённые эндпоинты требуют заголовок `Authorization: Bearer <access_token>`.

---

## Конфигурация

### `GET /api/config`

Публичная конфигурация для фронтенда.

```json
{
  "maptiler_api_key": null,
  "default_radius": 1000,
  "default_center": { "lat": 51.2465, "lng": 22.5684 }
}
```

`maptiler_api_key: null` означает, что фронтенд использует бесплатные тайлы OpenStreetMap.

---

## Авторизация — `/api/auth`

### `POST /api/auth/register`

```json
{ "email": "jan@example.com", "username": "Jan Kowalski", "password": "secret123" }
```

Ответ `201`: данные пользователя. Ошибки: `409` — email занят, `422` — невалидные данные.

### `POST /api/auth/login`

```json
{ "email": "jan@example.com", "password": "secret123" }
```

Ответ `200`:

```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

Ошибка `401` — неверный email или пароль.

### `POST /api/auth/logout`

JWT не хранит состояния на сервере — клиент удаляет токен. Ответ: `{"message": "..."}`.

### `GET /api/auth/me` 🔒

Данные текущего пользователя:

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

## Заведения — `/api/services`

### `GET /api/services/search`

| Параметр | Тип | Описание |
|---|---|---|
| `lat` | float | Широта (обязателен) |
| `lng` | float | Долгота (обязателен) |
| `radius` | int | Радиус в метрах, 500–5000 (по умолчанию 1000) |
| `category` | string | Ключ категории, например `pharmacy` (обязателен) |
| `sort` | string | `distance` (по умолчанию) или `opening_hours` |

Пример:

```
GET /api/services/search?lat=51.2465&lng=22.5684&radius=1000&category=pharmacy&sort=distance
```

Ответ:

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

`is_open`: `true` — открыто сейчас, `false` — закрыто, `null` — нет данных о часах работы.

Если запрос выполнен с JWT-токеном, поиск автоматически записывается в историю пользователя.

### `GET /api/services/geocode?q=<адрес>`

Геокодирование адреса через Nominatim (адрес → координаты, до 5 результатов, только Польша).

### `GET /api/services/{osm_id}`

Детали одного заведения из кеша. `404`, если заведения нет в кеше.

---

## Пользователь — `/api/users` (все 🔒)

### `GET /api/users/history`

Последние 50 поисков: `{"history": [{id, query, category, lat, lng, radius, results_count, searched_at}]}`.

### `DELETE /api/users/history`

Очищает историю. Ответ: `{"deleted": N}`.

### `GET /api/users/favorites`

`{"favorites": [{service_osm_id, service_name, service_category, lat, lng, note, saved_at}]}`.

### `POST /api/users/favorites`

```json
{ "osm_id": "node-123456789", "note": "Дежурная аптека" }
```

`note` опционально. Повторное добавление не создаёт дубликат (upsert). `404`, если заведения нет в кеше (нужно сначала выполнить поиск).

### `DELETE /api/users/favorites/{osm_id}`

`404`, если записи нет.

### `PATCH /api/users/settings`

Частичное обновление — можно передавать любое подмножество полей:

```json
{ "default_radius": 1500, "theme": "dark", "language": "en" }
```

Ответ — итоговые настройки.

---

## Отзывы — `/api/reviews`

### `GET /api/reviews/{osm_id}`

Сводка и список отзывов о месте (публично; с JWT помечает свой отзыв `is_mine`):

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

`rating` 1–5 (обязателен), `comment` опционален (до 500 символов). Один отзыв на
пользователя и место: повторная отправка обновляет существующий (upsert).

### `DELETE /api/reviews/{osm_id}` 🔒

Удаляет собственный отзыв. `404`, если его нет.

---

## Категории — `/api/categories`

### `GET /api/categories`

```json
{
  "categories": [
    { "key": "pharmacy", "icon": "💊", "names": { "pl": "Apteka", "en": "Pharmacy" } }
  ]
}
```

13 категорий: pharmacy, hospital, clinic, supermarket, convenience, restaurant, cafe, fast_food, bank, atm, fuel, dentist, post_office.
