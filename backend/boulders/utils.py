"""
Utility functions for the boulders app.
"""

import unicodedata
import re


def normalize_problem_name(name):
    """
    Normalize a problem name for safe lookups.

    This function:
    - Removes diacritics (accents) from characters
    - Converts to lowercase
    - Removes extra whitespace
    - Handles special characters

    Examples:
        "Dívčí válka" -> "divci valka"
        "Vlnová dálka" -> "vlnova dalka"
        "Palcošmé" -> "palcosme"
        "Barbařiny první krůčky" -> "barbariny prvni krucky"

    Args:
        name (str): The original problem name

    Returns:
        str: Normalized name suitable for lookups
    """
    if not name:
        return ""

    # Convert to unicode normalized form (NFD) to separate base characters from diacritics
    # Then remove combining characters (diacritics)
    normalized = unicodedata.normalize("NFD", str(name))
    # Remove combining characters (diacritics)
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )

    # Convert to lowercase
    normalized = normalized.lower()

    # Remove extra whitespace and strip
    normalized = re.sub(r"\s+", " ", normalized).strip()

    return normalized
