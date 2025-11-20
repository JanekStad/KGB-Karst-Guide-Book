# Coordinate Files

This directory contains JSON files with normalized coordinates (0-1) for problem lines.

## File Format

Each JSON file should have the following structure:

```json
{
  "Problem Name": [
    { "x": 0.05, "y": 0.63 },
    { "x": 0.18, "y": 0.60 }
  ],
  "Another Problem": [
    { "x": 0.13, "y": 0.72 },
    { "x": 0.15, "y": 0.60 }
  ]
}
```

Where:
- Keys are problem names (must match BoulderProblem names in the database)
- Values are arrays of coordinate points
- Each coordinate point has `x` and `y` values (normalized 0-1 relative to image dimensions)

## Usage

Import coordinates using the management command:

```bash
python manage.py import_problem_lines --file boulders/data/coordinates/your_file.json --image-id <image_id>
```

## Naming Convention

Files are typically named: `<crag_or_wall>_<description>_coords.json`

Examples:
- `vanousy_kniha_normalized_coords.json`
- `vanousy_kniha_2_normalized_coords.json`

