import pandas as pd

# Hyderabad public holidays (approximate 2023-2026)
HYDERABAD_HOLIDAYS = {
    "2023-01-01", "2023-01-26", "2023-08-15", "2023-10-02", "2023-12-25",
    "2024-01-01", "2024-01-26", "2024-03-25", "2024-03-29",
    "2024-04-14", "2024-04-17", "2024-04-21", "2024-05-23",
    "2024-06-17", "2024-08-15", "2024-10-02", "2024-10-12",
    "2024-10-13", "2024-10-14", "2024-11-01", "2024-11-15",
    "2024-12-25",
    "2025-01-01", "2025-01-26", "2025-08-15", "2025-10-02", "2025-12-25",
    "2026-01-01", "2026-01-26", "2026-08-15", "2026-10-02", "2026-12-25",
    "2027-01-01", "2027-01-26", "2027-08-15", "2027-10-02", "2027-12-25",
}

def is_weekend(timestamp: pd.Timestamp) -> int:
    """Returns 1 if the timestamp falls on a weekend (Saturday or Sunday), 0 otherwise."""
    return 1 if timestamp.dayofweek >= 5 else 0

def is_public_holiday(timestamp: pd.Timestamp) -> int:
    """Returns 1 if the timestamp falls on a defined public holiday, 0 otherwise."""
    date_str = timestamp.strftime("%Y-%m-%d")
    return 1 if date_str in HYDERABAD_HOLIDAYS else 0
