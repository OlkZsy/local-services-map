"""Упрощённый парсер OSM-формата opening_hours (без внешних зависимостей).

Поддерживаются наиболее распространённые в OSM записи:
    24/7
    Mo-Fr 08:00-20:00; Sa 09:00-15:00
    Mo-Sa 07:00-22:00; Su off
    Mo,We,Fr 10:00-18:00
    08:00-20:00                     (без дней — каждый день)
    Mo-Fr 08:00-12:00,13:00-17:00   (перерыв)
    Fr-Sa 22:00-02:00               (ночные интервалы)

Если строка не распознана или отсутствует — возвращается None («нет данных»).
Время берётся локальное серверное (для локальной демонстрации в Польше этого
достаточно).
"""

from datetime import datetime

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_IGNORED_TOKENS = {"PH", "SH"}  # праздники/школьные каникулы не поддерживаем


def _parse_days(part: str) -> list[int] | None:
    days: set[int] = set()
    for token in part.split(","):
        token = token.strip()
        if not token or token in _IGNORED_TOKENS:
            continue
        if "-" in token:
            start, _, end = token.partition("-")
            if start not in DAYS or end not in DAYS:
                return None
            i, j = DAYS.index(start), DAYS.index(end)
            if i <= j:
                days.update(range(i, j + 1))
            else:  # например Sa-Mo — диапазон через воскресенье
                days.update(range(i, 7))
                days.update(range(0, j + 1))
        elif token in DAYS:
            days.add(DAYS.index(token))
        else:
            return None
    return sorted(days)


def _parse_time(value: str) -> int | None:
    """«HH:MM» -> минуты от полуночи (24:00 = 1440)."""
    hours, sep, minutes = value.strip().partition(":")
    if not sep:
        return None
    try:
        h, m = int(hours), int(minutes)
    except ValueError:
        return None
    if not (0 <= h <= 24 and 0 <= m <= 59):
        return None
    return h * 60 + m


def _build_schedule(value: str) -> dict[int, list[tuple[int, int]]] | None:
    """День недели (0=Mo) -> интервалы в минутах. None, если формат не распознан."""
    schedule: dict[int, list[tuple[int, int]]] = {}
    parsed_any = False

    for rule in value.split(";"):
        rule = rule.strip()
        if not rule:
            continue
        first, _, rest = rule.partition(" ")
        if first[0].isdigit():  # правило без дней: «08:00-20:00»
            days: list[int] = list(range(7))
            times_part = rule
        else:
            days_parsed = _parse_days(first)
            if days_parsed is None:
                return None
            if not days_parsed:  # правило только про PH/SH — пропускаем
                continue
            days = days_parsed
            times_part = rest.strip() or "off"

        if times_part.lower() in ("off", "closed"):
            for day in days:
                schedule[day] = []
            parsed_any = True
            continue

        intervals: list[tuple[int, int]] = []
        for chunk in times_part.split(","):
            start_s, sep, end_s = chunk.strip().partition("-")
            if not sep:
                return None
            start, end = _parse_time(start_s), _parse_time(end_s)
            if start is None or end is None:
                return None
            intervals.append((start, end))

        for day in days:
            schedule[day] = intervals  # позднее правило перекрывает раннее (семантика OSM)
        parsed_any = True

    return schedule if parsed_any else None


def is_open_now(value: str | None, now: datetime | None = None) -> bool | None:
    """True — открыто, False — закрыто, None — нет данных / формат не распознан."""
    if not value:
        return None
    value = value.strip()
    if value == "24/7":
        return True

    try:
        schedule = _build_schedule(value)
    except Exception:  # noqa: BLE001 — любой сбой разбора трактуем как «нет данных»
        return None
    if schedule is None:
        return None

    now = now or datetime.now()
    day = now.weekday()
    minutes = now.hour * 60 + now.minute

    for start, end in schedule.get(day, []):
        if end >= start:
            if start <= minutes < end:
                return True
        elif minutes >= start:  # ночной интервал, например 22:00-02:00
            return True

    # хвост ночного интервала предыдущего дня (открылись вчера, закроются сегодня)
    prev_day = (day - 1) % 7
    for start, end in schedule.get(prev_day, []):
        if end < start and minutes < end:
            return True

    return False
