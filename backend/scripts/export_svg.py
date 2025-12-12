import re
import xml.etree.ElementTree as ET


def parse_path_d(d):
    """
    Parse an SVG path 'd' attribute and return a list of {'x': x, 'y': y} dictionaries.
    Supports M, L, C, m, l, c commands.
    """
    # SVG path command letters
    path_cmds = "MLCmlc"

    # Split commands but keep letters
    tokens = re.findall(r"[MLCmlcZz]|-?\d*\.?\d+", d)

    coords = []
    idx = 0
    current_pos = {"x": 0, "y": 0}
    prev_cmd = None

    while idx < len(tokens):
        token = tokens[idx]

        if token in path_cmds + "Zz":
            cmd = token
            idx += 1
            # Handle Z/z (close path) command
            if cmd.upper() == "Z":
                if coords:
                    coords.append(coords[0].copy())  # Close path by returning to start
                    current_pos = coords[0].copy()
                prev_cmd = None
                continue
        elif prev_cmd is not None:
            # If no command found, treat it as previous command repeating
            cmd = prev_cmd
        else:
            # Skip if we can't determine the command
            idx += 1
            continue

        prev_cmd = cmd

        # How many numbers each command consumes at a time
        if cmd.upper() in ["M", "L"]:
            # Move or Line: 2 numbers (x, y)
            if idx + 1 >= len(tokens):
                break
            try:
                x = float(tokens[idx])
                y = float(tokens[idx + 1])
                idx += 2

                if cmd.islower():  # relative coords
                    x += current_pos["x"]
                    y += current_pos["y"]

                coords.append({"x": x, "y": y})
                current_pos = {"x": x, "y": y}
            except (ValueError, IndexError):
                break

        elif cmd.upper() == "C":
            # Cubic Bezier curve: takes 6 numbers but we only take final point
            if idx + 5 >= len(tokens):
                break
            try:
                x1 = float(tokens[idx + 4])
                y1 = float(tokens[idx + 5])
                idx += 6

                if cmd.islower():  # relative coords
                    x1 += current_pos["x"]
                    y1 += current_pos["y"]

                coords.append({"x": x1, "y": y1})
                current_pos = {"x": x1, "y": y1}
            except (ValueError, IndexError):
                break

        else:
            # Unsupported command (you can extend this)
            idx += 1

    return coords


def convert_to_relative(coords):
    """
    Convert absolute coordinates to relative coordinates.
    First point becomes (0, 0), subsequent points are relative to previous point.

    Args:
        coords: List of {'x': x, 'y': y} dictionaries (absolute coordinates)

    Returns:
        List of {'x': x, 'y': y} dictionaries (relative coordinates)
    """
    if not coords:
        return []

    relative = []
    prev = {"x": 0, "y": 0}

    for i, point in enumerate(coords):
        if i == 0:
            # First point: make it relative to origin (0, 0)
            relative.append({"x": 0, "y": 0})
            prev = point.copy()
        else:
            # Subsequent points: difference from previous absolute point
            rel_x = point["x"] - prev["x"]
            rel_y = point["y"] - prev["y"]
            relative.append({"x": rel_x, "y": rel_y})
            prev = point.copy()

    return relative


def normalize_to_image_size(coords, width, height):
    """
    Normalize coordinates to 0-1 range relative to image dimensions.
    This is useful for storing coordinates that work regardless of image size.

    Args:
        coords: List of {'x': x, 'y': y} dictionaries (absolute coordinates)
        width: Image width in pixels
        height: Image height in pixels

    Returns:
        List of {'x': x, 'y': y} dictionaries (normalized 0-1 coordinates)
    """
    if not coords or width <= 0 or height <= 0:
        return []

    normalized = []
    for point in coords:
        normalized.append({"x": point["x"] / width, "y": point["y"] / height})

    return normalized


def get_svg_dimensions(svg_path):
    """
    Extract width and height from SVG file.
    Checks viewBox first, then width/height attributes.

    Returns:
        Tuple of (width, height) or (None, None) if not found
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Check for viewBox attribute (most common)
    viewbox = root.get("viewBox")
    if viewbox:
        parts = viewbox.split()
        if len(parts) >= 4:
            # viewBox format: "x y width height"
            return float(parts[2]), float(parts[3])

    # Check for width and height attributes
    width = root.get("width")
    height = root.get("height")

    if width and height:
        # Remove units if present (e.g., "800px" -> "800")
        width = float(re.sub(r"[^\d.]", "", str(width)))
        height = float(re.sub(r"[^\d.]", "", str(height)))
        return width, height

    return None, None


def extract_svg_coords(svg_path):
    """
    Extract all path coordinates from an SVG file.
    Returns a dict: {path_id: [{'x': x, 'y': y}, ...], ...}
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()

    ns = {"svg": "http://www.w3.org/2000/svg"}
    results = {}

    for elem in root.findall(".//svg:path", ns):
        d = elem.get("d")
        if not d:
            continue

        coords = parse_path_d(d)
        elem_id = elem.get("id", f"path_{len(results)+1}")
        results[elem_id] = coords

    return results


# -----------------------------
# Example usage:
# -----------------------------
if __name__ == "__main__":
    import sys
    import json
    import argparse

    parser = argparse.ArgumentParser(description="Extract coordinates from SVG paths")
    parser.add_argument(
        "svg_file",
        nargs="?",
        default="vanousy_kniha.svg",
        help="SVG file to process (default: vanousy_kniha.svg)",
    )
    parser.add_argument(
        "--relative",
        "-r",
        action="store_true",
        help="Convert coordinates to relative format (relative to previous point)",
    )
    parser.add_argument(
        "--normalized",
        "-n",
        action="store_true",
        help="Normalize coordinates to 0-1 range relative to image size (for database storage)",
    )
    parser.add_argument(
        "--absolute",
        "-a",
        action="store_true",
        help="Keep coordinates in absolute format (default)",
    )

    args = parser.parse_args()
    svg_file = args.svg_file
    use_relative = args.relative
    use_normalized = args.normalized

    try:
        coords = extract_svg_coords(svg_file)

        if not coords:
            print(f"No paths found in {svg_file}")
            sys.exit(1)

        # Normalize to image size if requested
        if use_normalized:
            width, height = get_svg_dimensions(svg_file)
            if width is None or height is None:
                print(
                    "Warning: Could not determine SVG dimensions. Using absolute coordinates."
                )
                coord_type = "absolute"
            else:
                print(f"SVG dimensions: {width} x {height}")
                coords = {
                    path_id: normalize_to_image_size(points, width, height)
                    for path_id, points in coords.items()
                }
                coord_type = "normalized (0-1)"
        # Convert to relative if requested
        elif use_relative:
            coords = {
                path_id: convert_to_relative(points)
                for path_id, points in coords.items()
            }
            coord_type = "relative"
        else:
            coord_type = "absolute"

        # Print to console
        print(f"\nCoordinates ({coord_type}):")
        for path_id, points in coords.items():
            print(f"\n{path_id}: {len(points)} points")
            for p in points:
                print(f"   {{'x': {p['x']:.4f}, 'y': {p['y']:.4f}}}")

        # Export to JSON file
        if use_normalized:
            suffix = "_normalized_coords"
        elif use_relative:
            suffix = "_rel_coords"
        else:
            suffix = "_coords"
        output_file = svg_file.replace(".svg", f"{suffix}.json")
        with open(output_file, "w") as f:
            json.dump(coords, f, indent=2)
        print(f"\n✓ Coordinates exported to {output_file}")

    except FileNotFoundError:
        print(f"Error: File '{svg_file}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
