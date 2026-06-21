# Деплой в интернет (бесплатно)

Локально проект работает с локальной MongoDB, но для публичного доступа нужна
облачная БД. Здесь — деплой на **Render** (рекомендуется) с **MongoDB Atlas**.
Всё бесплатно. Результат — публичная ссылка с HTTPS, на которой работает в том
числе геолокация на телефоне и установка PWA.

---

## Шаг 1. MongoDB Atlas (облачная БД)

Если ещё не делали — поднимите бесплатный кластер (подробно в
[setup_guide.md](setup_guide.md), раздел «Вариант A»):

1. <https://www.mongodb.com/cloud/atlas/register> → создайте кластер **M0 Free**.
2. Создайте пользователя БД (запомните логин и пароль).
3. **Network Access** → **Add IP Address** → **Allow access from anywhere**
   (`0.0.0.0/0`). Это обязательно: IP-адреса Render заранее неизвестны.
4. **Connect → Drivers** → скопируйте строку вида
   `mongodb+srv://user:ПАРОЛЬ@cluster0.xxxxx.mongodb.net/`.

---

## Шаг 2. Залить проект на GitHub

Репозиторий уже на GitHub. Убедитесь, что ветка с кодом запушена
(`git push`). Файл `.env` в репозиторий **не попадает** (он в `.gitignore`) —
секреты на сервере задаются отдельно (шаг 3).

---

## Шаг 3. Render

В репозитории уже есть `render.yaml` — Render всё настроит сам.

1. Зарегистрируйтесь на <https://render.com> (через GitHub).
2. **New + → Blueprint** → выберите репозиторий `local-services-map`.
3. Render прочитает `render.yaml` и предложит создать сервис. Перед запуском
   задайте секреты (вкладка Environment):
   - **`MONGODB_URL`** — строка подключения из Atlas (с реальным паролем).
   - **`MAPTILER_API_KEY`** — можно оставить пустым (тогда тайлы OSM).
   - `JWT_SECRET_KEY` Render сгенерирует сам.
4. Нажмите **Apply / Create**. Первая сборка займёт 2–4 минуты.
5. Готово — приложение будет доступно по адресу вида
   `https://local-services-map.onrender.com`.

> **Альтернатива без `render.yaml`:** New + → **Web Service** → выбрать репозиторий →
> Root Directory: `backend`, Build: `pip install -r requirements.txt`,
> Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Переменные среды
> добавьте вручную по образцу `backend/.env.example`.

---

## Альтернатива: Railway

1. <https://railway.app> → New Project → Deploy from GitHub repo.
2. В настройках сервиса: **Root Directory** = `backend` (там лежат `Procfile`,
   `requirements.txt`, `runtime.txt`).
3. Во вкладке **Variables** добавьте переменные из `backend/.env.example`
   (как минимум `MONGODB_URL` и `JWT_SECRET_KEY`).
4. Railway сам определит запуск из `Procfile`.

---

## Особенности бесплатного тарифа Render

- Сервис **засыпает** после 15 минут простоя; первый запрос после сна
  «будит» его ~30–50 секунд. Для демонстрации откройте сайт заранее.
- Бесплатный план — общие ресурсы, этого достаточно для дипломной демонстрации.

---

## Проверка после деплоя

| URL | Что проверить |
|---|---|
| `https://<app>.onrender.com` | Карта, поиск, выезжающая панель |
| `https://<app>.onrender.com/docs` | Swagger — все эндпоинты |
| С телефона | Геолокация работает (HTTPS!), браузер предложит «Установить приложение» (PWA) |

Если карта пустая или поиск не находит ничего — проверьте логи в дашборде
Render: чаще всего причина в `MONGODB_URL` (неверный пароль или не открыт
доступ `0.0.0.0/0` в Atlas → Network Access).
