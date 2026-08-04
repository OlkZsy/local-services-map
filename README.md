# Local Services Map

A geolocation web application for finding nearby services — pharmacies, shops, restaurants,
banks — built on a document database with geospatial queries.

`FastAPI` · `MongoDB` · `JavaScript` · `Leaflet` · `PWA`

![Search results shown on the map] <img width="921" height="532" alt="image" src="https://github.com/user-attachments/assets/2381681d-4b1c-47d7-8261-c8d6a0519c1e" />


---

## Overview

The user opens a map centred on their current position, picks a category of place and a search
radius, and sees matching locations as map markers plus a sortable result list. Registered users
can save favourites, browse their search history and leave reviews.

Place data comes from OpenStreetMap through the Overpass API and is cached in MongoDB, so the
same area is never fetched twice within the cache lifetime. The project was built to demonstrate
a practical use of a document database in a web application — specifically the document model,
indexing strategy and geospatial queries.

## Features

- Search by category and radius around the user's position or any geocoded address
- 13 place categories mapped to OpenStreetMap tags (pharmacy, hospital, supermarket, bank, ATM, fuel, and others)
- Interactive map with marker clustering; results also shown as a sortable list
- Open / closed status derived from the OSM `opening_hours` field
- User accounts with JWT authentication: favourites, search history, reviews
- Responsive layout, installable as a PWA (service worker + web manifest)
- Auto-generated interactive API documentation at `/docs`

## Tech stack

**Backend** — Python 3.11, FastAPI, Uvicorn (ASGI), Motor (async MongoDB driver), Pydantic v2,
python-jose (JWT), passlib + bcrypt, httpx, python-dotenv

**Database** — MongoDB 7 with `2dsphere` geospatial indexes and TTL indexes

**Frontend** — HTML5, CSS3, vanilla JavaScript (ES2022), Tailwind CSS, Leaflet 1.9 with
Leaflet.markercluster, Lucide Icons

**External APIs** — Overpass (place data), Nominatim (address geocoding), MapTiler (map tiles, optional)

## How it works

**Single-origin architecture.** One Uvicorn process serves both the REST API under `/api/*` and
the static frontend, on a single port. No CORS configuration, no separate frontend build step.

**Caching over the Overpass API.** Querying Overpass on every search is slow and puts unnecessary
load on a free public service. Results are cached in MongoDB under a `category + geohash` key: a
search first checks the cache for that category and grid cell, and only falls through to Overpass
on a miss. Cached entries live for 7 days and are removed automatically by a TTL index on
`cache_expires_at`, so no cleanup job is needed.

**Geospatial queries in the database, not in the application.** Places are stored as GeoJSON
points with a `2dsphere` index, which lets MongoDB answer "everything within N metres of this
point" directly. Filtering by distance in Python would mean loading the whole collection first.

**Opening-hours parser.** The OSM `opening_hours` field is free-form text
(`Mo-Fr 08:00-20:00; Sa 09:00-14:00`). A custom parser turns it into an open / closed / unknown
status; unparsable or missing values fall back to "no data" rather than guessing.

**Data integrity through indexes.** Unique compound indexes prevent duplicate accounts, duplicate
favourites and more than one review per user per place, so these rules hold at the database level
rather than only in application code.

## Getting started

**Requirements:** Python 3.11+ and a MongoDB instance (local, Docker or a free Atlas cluster).

```bash
git clone https://github.com/OlkZsy/local-services-map.git
cd local-services-map/backend

python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

Start MongoDB locally if you do not use Atlas:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

Create `backend/.env`:

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=local_services_map

JWT_SECRET_KEY=replace-with-a-random-string-of-at-least-32-characters
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

MAPTILER_API_KEY=              # optional — OSM tiles are used when empty
```

Run the application:

```bash
uvicorn app.main:app --reload
```

Open <http://localhost:8000>. Collections and all indexes (2dsphere, TTL, unique) are created
automatically on first start — no manual database setup is required.

Detailed instructions, including MongoDB Atlas setup: [docs/setup_guide.md](docs/setup_guide.md).

## API

Interactive documentation is available at `http://localhost:8000/docs` once the app is running.
Endpoints marked 🔒 require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Client configuration |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Obtain a JWT |
| `GET` | `/api/auth/me` 🔒 | Current user |
| `GET` | `/api/services/search` | Search places by category and radius |
| `GET` | `/api/services/geocode` | Geocode an address |
| `GET` | `/api/services/{osm_id}` | Place details |
| `GET` | `/api/users/favorites` 🔒 | List favourites |
| `POST` | `/api/users/favorites` 🔒 | Add a favourite |
| `GET` | `/api/users/history` 🔒 | Search history |
| `GET` | `/api/reviews/{osm_id}` | Reviews for a place |
| `POST` | `/api/reviews/{osm_id}` 🔒 | Add a review |
| `GET` | `/api/categories` | Available categories |

Full reference: [docs/api_reference.md](docs/api_reference.md).

## Database

Six collections: `users`, `services_cache`, `cache_areas`, `search_history`, `favorites`,
`reviews`. Document structures and the full index list are described in
[docs/database_schema.md](docs/database_schema.md).

## Project structure

```
backend/
├── app/
│   ├── main.py            # application entry point, static file serving
│   ├── config.py          # settings loaded from environment variables
│   ├── database.py        # MongoDB connection and index creation
│   ├── models/            # Pydantic models
│   ├── routes/            # API routers: auth, services, users, reviews, categories
│   ├── services/          # business logic: geocoding, geohash, cache, Overpass, opening hours
│   └── static/            # single-page frontend, service worker, manifest
└── requirements.txt
data/seed_data.json        # sample data
docs/                      # specification, API reference, database schema, setup guide
```

## Documentation

- [Project specification](docs/specification.md)
- [API reference](docs/api_reference.md)
- [Database schema](docs/database_schema.md)
- [Setup guide](docs/setup_guide.md)

*Documentation in `docs/` is written in Polish.*
