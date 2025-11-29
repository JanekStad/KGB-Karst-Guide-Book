"""
Django management command to extract coordinates from GPX files.

GPX files can contain waypoints, tracks, or routes. This command extracts coordinates
and converts them to the format needed for sector polygon boundaries.

Usage:
    python manage.py extract_gpx_coords --file path/to/file.gpx
    python manage.py extract_gpx_coords --file path/to/file.gpx --sector "Vanousovy Diry"
    python manage.py extract_gpx_coords --file path/to/file.gpx --sector-id 1
    python manage.py extract_gpx_coords --file path/to/file.gpx --output coords.json
"""

import xml.etree.ElementTree as ET
import json
import os
from django.core.management.base import BaseCommand, CommandError
from boulders.models import Sector


class Command(BaseCommand):
    help = "Extract coordinates from GPX files for sector polygon boundaries"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            required=True,
            help="Path to GPX file",
        )
        parser.add_argument(
            "--sector",
            type=str,
            help="Sector name to update (e.g., 'Vanousovy Diry')",
        )
        parser.add_argument(
            "--sector-id",
            type=int,
            help="Sector ID to update",
        )
        parser.add_argument(
            "--output",
            type=str,
            help="Output file path to save coordinates as JSON (if not updating sector)",
        )
        parser.add_argument(
            "--source",
            type=str,
            choices=["waypoints", "track", "route", "all"],
            default="all",
            help="Which GPX elements to extract from: waypoints, track, route, or all (default: all)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without actually updating the sector",
        )

    def handle(self, *args, **options):
        gpx_file = options["file"]
        sector_name = options.get("sector")
        sector_id = options.get("sector_id")
        output_file = options.get("output")
        source = options["source"]
        dry_run = options["dry_run"]

        # Validate inputs
        if not os.path.exists(gpx_file):
            raise CommandError(f"GPX file not found: {gpx_file}")

        if sector_name and sector_id:
            raise CommandError("Cannot specify both --sector and --sector-id")

        if not sector_name and not sector_id and not output_file:
            raise CommandError(
                "Must specify either --sector, --sector-id, or --output to save coordinates"
            )

        # Parse GPX file
        try:
            tree = ET.parse(gpx_file)
            root = tree.getroot()
        except ET.ParseError as e:
            raise CommandError(f"Failed to parse GPX file: {e}")

        # Handle namespace (GPX files use namespaces)
        namespaces = {
            "gpx": "http://www.topografix.com/GPX/1/1",
            "default": "http://www.topografix.com/GPX/1/1",
        }

        # Try to detect namespace
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0].strip("{")
            namespaces["gpx"] = ns
            namespaces["default"] = ns

        # Extract coordinates based on source
        coordinates = []

        if source in ["waypoints", "all"]:
            waypoints = self._extract_waypoints(root, namespaces)
            if waypoints:
                self.stdout.write(
                    self.style.SUCCESS(f"Found {len(waypoints)} waypoint(s)")
                )
                coordinates.extend(waypoints)

        if source in ["track", "all"]:
            track_points = self._extract_track_points(root, namespaces)
            if track_points:
                self.stdout.write(
                    self.style.SUCCESS(f"Found {len(track_points)} track point(s)")
                )
                coordinates.extend(track_points)

        if source in ["route", "all"]:
            route_points = self._extract_route_points(root, namespaces)
            if route_points:
                self.stdout.write(
                    self.style.SUCCESS(f"Found {len(route_points)} route point(s)")
                )
                coordinates.extend(route_points)

        if not coordinates:
            raise CommandError(
                f"No coordinates found in GPX file. Check --source option (current: {source})"
            )

        # Remove duplicates while preserving order
        seen = set()
        unique_coords = []
        for coord in coordinates:
            coord_tuple = tuple(coord)
            if coord_tuple not in seen:
                seen.add(coord_tuple)
                unique_coords.append(coord)

        # Close the polygon if needed (first point != last point)
        if len(unique_coords) > 2:
            if unique_coords[0] != unique_coords[-1]:
                unique_coords.append(unique_coords[0])

        self.stdout.write(
            self.style.SUCCESS(
                f"\nExtracted {len(unique_coords)} unique coordinate points"
            )
        )

        # Display coordinates
        self.stdout.write("\nCoordinates:")
        self.stdout.write(json.dumps(unique_coords, indent=2))

        # Update sector or save to file
        if sector_name or sector_id:
            try:
                if sector_id:
                    sector = Sector.objects.get(id=sector_id)
                else:
                    sector = Sector.objects.get(name__iexact=sector_name)

                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(
                            f"\n[DRY RUN] Would update sector '{sector.name}' (ID: {sector.id})"
                        )
                    )
                    self.stdout.write(
                        f"Current polygon_boundary: {sector.polygon_boundary}"
                    )
                    self.stdout.write(
                        f"New polygon_boundary: {json.dumps(unique_coords, indent=2)}"
                    )
                else:
                    sector.polygon_boundary = unique_coords
                    sector.save()
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"\n✓ Updated sector '{sector.name}' (ID: {sector.id}) with polygon coordinates"
                        )
                    )
            except Sector.DoesNotExist:
                raise CommandError(
                    f"Sector not found: {sector_name or f'ID {sector_id}'}"
                )
        elif output_file:
            with open(output_file, "w") as f:
                json.dump(unique_coords, f, indent=2)
            self.stdout.write(
                self.style.SUCCESS(f"\n✓ Saved coordinates to {output_file}")
            )

    def _extract_waypoints(self, root, namespaces):
        """Extract coordinates from waypoints (wpt elements)"""
        coords = []
        # Try with namespace
        waypoints = root.findall(".//{http://www.topografix.com/GPX/1/1}wpt")
        if not waypoints:
            # Try without namespace
            waypoints = root.findall(".//wpt")

        for wpt in waypoints:
            lat = wpt.get("lat")
            lon = wpt.get("lon")
            if lat and lon:
                try:
                    coords.append([float(lat), float(lon)])
                except ValueError:
                    continue

        return coords

    def _extract_track_points(self, root, namespaces):
        """Extract coordinates from track points (trkpt elements)"""
        coords = []
        # Try with namespace
        track_points = root.findall(".//{http://www.topografix.com/GPX/1/1}trkpt")
        if not track_points:
            # Try without namespace
            track_points = root.findall(".//trkpt")

        for trkpt in track_points:
            lat = trkpt.get("lat")
            lon = trkpt.get("lon")
            if lat and lon:
                try:
                    coords.append([float(lat), float(lon)])
                except ValueError:
                    continue

        return coords

    def _extract_route_points(self, root, namespaces):
        """Extract coordinates from route points (rtept elements)"""
        coords = []
        # Try with namespace
        route_points = root.findall(".//{http://www.topografix.com/GPX/1/1}rtept")
        if not route_points:
            # Try without namespace
            route_points = root.findall(".//rtept")

        for rtept in route_points:
            lat = rtept.get("lat")
            lon = rtept.get("lon")
            if lat and lon:
                try:
                    coords.append([float(lat), float(lon)])
                except ValueError:
                    continue

        return coords

