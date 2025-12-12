"""
Service functions for lists app.
"""

from datetime import datetime
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

from boulders.models import BoulderProblem, Area
from .models import Tick


def _encode_to_lezec_hex(text, uppercase=False, use_windows1250=False):
    """
    Encode text to lezec.cz hex format.

    Args:
        text: Text to encode
        uppercase: If True, use uppercase hex (default: False, lowercase)
        use_windows1250: If True, encode to windows-1250 bytes first, then to hex
                         (default: False, use Unicode code points)
    """
    if use_windows1250:
        try:
            # Encode to windows-1250 bytes, then convert each byte to hex
            bytes_encoded = text.encode("windows-1250")
            if uppercase:
                return "".join(f"{b:02X}" for b in bytes_encoded)
            return "".join(f"{b:02x}" for b in bytes_encoded)
        except (UnicodeEncodeError, LookupError):
            # Fallback to Unicode if windows-1250 encoding fails
            pass

    # Default: Use Unicode code points
    if uppercase:
        return "".join(f"{ord(c):02X}" for c in text)
    return "".join(f"{ord(c):02x}" for c in text)


def _try_fetch_diary(base_url, identifier, uppercase_hex=False, use_windows1250=False):
    """
    Try to fetch diary page with a given identifier.

    Args:
        base_url: Base URL for lezec.cz
        identifier: Username to try
        uppercase_hex: If True, use uppercase hex encoding
        use_windows1250: If True, encode to windows-1250 bytes first

    Returns:
        tuple: (soup, success) where success is True if diary was found
    """
    diary_url = f"{base_url}/denik.php"

    # Encode identifier to hex
    identifier_hex = _encode_to_lezec_hex(
        identifier, uppercase=uppercase_hex, use_windows1250=use_windows1250
    )

    params = {
        "par": "1",
        "uid": f"{identifier_hex}h",
        "ckat": "3",  # bouldry
        "cstl": "0",  # all styles
        "crok": "9997",  # all years
    }

    try:
        response = requests.get(diary_url, params=params, timeout=30)
        response.raise_for_status()
        response.encoding = "windows-1250"

        soup = BeautifulSoup(
            response.content, "html.parser", from_encoding="windows-1250"
        )

        # Check if this looks like a valid diary page
        page_text = soup.get_text().lower()
        if "deníček" in page_text or "denik" in page_text:
            # Try to extract ticks to verify it's a valid diary
            ticks = _extract_ticks_from_diary(soup, base_url)
            if ticks or "deníček" in page_text:
                return soup, True

        return soup, False
    except requests.RequestException:
        return None, False


