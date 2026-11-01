"""Reading the date printed on a report, and writing dates the way she reads them."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

_MONTHS = {
    m: i
    for i, names in enumerate(
        [
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ],
        start=1,
    )
    for m in names
}

_EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_HI_MONTHS = [
    "जनवरी",
    "फ़रवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
]

EARLIEST = date(2000, 1, 1)


def _valid(y: int, m: int, d: int, today: date) -> Optional[date]:
    if y < 100:
        y += 2000
    try:
        found = date(y, m, d)
    except ValueError:
        return None
    return found if EARLIEST <= found <= today else None


def parse_report_date(text: Optional[str], today: Optional[date] = None) -> Optional[str]:
    """
    The ISO date in what the model read off the report, or None. Numeric dates are
    read day-first, as Indian reports print them; a future or implausible date is
    treated as unread rather than trusted.
    """
    if not text:
        return None
    today = today or datetime.now().date()
    s = text.strip().lower()

    m = re.search(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b", s)
    if m:
        return _iso(_valid(int(m.group(1)), int(m.group(2)), int(m.group(3)), today))
    m = re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b", s)
    if m:
        return _iso(_valid(int(m.group(3)), int(m.group(2)), int(m.group(1)), today))
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([a-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})\b", s)
    if m and m.group(2) in _MONTHS:
        return _iso(_valid(int(m.group(3)), _MONTHS[m.group(2)], int(m.group(1)), today))
    m = re.search(r"\b([a-z]{3,9})[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{4})\b", s)
    if m and m.group(1) in _MONTHS:
        return _iso(_valid(int(m.group(3)), _MONTHS[m.group(1)], int(m.group(2)), today))
    return None


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def format_date(iso: Optional[str], lang: str) -> str:
    """'2026-09-03' -> '3 Sep 2026' (or '3 सितंबर 2026'). Unparseable text is returned as is."""
    if not iso:
        return ""
    try:
        d = date.fromisoformat(iso[:10])
    except ValueError:
        return iso
    months = _HI_MONTHS if lang == "hi" else _EN_MONTHS
    return f"{d.day} {months[d.month - 1]} {d.year}"
