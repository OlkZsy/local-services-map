# Instrukcja instalacji i uruchomienia

Kod aplikacji jest gotowy. Ręcznie trzeba zrobić tylko trzy rzeczy:

1. Uruchomić bazę MongoDB (Atlas **albo** lokalnie) — wymagane.
2. Utworzyć plik `backend/.env` — wymagane.
3. Pobrać klucz MapTiler — **opcjonalnie** (bez niego mapa działa na kafelkach OSM).

---

## Krok 1. Środowisko Pythona

Potrzebny jest Python 3.11+ (`python --version`).

```bash
cd local-services-map/backend

# utworzenie i aktywacja środowiska wirtualnego
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# instalacja zależności
pip install -r requirements.txt
```

---

## Krok 2. MongoDB — wybierz jeden z dwóch wariantów

### Wariant A: MongoDB Atlas (chmurowy, darmowy)

1. Załóż konto na <https://www.mongodb.com/cloud/atlas/register> (można przez Google).
2. Po zalogowaniu kliknij **Create** → wybierz klaster **M0 Free** (darmowy na zawsze).
   - Provider: dowolny (np. AWS), Region: najbliższy (np. `eu-central-1`, Frankfurt).
   - Nazwę klastra można zostawić `Cluster0`.
3. W oknie **Security Quickstart**:
   - **Utwórz użytkownika bazy**: wymyśl Username (np. `app_user`) i Password
     (kliknij Autogenerate i **zapisz hasło** — przyda się do `.env`).
   - **Network Access**: wybierz *Add My Current IP Address*. Dla projektu na uczelnię
     najprościej dać dostęp z każdego adresu: **Network Access** → **Add IP Address** →
     **Allow access from anywhere** (`0.0.0.0/0`).
4. Pobierz adres połączenia: **Database** → przycisk **Connect** przy klastrze →
   **Drivers** → skopiuj adres w stylu:
   ```
   mongodb+srv://app_user:<password>@cluster0.xxxxx.mongodb.net/
   ```
5. Wstaw prawdziwe hasło w miejsce `<password>` i zapisz adres w `MONGODB_URL`
   w pliku `backend/.env` (krok 4).

> Bazy ani kolekcji nie trzeba zakładać ręcznie — powstają same przy pierwszym użyciu.
> Wszystkie indeksy (2dsphere, TTL, unikatowe) aplikacja tworzy sama przy starcie.

Do podglądu danych zainstaluj [MongoDB Compass](https://www.mongodb.com/products/compass)
i połącz się tym samym adresem.

### Wariant B: lokalny MongoDB (bez internetu i rejestracji)

```bash
# Ubuntu/Debian
sudo apt install mongodb-org
sudo systemctl start mongod

# albo przez Docker (najprościej):
docker run -d --name mongo -p 27017:27017 mongo:7
```

W `.env` wpisz: `MONGODB_URL=mongodb://localhost:27017`.

---

## Krok 3. Klucz MapTiler (opcjonalnie)

Bez klucza aplikacja używa darmowych kafelków OpenStreetMap — do demonstracji to wystarcza.
Jeśli chcesz ładniejsze kafelki:

1. Załóż konto na <https://cloud.maptiler.com/> (darmowy plan: 100 000 kafelków/miesiąc).
2. W panelu: **API Keys** → skopiuj klucz.
3. Wpisz go w `MAPTILER_API_KEY` w pliku `backend/.env`.

---

## Krok 4. Plik `.env`

```bash
cd backend
cp .env.example .env
```

Otwórz `backend/.env` i uzupełnij:

```env
MONGODB_URL=mongodb+srv://app_user:TWOJE_HASLO@cluster0.xxxxx.mongodb.net/
MONGODB_DB_NAME=local_services_map

JWT_SECRET_KEY=tu-losowy-ciag-minimum-32-znaki
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

MAPTILER_API_KEY=          # puste = kafelki OSM

CACHE_TTL_DAYS=7
DEBUG=true
```

Tajny klucz JWT wygodnie wygenerować tak:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> Plik `.env` jest już w `.gitignore` — nie trafi do repozytorium.

---

## Krok 5. Uruchomienie

```bash
cd backend
source venv/bin/activate   # jeśli jeszcze nieaktywne
uvicorn app.main:app --reload --port 8000
```

Otwórz w przeglądarce:

| URL | Co to |
|---|---|
| <http://localhost:8000> | aplikacja (mapa) |
| <http://localhost:8000/docs> | Swagger — interaktywna dokumentacja API |

W logu przy starcie powinno pojawić się `MongoDB connected, indexes created`.
Jeśli zamiast tego jest ostrzeżenie o braku połączenia — sprawdź `MONGODB_URL`
oraz dostęp sieciowy w Atlasie (Network Access).

---

## Krok 6. Szybki test działania

1. Otwórz <http://localhost:8000> — przeglądarka zapyta o zgodę na lokalizację.
   - Zgoda → mapa centruje się na Tobie.
   - Odmowa → mapa pokazuje Lublin (51.2465, 22.5684).
2. W polu wyszukiwania zacznij wpisywać `apteka` → wybierz kategorię z listy →
   na mapie pojawią się znaczniki (zielona ramka = otwarte, szara = zamknięte,
   żółta = brak danych), na dole panel z wynikami.
   *Pierwsze wyszukiwanie danej kategorii w okolicy trwa 1–3 sekundy (zapytanie do Overpass),
   kolejne — natychmiast (bufor w MongoDB).*
3. Kliknij 👤 → **Zarejestruj się** → utwórz konto → dodaj obiekt do ulubionych (⭐) →
   sprawdź, że pojawił się w profilu.
4. Otwórz ⚙️ → zmień promień, motyw i język → powtórz wyszukiwanie.

API bez frontendu można testować przez Swagger (<http://localhost:8000/docs>).

---

## Częste problemy

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| `Brak połączenia z serwerem` na froncie | serwer nie jest uruchomiony albo otwarty jest zły port |
| Ostrzeżenie o MongoDB w logu | błędny `MONGODB_URL`, brak dostępu sieciowego (Atlas → Network Access), nieuruchomiony lokalny mongod |
| Wyszukiwanie zwraca 0 wyników | za mały promień albo Overpass API chwilowo niedostępny (spróbuj później lub zaimportuj `data/seed_data.json`) |
| Mapa szara, brak kafelków | brak internetu albo błędny klucz MapTiler (usuń klucz z `.env` — włączą się kafelki OSM) |
| Geolokalizacja nie działa | przeglądarki pozwalają na geolokalizację tylko na `localhost` lub po HTTPS; upewnij się, że otwarty jest `http://localhost:8000` |
| Błąd bcrypt przy rejestracji | sprawdź, czy zainstalowany jest `bcrypt==4.0.1` (patrz requirements.txt) |