def import_lezec_diary(user, lezec_username):
    """
    Import ticks from lezec.cz public diary for a user.

    Args:
        user: Django User instance
        lezec_username: Lezec.cz username (can contain Czech characters)

    Returns:
        dict with statistics about the import
    """
    base_url = "https://www.lezec.cz"

    # Normalize username - try lowercase first (most common), but also try other variations
    # Username input is case-insensitive, so we try multiple case variations
    username_lower = lezec_username.lower()
    username_upper = lezec_username.upper()
    username_capitalized = (
        lezec_username[0].upper() + lezec_username[1:].lower()
        if len(lezec_username) > 1
        else lezec_username.upper()
    )

    # Try multiple strategies to find the diary
    # IMPORTANT: For Czech characters, windows-1250 encoding should be tried FIRST
    # because lezec.cz expects bytes encoded in windows-1250, not Unicode code points
    strategies = []

    # Strategy 1: Try lowercase with windows-1250 encoding FIRST (most common + correct encoding)
    strategies.append((username_lower, False, True))

    # Strategy 2: Try lowercase with Unicode encoding
    strategies.append((username_lower, False, False))

    # Strategy 3: Try original case with windows-1250 (in case user typed it correctly)
    strategies.append((lezec_username, False, True))

    # Strategy 4: Try original case with Unicode
    strategies.append((lezec_username, False, False))

    # Strategy 5: Try capitalized with windows-1250
    strategies.append((username_capitalized, False, True))
    strategies.append((username_capitalized, False, False))

    # Strategy 6: Try uppercase with windows-1250
    strategies.append((username_upper, False, True))
    strategies.append((username_upper, False, False))

    # Strategy 7: Try with uppercase hex variations (less common, but just in case)
    strategies.append((username_lower, True, True))
    strategies.append((lezec_username, True, True))

    # Try all strategies
    soup = None
    found = False
    tried_identifiers = set()

    for identifier, uppercase_hex, use_w1250 in strategies:
        # Skip duplicates
        strategy_key = (identifier, uppercase_hex, use_w1250)
        if strategy_key in tried_identifiers:
            continue
        tried_identifiers.add(strategy_key)

        soup, found = _try_fetch_diary(base_url, identifier, uppercase_hex, use_w1250)

        if found:
            break

    if not found:
        return {
            "success": False,
            "message": f"Could not find diary for '{lezec_username}'. Please check:\n"
            f"1. The username is correct\n"
            f"2. The diary is set to public on lezec.cz",
            "matched": 0,
            "created": 0,
            "existing": 0,
            "not_found": 0,
            "errors": 0,
        }

    # Extract ticks from the diary
    ticks = _extract_ticks_from_diary(soup, base_url)

    if not ticks:
        # Check if the page might indicate the diary is private or user doesn't exist
        page_text = soup.get_text().lower() if soup else ""

        if "deníček" in page_text or "denik" in page_text:
            # Page loaded but no ticks - could be empty diary or wrong filters
            return {
                "success": False,
                "message": "No boulder ticks found in diary. The diary might be empty, private, or the username might be incorrect.",
                "matched": 0,
                "created": 0,
                "existing": 0,
                "not_found": 0,
                "errors": 0,
            }
        else:
            # Page doesn't look like a diary page - might be wrong username
            return {
                "success": False,
                "message": "Could not find diary page. The username might be incorrect or the diary might not be public.",
                "matched": 0,
                "created": 0,
                "existing": 0,
                "not_found": 0,
                "errors": 0,
            }

    # Filter for Moravský Kras only
    moravsky_kras_areas = [
        "Panský Les",
        "Sloup",
        "Holštejn",
        "Rudice",
        "Ostrov",
        "Ostaš",
        "Ludvíkov",
        "Ludvíkov (Nad Hřbitovem)",
        "Moravský Kras",
    ]

    moravsky_kras_ticks = [
        tick
        for tick in ticks
        if tick.get("location") in moravsky_kras_areas
        or "Moravský" in tick.get("location", "")
        or "Kras" in tick.get("location", "")
    ]

    if not moravsky_kras_ticks:
        return {
            "success": False,
            "message": "No ticks found for Moravský Kras location",
            "matched": 0,
            "created": 0,
            "existing": 0,
            "not_found": 0,
            "errors": 0,
        }

    # Match boulders and create ticks
    stats = {
        "matched": 0,
        "created": 0,
        "existing": 0,
        "not_found": 0,
        "errors": 0,
    }

    for tick_data in moravsky_kras_ticks:
        boulder_name = tick_data.get("name")
        boulder_id = tick_data.get("lezec_id")
        date = tick_data.get("date")
        style = tick_data.get("style", "")

        # Try to find matching boulder problem
        problem = None

        # Strategy 1: Try by external link (lezec.cz ID) - fastest method
        if boulder_id:
            # Get Moravský Kras areas first to narrow down search
            moravsky_kras_areas = Area.objects.filter(
                name__icontains="Moravský"
            ) | Area.objects.filter(name__icontains="Kras")

            # Also include areas that match the area from the tick
            tick_area = tick_data.get("location", "")
            if tick_area:
                matching_areas = Area.objects.filter(name__icontains=tick_area)
                moravsky_kras_areas = moravsky_kras_areas | matching_areas

            if moravsky_kras_areas.exists():
                boulders_to_check = BoulderProblem.objects.filter(
                    area__in=moravsky_kras_areas
                )
            else:
                boulders_to_check = BoulderProblem.objects.all()

            # Check external_links for matching lezec.cz URL
            for boulder in boulders_to_check:
                if not boulder.external_links:
                    continue
                for link in boulder.external_links:
                    link_url = link.get("url", "")
                    if link_url and f"key={boulder_id}" in link_url:
                        problem = boulder
                        break
                if problem:
                    break

        # Strategy 2: Try by name in Moravský Kras areas
        if not problem:
            moravsky_kras_areas = Area.objects.filter(
                name__icontains="Moravský"
            ) | Area.objects.filter(name__icontains="Kras")

            if moravsky_kras_areas.exists():
                # Try exact match first
                for area in moravsky_kras_areas:
                    problem = BoulderProblem.find_by_normalized_name(
                        boulder_name, area=area
                    ).first()
                    if problem:
                        break

                # If still not found, try partial match
                if not problem:
                    for area in moravsky_kras_areas:
                        problems = BoulderProblem.objects.filter(
                            area=area, name__icontains=boulder_name[:10]
                        )
                        if problems.exists():
                            problem = problems.first()
                            break

        if not problem:
            stats["not_found"] += 1
            continue

        stats["matched"] += 1

        # Check if tick already exists
        existing_tick = Tick.objects.filter(user=user, problem=problem).first()

        if existing_tick:
            stats["existing"] += 1
            continue

        # Create tick
        try:
            notes = (
                f"Imported from lezec.cz diary. Style: {style}"
                if style
                else "Imported from lezec.cz diary"
            )

            Tick.objects.create(
                user=user,
                problem=problem,
                date=date,
                notes=notes,
            )
            stats["created"] += 1
        except Exception:
            stats["errors"] += 1

    return {
        "success": True,
        "message": f"Import completed. Found {len(moravsky_kras_ticks)} ticks from Moravský Kras.",
        **stats,
    }


