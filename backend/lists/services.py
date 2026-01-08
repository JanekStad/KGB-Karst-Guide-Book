from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

from boulders.models import BoulderProblem, Area
from users.models import UserProfile
from lists.models import Tick

LEZEC_BASE_URL = "https://www.lezec.cz"
MORAVSKY_KRAS_AREAS = [
    "Holštejn",
    "Josefovské Údolí",
    "Rudice",
    "Skály V Údolí Říčky",
    "Sloup",
    "Vyvřelina",
    "Žleby",
]


def import_lezec_diary(user, lezec_username):
    """
    Import ticks from lezec.cz public diary for a user.

    Args:
        user: Django User instance
        lezec_username: Lezec.cz username (can contain Czech characters)

    Returns:
        dict with statistics about the import
    """
    # Try to find and fetch the diary
    soup = _find_diary(lezec_username)
    if not soup:
        return _create_error_response(
            f"Could not find diary for '{lezec_username}'. Please check:\n"
            f"1. The username is correct\n"
            f"2. The diary is set to public on lezec.cz"
        )

    # Extract ticks from the diary
    ticks = _extract_ticks_from_diary(soup, LEZEC_BASE_URL)
    if not ticks:
        return _handle_empty_diary_response(soup)

    # Filter for Moravský Kras only
    moravsky_kras_ticks = _filter_moravsky_kras_ticks(ticks)
    if not moravsky_kras_ticks:
        return _create_error_response("No ticks found for Moravský Kras location")

    # Process ticks: match boulders and create ticks
    stats = _process_ticks(user, moravsky_kras_ticks)

    return {
        "success": True,
        "message": f"Import completed. Found {len(moravsky_kras_ticks)} ticks from Moravský Kras.",
        **stats,
    }


