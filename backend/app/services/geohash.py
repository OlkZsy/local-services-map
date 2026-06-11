"""Минимальная реализация geohash (без внешних зависимостей).

Используется как ключ области кеширования: точность 5 символов
соответствует ячейке примерно 4.9 x 4.9 км.
"""

_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def encode(lat: float, lng: float, precision: int = 5) -> str:
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    result = []
    bit = 0
    char_index = 0
    even = True  # чётные биты — долгота, нечётные — широта

    while len(result) < precision:
        if even:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng > mid:
                char_index = (char_index << 1) | 1
                lng_range[0] = mid
            else:
                char_index <<= 1
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat > mid:
                char_index = (char_index << 1) | 1
                lat_range[0] = mid
            else:
                char_index <<= 1
                lat_range[1] = mid
        even = not even
        bit += 1
        if bit == 5:
            result.append(_BASE32[char_index])
            bit = 0
            char_index = 0

    return "".join(result)


def decode_center(geohash: str) -> tuple[float, float]:
    """Возвращает (lat, lng) центра ячейки geohash."""
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    even = True

    for char in geohash:
        value = _BASE32.index(char)
        for shift in range(4, -1, -1):
            bit = (value >> shift) & 1
            target = lng_range if even else lat_range
            mid = (target[0] + target[1]) / 2
            if bit:
                target[0] = mid
            else:
                target[1] = mid
            even = not even

    return (
        (lat_range[0] + lat_range[1]) / 2,
        (lng_range[0] + lng_range[1]) / 2,
    )
