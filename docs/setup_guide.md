# Инструкция по установке и настройке (ручные шаги)

Код проекта полностью готов. Вручную нужно сделать только три вещи:

1. Поднять MongoDB (Atlas **или** локально) — обязательно.
2. Создать файл `backend/.env` — обязательно.
3. Получить ключ MapTiler — **опционально** (без него карта работает на тайлах OSM).

---

## Шаг 1. Python-окружение

Требуется Python 3.11+ (`python --version`).

```bash
cd local-services-map/backend

# создать и активировать виртуальное окружение
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# установить зависимости
pip install -r requirements.txt
```

---

## Шаг 2. MongoDB — выберите один из двух вариантов

### Вариант A: MongoDB Atlas (по спецификации, облачный, бесплатный)

1. Зарегистрируйтесь на <https://www.mongodb.com/cloud/atlas/register> (можно через Google).
2. После входа нажмите **Create** → выберите кластер **M0 Free** (бесплатный навсегда).
   - Provider: любой (например AWS), Region: ближайший (например `eu-central-1`, Frankfurt).
   - Имя кластера можно оставить `Cluster0`.
3. В появившемся окне **Security Quickstart**:
   - **Создайте пользователя БД**: придумайте Username (например `app_user`) и Password
     (нажмите Autogenerate и **сохраните пароль** — он понадобится для `.env`).
   - **Network Access**: выберите *Add My Current IP Address*.
     Для учебного проекта проще разрешить доступ отовсюду: вкладка
     **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
4. Получите строку подключения: **Database** → кнопка **Connect** у кластера →
   **Drivers** → скопируйте URI вида:
   ```
   mongodb+srv://app_user:<password>@cluster0.xxxxx.mongodb.net/
   ```
5. Подставьте реальный пароль вместо `<password>` и запишите строку в `MONGODB_URL`
   в файле `backend/.env` (шаг 4).

> Базу данных и коллекции создавать вручную **не нужно** — они создаются автоматически
> при первом обращении. Все индексы (2dsphere, TTL, уникальные) приложение создаёт
> само при старте.

Для просмотра данных установите [MongoDB Compass](https://www.mongodb.com/products/compass)
и подключитесь той же строкой URI.

### Вариант B: локальный MongoDB (без интернета и регистрации)

```bash
# Ubuntu/Debian (см. https://www.mongodb.com/docs/manual/installation/ для других ОС)
sudo apt install mongodb-org
sudo systemctl start mongod

# Docker — самый простой способ:
docker run -d --name mongo -p 27017:27017 mongo:7
```

В `.env` укажите: `MONGODB_URL=mongodb://localhost:27017`.

---

## Шаг 3. Ключ MapTiler (опционально)

Без ключа приложение автоматически использует бесплатные тайлы OpenStreetMap —
для демонстрации этого достаточно. Если нужны тайлы «как в Google Maps»:

1. Зарегистрируйтесь на <https://cloud.maptiler.com/> (бесплатный тариф: 100 000 тайлов/мес).
2. В личном кабинете: **API Keys** → скопируйте ключ (или создайте новый).
3. Запишите его в `MAPTILER_API_KEY` в `backend/.env`.

---

## Шаг 4. Файл `.env`

```bash
cd backend
cp .env.example .env
```

Откройте `backend/.env` и заполните:

```env
MONGODB_URL=mongodb+srv://app_user:ВАШ_ПАРОЛЬ@cluster0.xxxxx.mongodb.net/
MONGODB_DB_NAME=local_services_map

JWT_SECRET_KEY=сюда-случайная-строка-минимум-32-символа
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

MAPTILER_API_KEY=          # пусто = тайлы OSM

CACHE_TTL_DAYS=7
DEBUG=true
```

Секретный ключ JWT удобно сгенерировать так:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> `.env` уже добавлен в `.gitignore` — он не попадёт в репозиторий.

---

## Шаг 5. Запуск

```bash
cd backend
source venv/bin/activate   # если ещё не активировано
uvicorn app.main:app --reload --port 8000
```

Откройте в браузере:

| URL | Что это |
|---|---|
| <http://localhost:8000> | Приложение (карта) |
| <http://localhost:8000/docs> | Swagger — интерактивная документация API |

В логе при старте должно появиться `MongoDB подключена, индексы созданы`.
Если вместо этого предупреждение о недоступности MongoDB — проверьте `MONGODB_URL`
и сетевой доступ в Atlas (Network Access).

---

## Шаг 6. Проверка работы (smoke-тест)

1. Откройте <http://localhost:8000> — браузер спросит разрешение на геолокацию.
   - Разрешите → карта центрируется на вас.
   - Откажите → карта покажет Люблин (51.2465, 22.5684).
2. В строке поиска начните вводить `apteka` → выберите категорию из выпадающего
   списка → на карте появятся маркеры (зелёная рамка = открыто, серая = закрыто,
   жёлтая = нет данных), снизу — панель результатов.
   *Первый поиск категории в районе занимает 1–3 секунды (запрос к Overpass),
   повторные — мгновенно (кеш MongoDB).*
3. Нажмите 👤 → **Zarejestruj się** → создайте аккаунт → добавьте заведение
   в избранное (⭐) → проверьте, что оно появилось в панели профиля.
4. Откройте ⚙️ → поменяйте радиус, тему и язык → повторите поиск.

Тестирование API без фронтенда — через Swagger (<http://localhost:8000/docs>)
или REST Client / Postman (см. `docs/api_reference.md`).

---

## Частые проблемы

| Симптом | Причина / решение |
|---|---|
| `Brak połączenia z serwerem` на фронтенде | Бэкенд не запущен, либо открыт не тот порт |
| Предупреждение про MongoDB в логе | Неверный `MONGODB_URL`, нет доступа по сети (Atlas → Network Access), не запущен локальный mongod |
| Поиск возвращает 0 результатов | Слишком маленький радиус, либо Overpass API временно недоступен (попробуйте позже или импортируйте `data/seed_data.json`) |
| Карта серая, нет тайлов | Нет интернета, либо невалидный ключ MapTiler (уберите ключ из `.env` — включатся тайлы OSM) |
| Геолокация не работает | Браузеры разрешают геолокацию только на `localhost` или HTTPS; убедитесь, что открыт именно `http://localhost:8000` |
| Ошибка bcrypt при регистрации | Убедитесь, что установлен `bcrypt==4.0.1` (см. requirements.txt) |