def calculate_problem_statistics(ticks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate all statistics for a boulder problem from a list of tick dictionaries.

    Args:
        ticks: List of tick dictionaries with keys:
            - 'user__profile__height' (optional)
            - 'suggested_grade' (optional)

    Returns:
        Dictionary with statistics:
            - totalTicks: Total number of ticks
            - heightDistribution: Height distribution dict
            - gradeVoting: Grade voting distribution dict
            - heightDataCount: Number of ticks with height data
            - gradeVotesCount: Number of ticks with grade votes
    """
    total_ticks = len(ticks)

    ticks_with_height = sum(
        1
        for tick in ticks
        if tick.get("user__profile__height") is not None
        and tick.get("user__profile__height") != ""
    )

    ticks_with_grade_vote = sum(
        1
        for tick in ticks
        if tick.get("suggested_grade") is not None and tick.get("suggested_grade") != ""
    )

    height_distribution = calculate_height_distribution(ticks)
    grade_voting = calculate_grade_voting_distribution(ticks)

    return {
        "totalTicks": total_ticks,
        "heightDistribution": height_distribution,
        "gradeVoting": grade_voting,
        "heightDataCount": ticks_with_height,
        "gradeVotesCount": ticks_with_grade_vote,
    }


def calculate_height_distribution(
    ticks: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate height distribution statistics from a list of tick dictionaries.

    Args:
        ticks: List of tick dictionaries with 'user__profile__height' key

    Returns:
        Dictionary mapping height values to {label, count} dictionaries
    """
    height_stats = {}
    for height_choice in UserProfile.HEIGHT_CHOICES:
        height_value = height_choice[0]
        count = sum(
            1 for tick in ticks if tick.get("user__profile__height") == height_value
        )
        if count > 0:
            height_stats[height_value] = {
                "label": height_choice[1],
                "count": count,
            }
    return height_stats


def calculate_grade_voting_distribution(
    ticks: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate grade voting distribution statistics from a list of tick dictionaries.

    Args:
        ticks: List of tick dictionaries with 'suggested_grade' key

    Returns:
        Dictionary mapping grade values to {label, count} dictionaries
    """
    grade_stats = {}
    for grade_choice in Tick.GRADE_CHOICES:
        grade_value = grade_choice[0]
        count = sum(
            1
            for tick in ticks
            if tick.get("suggested_grade") == grade_value
            and tick.get("suggested_grade") is not None
            and tick.get("suggested_grade") != ""
        )
        if count > 0:
            grade_stats[grade_value] = {
                "label": grade_choice[1],
                "count": count,
            }
    return grade_stats


# ============================================================================
# Private Helper Functions - Lezec.cz Import
# ============================================================================


def _find_diary(lezec_username: str) -> Optional[BeautifulSoup]:
    """
    Try to find and fetch the diary page using multiple strategies.

    Args:
        lezec_username: Lezec.cz username

    Returns:
        BeautifulSoup object if diary found, None otherwise
    """
    strategies = _generate_username_strategies(lezec_username)
    tried_identifiers = set()

    for identifier, uppercase_hex, use_w1250 in strategies:
        strategy_key = (identifier, uppercase_hex, use_w1250)
        if strategy_key in tried_identifiers:
            continue
        tried_identifiers.add(strategy_key)

        soup, found = _try_fetch_diary(
            LEZEC_BASE_URL, identifier, uppercase_hex, use_w1250
        )

        if found:
            return soup

    return None


def _generate_username_strategies(lezec_username: str) -> List[Tuple[str, bool, bool]]:
    """
    Generate list of username encoding strategies to try.

    IMPORTANT: For Czech characters, windows-1250 encoding should be tried FIRST
    because lezec.cz expects bytes encoded in windows-1250, not Unicode code points.

    Args:
        lezec_username: Original username

    Returns:
        List of tuples: (identifier, uppercase_hex, use_windows1250)
    """
    username_lower = lezec_username.lower()
    username_upper = lezec_username.upper()
    username_capitalized = (
        lezec_username[0].upper() + lezec_username[1:].lower()
        if len(lezec_username) > 1
        else lezec_username.upper()
    )

    strategies = [
        # Strategy 1: Try lowercase with windows-1250 encoding FIRST (most common + correct encoding)
        (username_lower, False, True),
        # Strategy 2: Try lowercase with Unicode encoding
        (username_lower, False, False),
        # Strategy 3: Try original case with windows-1250 (in case user typed it correctly)
        (lezec_username, False, True),
        # Strategy 4: Try original case with Unicode
        (lezec_username, False, False),
        # Strategy 5: Try capitalized with windows-1250
        (username_capitalized, False, True),
        (username_capitalized, False, False),
        # Strategy 6: Try uppercase with windows-1250
        (username_upper, False, True),
        (username_upper, False, False),
        # Strategy 7: Try with uppercase hex variations (less common, but just in case)
        (username_lower, True, True),
        (lezec_username, True, True),
    ]

    return strategies


def _try_fetch_diary(
    base_url: str,
    identifier: str,
    uppercase_hex: bool = False,
    use_windows1250: bool = False,
) -> Tuple[Optional[BeautifulSoup], bool]:
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


def _extract_ticks_from_diary(
    soup: BeautifulSoup, base_url: str
) -> List[Dict[str, Any]]:
    """
    Extract tick data from the diary page.

    Returns list of dicts with: name, lezec_id, grade, date, style, location
    """
    ticks = []
    main_table = _find_main_diary_table(soup)

    if not main_table:
        return ticks

    rows = main_table.find_all("tr")

    # Skip header row
    for row in rows[1:]:
        tick_data = _parse_tick_row(row, base_url)
        if tick_data:
            ticks.append(tick_data)

    return ticks


def _find_main_diary_table(soup: BeautifulSoup) -> Optional[Any]:
    """Find the main data table in the diary page."""
    tables = soup.find_all("table")

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
                            return table

    return None


def _parse_tick_row(row: Any, base_url: str) -> Optional[Dict[str, Any]]:
    """Parse a single row from the diary table into tick data."""
    cells = row.find_all(["td", "th"])

    if len(cells) < 4:
        return None

    date_str = cells[0].get_text(strip=True)
    if not date_str:
        return None

    # Parse date (format: DD.MM.YYYY)
    try:
        date = datetime.strptime(date_str, "%d.%m.%Y").date()
    except ValueError:
        return None

    # Extract route name and ID from link
    route_link = cells[1].find("a", href=True)
    if not route_link:
        return None

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

    return {
        "name": route_name,
        "lezec_id": route_id,
        "grade": grade,
        "date": date,
        "style": style,
        "location": location,
    }


def _filter_moravsky_kras_ticks(ticks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter ticks to only include those from Moravský Kras locations."""
    return [
        tick
        for tick in ticks
        if tick.get("location") in MORAVSKY_KRAS_AREAS
        or "Moravský" in tick.get("location", "")
        or "Kras" in tick.get("location", "")
    ]


def _process_ticks(user, ticks: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Process ticks: match boulders and create tick records.

    Returns:
        Dictionary with statistics: matched, created, existing, not_found, errors
    """
    stats = {
        "matched": 0,
        "created": 0,
        "existing": 0,
        "not_found": 0,
        "errors": 0,
    }

    for tick_data in ticks:
        problem = _find_matching_boulder(tick_data)

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
        if _create_tick(user, problem, tick_data):
            stats["created"] += 1
        else:
            stats["errors"] += 1

    return stats


def _find_matching_boulder(tick_data: Dict[str, Any]) -> Optional[BoulderProblem]:
    """
    Find matching boulder problem for a tick.

    Tries multiple strategies:
    1. Match by external link (lezec.cz ID) - fastest method
    2. Match by name in Moravský Kras areas
    """
    boulder_name = tick_data.get("name")
    boulder_id = tick_data.get("lezec_id")

    # Strategy 1: Try by external link (lezec.cz ID) - fastest method
    if boulder_id:
        problem = _find_boulder_by_external_id(
            boulder_id, tick_data.get("location", "")
        )
        if problem:
            return problem

    # Strategy 2: Try by name in Moravský Kras areas
    return _find_boulder_by_name(boulder_name)


def _find_boulder_by_external_id(
    boulder_id: str, tick_area: str
) -> Optional[BoulderProblem]:
    """Find boulder by lezec.cz external ID."""
    moravsky_kras_areas = _get_moravsky_kras_areas(tick_area)

    if moravsky_kras_areas.exists():
        boulders_to_check = BoulderProblem.objects.filter(area__in=moravsky_kras_areas)
    else:
        boulders_to_check = BoulderProblem.objects.all()

    # Check external_links for matching lezec.cz URL
    for boulder in boulders_to_check:
        if not boulder.external_links:
            continue
        for link in boulder.external_links:
            link_url = link.get("url", "")
            if link_url and f"key={boulder_id}" in link_url:
                return boulder

    return None


def _find_boulder_by_name(boulder_name: str) -> Optional[BoulderProblem]:
    """Find boulder by name in Moravský Kras areas."""
    moravsky_kras_areas = _get_moravsky_kras_areas()

    if not moravsky_kras_areas.exists():
        return None

    # Try exact match first
    for area in moravsky_kras_areas:
        problem = BoulderProblem.find_by_normalized_name(
            boulder_name, area=area
        ).first()
        if problem:
            return problem

    # If still not found, try partial match
    for area in moravsky_kras_areas:
        problems = BoulderProblem.objects.filter(
            area=area, name__icontains=boulder_name[:10]
        )
        if problems.exists():
            return problems.first()

    return None


def _get_moravsky_kras_areas(tick_area: Optional[str] = None):
    """
    Get queryset of Moravský Kras areas.

    Args:
        tick_area: Optional area name from tick to include in search

    Returns:
        QuerySet of Area objects
    """
    moravsky_kras_areas = Area.objects.filter(
        name__icontains="Moravský"
    ) | Area.objects.filter(name__icontains="Kras")

    if tick_area:
        matching_areas = Area.objects.filter(name__icontains=tick_area)
        moravsky_kras_areas = moravsky_kras_areas | matching_areas

    return moravsky_kras_areas


def _create_tick(user, problem: BoulderProblem, tick_data: Dict[str, Any]) -> bool:
    """
    Create a tick record for the user.

    Returns:
        True if successful, False otherwise
    """
    style = tick_data.get("style", "")
    notes = (
        f"Imported from lezec.cz diary. Style: {style}"
        if style
        else "Imported from lezec.cz diary"
    )

    try:
        Tick.objects.create(
            user=user,
            problem=problem,
            date=tick_data.get("date"),
            notes=notes,
        )
        return True
    except Exception:
        return False


def _handle_empty_diary_response(soup: Optional[BeautifulSoup]) -> Dict[str, Any]:
    """Handle response when diary page is found but contains no ticks."""
    page_text = soup.get_text().lower() if soup else ""

    if "deníček" in page_text or "denik" in page_text:
        # Page loaded but no ticks - could be empty diary or wrong filters
        message = (
            "No boulder ticks found in diary. The diary might be empty, private, "
            "or the username might be incorrect."
        )
    else:
        # Page doesn't look like a diary page - might be wrong username
        message = (
            "Could not find diary page. The username might be incorrect "
            "or the diary might not be public."
        )

    return _create_error_response(message)


def _create_error_response(message: str) -> Dict[str, Any]:
    """Create a standardized error response dictionary."""
    return {
        "success": False,
        "message": message,
        "matched": 0,
        "created": 0,
        "existing": 0,
        "not_found": 0,
        "errors": 0,
    }


def _encode_to_lezec_hex(
    text: str, uppercase: bool = False, use_windows1250: bool = False
) -> str:
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
