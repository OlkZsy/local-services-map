# 📍 Local Services Map

**Системный поиск доступности локальных услуг с геолокацией** — дипломный проект магистратуры.

Локальное веб-приложение: интерактивная карта поиска заведений (аптеки, больницы,
рестораны, магазины и т.д.) на территории Польши с геолокацией пользователя,
радиусом поиска, статусом «открыто/закрыто», избранным и историей поисков.

Работает полностью локально (`localhost:8000`) — без хостинга и без оплаты.

---

## Возможности

- 🗺️ Карта (Leaflet + MapTiler/OSM) с центрированием по геолокации браузера
- 🔍 Поиск 13 категорий заведений с автодополнением (PL/RU/EN)
- 📏 Настраиваемый радиус поиска 0.5–5 км с кругом на карте
- 🟢/🔴 Статус «открыто/закрыто» (парсинг OSM `opening_hours`)
- 📋 Выдвижная нижняя панель результатов (свайп) с сортировкой по расстоянию / времени работы
- 🧲 Кластеризация маркеров
- 👤 Регистрация и вход (JWT), избранные места, история поисков
- 💬 Отзывы и оценки мест (1–5 звёзд) с подсчётом среднего рейтинга
- ⚙️ Настройки: радиус, светлая/тёмная тема, язык интерфейса (PL/EN)
- 📱 Адаптивный дизайн (от 320 px) + PWA (установка на телефон, офлайн-режим)
- ⚡ Кеширование данных Overpass в MongoDB (TTL 7 дней) — повторные поиски < 200 мс

## Стек

| Слой | Технологии |
|---|---|
| Бэкенд | Python 3.11+, FastAPI, Uvicorn, Motor (MongoDB), Pydantic v2, python-jose (JWT), passlib+bcrypt, httpx |
| БД | MongoDB 7 (Atlas M0 Free или локальный), геоиндексы 2dsphere, TTL-индексы |
| Фронтенд | HTML5, CSS3 (+ CSS Variables), Tailwind CSS (CDN), Vanilla JS (ES-модули), Leaflet 1.9.4, Leaflet.markercluster, Lucide Icons |
| Внешние API | Overpass API (OSM), Nominatim (геокодирование), MapTiler (тайлы, опционально) |

## Быстрый старт

```bash
git clone https://github.com/OlkZsy/local-services-map.git
cd local-services-map/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # заполнить MONGODB_URL и JWT_SECRET_KEY!

uvicorn app.main:app --reload --port 8000
```

Откройте <http://localhost:8000> (приложение) и <http://localhost:8000/docs> (Swagger).

**👉 Подробная пошаговая инструкция (MongoDB Atlas, MapTiler, .env, проверка):
[docs/setup_guide.md](docs/setup_guide.md)**

## Документация

| Файл | Содержание |
|---|---|
| [docs/setup_guide.md](docs/setup_guide.md) | Установка и ручные шаги (Atlas, MapTiler, .env) |
| [docs/deploy_guide.md](docs/deploy_guide.md) | Деплой в интернет (Render + Atlas, бесплатно) |
| [docs/specification.md](docs/specification.md) | Полная техническая спецификация проекта |
| [docs/api_reference.md](docs/api_reference.md) | Описание всех эндпоинтов с примерами |
| [docs/database_schema.md](docs/database_schema.md) | Схемы коллекций MongoDB и индексы |

## Структура проекта

```
local-services-map/
├── backend/
│   ├── app/
│   │   ├── main.py              # точка входа FastAPI (API + раздача статики)
│   │   ├── config.py            # настройки из .env
│   │   ├── database.py          # MongoDB + автосоздание индексов
│   │   ├── models/              # Pydantic-схемы (user, service, search)
│   │   ├── routes/              # auth, services, users, categories, reviews
│   │   ├── services/            # overpass, geocoding, cache, geohash,
│   │   │                        # opening_hours (парсер), auth_service (JWT)
│   │   └── static/              # фронтенд (SPA) + PWA: index.html, css/, js/,
│   │                            # manifest.webmanifest, sw.js, icons/
│   ├── Procfile                 # запуск для Railway/Render
│   ├── runtime.txt             # версия Python для хостинга
│   ├── .env.example
│   └── requirements.txt
├── docs/                        # документация
├── data/seed_data.json          # опциональные тестовые данные (Люблин)
└── README.md
```

## Архитектура

```
Браузер ── localhost:8000 ── FastAPI ──┬── MongoDB (users, services_cache,
        (статика + REST API)           │            search_history, favorites)
                                       ├── Overpass API (OSM) — при промахе кеша
                                       └── Nominatim — геокодирование
```

Данные о заведениях запрашиваются у Overpass API и кешируются в MongoDB по ключу
`категория + geohash области` с TTL 7 дней; геопоиск по кешу выполняет MongoDB
(`$geoNear`, индекс 2dsphere).

## Улучшения относительно исходной спецификации

Функциональность и «стоимость» проекта (всё бесплатно) не изменены, добавлены
только обходные пути и устойчивость:

1. **MapTiler-ключ опционален** — без ключа автоматический фолбэк на бесплатные
   тайлы OpenStreetMap: приложение запускается вообще без регистраций.
2. **Локальный MongoDB как альтернатива Atlas** — работает без интернета.
3. **`GET /api/config`** — ключ тайлов отдаётся бэкендом, а не хардкодится в JS.
4. **Устойчивое кеширование** — отдельная коллекция `cache_areas`
   (категория + geohash), upsert заведений по `osm_id`; при недоступности
   Overpass API отдаётся имеющийся кеш вместо ошибки.
5. **Собственный парсер `opening_hours`** — без дополнительных зависимостей,
   поддерживает основные форматы OSM включая ночные интервалы и `24/7`.
6. **Автосоздание всех индексов MongoDB при старте** — ручная настройка БД не нужна.
7. **Бонус: `GET /api/services/geocode`** (Nominatim) — задел для поиска по адресу.
8. `bcrypt` зафиксирован на 4.0.1 (известная несовместимость passlib с bcrypt 4.1+).