def _extract_ticks_from_diary(soup, base_url):
    """
    Extract tick data from the diary page.

    Returns list of dicts with: name, lezec_id, grade, date, style, location
    """
    ticks = []

    # Find the main data table
    tables = soup.find_all("table")
    main_table = None

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) > 5:  # Has multiple data rows (not just header)
            header_row = rows[0]
            header_text = header_row.get_text()
            header_cells = header_row.find_all("th")
            if (
                len(header_cells) >= 4
                and "Datum" in header_text
                and "Cesta" in header_text
                and "Klas" in header_text
            ):
                if len(rows) > 1:
                    first_data_row = rows[1]
                    first_cell = first_data_row.find("td")
                    if first_cell:
                        first_cell_text = first_cell.get_text(strip=True)
                        if "." in first_cell_text and len(first_cell_text) == 10:
                            main_table = table
                            break

    if not main_table:
        return ticks

    rows = main_table.find_all("tr")

    # Skip header row
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])

        if len(cells) < 4:
            continue

        date_str = cells[0].get_text(strip=True)
        if not date_str:
            continue

        # Parse date (format: DD.MM.YYYY)
        try:
            date = datetime.strptime(date_str, "%d.%m.%Y").date()
        except ValueError:
            continue

        # Extract route name and ID from link
        route_link = cells[1].find("a", href=True)
        if not route_link:
            continue

        route_name = route_link.get_text(strip=True)
        route_href = route_link.get("href", "")

        # Extract route ID from URL (cesta.php?key=XXXXX)
        route_id = None
        if "cesta.php?key=" in route_href:
            parsed = urlparse(urljoin(base_url, route_href))
            query_params = parse_qs(parsed.query)
            route_id = query_params.get("key", [None])[0]

        # Extract area/location
        location = cells[2].get_text(strip=True)

        # Extract grade
        grade = cells[3].get_text(strip=True) if len(cells) > 3 else None

        # Extract style
        style = cells[5].get_text(strip=True) if len(cells) > 5 else ""

        tick_data = {
            "name": route_name,
            "lezec_id": route_id,
            "grade": grade,
            "date": date,
            "style": style,
            "location": location,
        }

        ticks.append(tick_data)

    return ticks
