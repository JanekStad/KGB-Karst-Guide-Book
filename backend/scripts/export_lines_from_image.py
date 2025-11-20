#!/usr/bin/env python3
"""
Extract problem line coordinates from boulder images.

This script detects drawn lines on boulder images using color filtering,
skeletonization, and clustering. It uses OCR to identify problem labels
and assigns detected lines to the nearest label.

Output format matches the ProblemLine model coordinate format:
- Normalized coordinates (0-1) relative to image dimensions
- JSON format: {"Problem Name": [{"x": 0.2, "y": 0.3}, ...]}
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image
from skimage.morphology import skeletonize
from sklearn.cluster import DBSCAN


# Default HSV color range for orange lines (can be overridden)
DEFAULT_LOWER_ORANGE = np.array([5, 80, 120])
DEFAULT_UPPER_ORANGE = np.array([25, 255, 255])


def load_image(image_path: str) -> Tuple[np.ndarray, int, int]:
    """
    Load image from file path.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (image array, height, width)
        
    Raises:
        FileNotFoundError: If image file doesn't exist
        ValueError: If image cannot be loaded
    """
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    img = cv2.imread(str(path))
    if img is None:
        raise ValueError(f"Could not load image from: {image_path}")
    
    h, w = img.shape[:2]
    print(f"Loaded image: {w}x{h} pixels")
    return img, h, w


def detect_labels(img: np.ndarray, min_width: int = 40, min_height: int = 15) -> Dict[str, Dict]:
    """
    Detect text labels in image using OCR.
    
    Args:
        img: Input image (BGR format)
        min_width: Minimum bounding box width to consider
        min_height: Minimum bounding box height to consider
        
    Returns:
        Dictionary mapping label text to center and bounding box info
    """
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Preprocessing for OCR
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    _, thresh = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY_INV)
    
    # Find contours → label regions
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    labels = {}
    
    for c in contours:
        x, y, wbox, hbox = cv2.boundingRect(c)
        
        # Ignore tiny noise
        if wbox < min_width or hbox < min_height:
            continue
        
        roi = rgb[y:y+hbox, x:x+wbox]
        try:
            text = pytesseract.image_to_string(Image.fromarray(roi), config="--psm 7")
        except Exception as e:
            print(f"Warning: OCR failed for region at ({x}, {y}): {e}")
            continue
        
        clean = text.strip().replace("\n", " ")
        if len(clean) < 2:
            continue
        
        labels[clean] = {
            "center": (x + wbox/2, y + hbox/2),
            "box": (x, y, wbox, hbox)
        }
    
    print(f"Detected {len(labels)} labels: {list(labels.keys())}")
    return labels


def add_text_label(img: np.ndarray, text: str, position: Tuple[int, int] = (10, 30)) -> np.ndarray:
    """Add text label to image."""
    img_copy = img.copy()
    cv2.putText(
        img_copy, text, position,
        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA
    )
    cv2.putText(
        img_copy, text, position,
        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 1, cv2.LINE_AA
    )
    return img_copy


def detect_lines(
    img: np.ndarray,
    lower_color: np.ndarray = DEFAULT_LOWER_ORANGE,
    upper_color: np.ndarray = DEFAULT_UPPER_ORANGE,
    morph_iterations: int = 2,
    debug_output: Optional[str] = None
) -> np.ndarray:
    """
    Detect lines in image using HSV color filtering.
    
    Args:
        img: Input image (BGR format)
        lower_color: Lower HSV bound for color detection
        upper_color: Upper HSV bound for color detection
        morph_iterations: Number of morphological operations
        debug_output: Optional path to save debug visualization
        
    Returns:
        Binary mask of detected lines
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower_color, upper_color)
    
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=morph_iterations)
    
    pixel_count = np.sum(mask > 0)
    print(f"Detected {pixel_count} line pixels")
    
    # Save debug visualization if requested
    if debug_output:
        # Create labeled panels
        # Panel 1: Original image
        original_labeled = add_text_label(img, "1. Original Image")
        
        # Panel 2: Mask overlay (green where detected)
        mask_colored = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        # Make detected areas green for visibility
        mask_green = mask_colored.copy()
        mask_green[:, :, 0] = 0  # Remove blue
        mask_green[:, :, 2] = 0  # Remove red (keep green)
        overlay = cv2.addWeighted(img, 0.6, mask_green, 0.4, 0)
        overlay_labeled = add_text_label(overlay, "2. Detected Lines (Green)")
        
        # Panel 3: Mask only (white = detected, black = not detected)
        mask_only = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        mask_labeled = add_text_label(mask_only, "3. Mask Only (White=Detected)")
        
        # Add HSV info to mask panel
        hsv_info = f"HSV: [{lower_color[0]},{lower_color[1]},{lower_color[2]}] to [{upper_color[0]},{upper_color[1]},{upper_color[2]}]"
        cv2.putText(
            mask_labeled, hsv_info, (10, 70),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA
        )
        cv2.putText(
            mask_labeled, hsv_info, (10, 70),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA
        )
        
        # Combine images side by side
        h, w = img.shape[:2]
        combined = np.hstack([original_labeled, overlay_labeled, mask_labeled])
        cv2.imwrite(debug_output, combined)
        print(f"Debug visualization saved to: {debug_output}")
        print("  Panel 1: Original image")
        print("  Panel 2: Green overlay shows detected lines")
        print("  Panel 3: White = detected, Black = not detected")
        if pixel_count == 0:
            print("\n  ⚠️  No lines detected! The right panel should show white lines.")
            print("     Try different --preset values or adjust --lower-hsv/--upper-hsv")
    
    return mask


def skeletonize_lines(mask: np.ndarray) -> np.ndarray:
    """
    Skeletonize the line mask to get 1-pixel-wide lines.
    
    Args:
        mask: Binary mask of detected lines
        
    Returns:
        Skeletonized binary mask
    """
    skel = skeletonize(mask > 0)
    skel = (skel * 255).astype(np.uint8)
    
    pixel_count = np.sum(skel > 0)
    print(f"Skeletonized to {pixel_count} pixels")
    return skel


def extract_normalized_coordinates(skel: np.ndarray, height: int, width: int) -> np.ndarray:
    """
    Extract normalized coordinates from skeleton.
    
    Args:
        skel: Skeletonized binary mask
        height: Image height
        width: Image width
        
    Returns:
        Array of normalized coordinates [[y, x], ...] where values are 0-1
    """
    pixels = np.column_stack(np.where(skel > 0))
    if len(pixels) == 0:
        return np.array([])
    
    # Normalize: y/height, x/width
    norm_points = np.array([[y / height, x / width] for y, x in pixels])
    return norm_points


def order_points(points: np.ndarray) -> np.ndarray:
    """
    Order polyline points using PCA projection.
    
    Args:
        points: Array of points [[y, x], ...]
        
    Returns:
        Ordered array of points
    """
    if len(points) == 0:
        return points
    
    mean = np.mean(points, axis=0)
    centered = points - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eig(cov)
    direction = eigvecs[:, np.argmax(eigvals)]
    proj = centered @ direction
    order = np.argsort(proj)
    return points[order]


def cluster_lines(
    norm_points: np.ndarray,
    eps: float = 0.01,
    min_samples: int = 10
) -> Tuple[np.ndarray, List[int]]:
    """
    Cluster skeleton points into separate routes.
    
    Args:
        norm_points: Normalized coordinate points
        eps: DBSCAN epsilon parameter (clustering distance threshold)
        min_samples: DBSCAN min_samples parameter
        
    Returns:
        Tuple of (route_labels array, list of unique route IDs)
    """
    if len(norm_points) == 0:
        return np.array([]), []
    
    clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(norm_points)
    route_labels = clustering.labels_
    unique_routes = sorted([r for r in set(route_labels) if r != -1])
    
    print(f"Clustered into {len(unique_routes)} routes")
    return route_labels, unique_routes


def assign_routes_to_labels(
    norm_points: np.ndarray,
    route_labels: np.ndarray,
    unique_routes: List[int],
    labels: Dict[str, Dict],
    height: int,
    width: int
) -> Dict[str, List[Dict[str, float]]]:
    """
    Assign each detected route to the nearest OCR label.
    
    Args:
        norm_points: Normalized coordinate points
        route_labels: Cluster labels for each point
        unique_routes: List of unique route IDs
        labels: Dictionary of detected OCR labels
        height: Image height
        width: Image width
        
    Returns:
        Dictionary mapping label names to coordinate arrays
    """
    if len(labels) == 0:
        print("Warning: No labels detected, routes will not be assigned")
        return {}
    
    # Convert label centers to normalized coords (y, x)
    label_centers_norm = {
        name: (cy / height, cx / width)
        for name, data in labels.items()
        for (cx, cy) in [data["center"]]
    }
    
    route_map: Dict[str, List[Dict[str, float]]] = {}
    
    for rlab in unique_routes:
        pts = norm_points[route_labels == rlab]
        if len(pts) == 0:
            continue
        
        ordered = order_points(pts)
        rc = np.mean(pts, axis=0)  # Route centroid
        
        # Find closest OCR label
        best_name = None
        best_dist = float('inf')
        
        for name, (ly, lx) in label_centers_norm.items():
            d = np.linalg.norm(np.array([rc[0] - ly, rc[1] - lx]))
            if d < best_dist:
                best_dist = d
                best_name = name
        
        if best_name:
            # Convert from (y, x) normalized to (x, y) normalized for output
            route_map[best_name] = [
                {"x": float(x), "y": float(y)} for y, x in ordered
            ]
    
    print(f"Assigned {len(route_map)} routes to labels")
    return route_map


def sample_line_colors(img: np.ndarray, num_samples: int = 20) -> Tuple[np.ndarray, np.ndarray]:
    """
    Sample colors from likely line regions in the image.
    Looks for bright, saturated colors that might be lines.
    
    Args:
        img: Input image (BGR format)
        num_samples: Number of color samples to take
        
    Returns:
        Tuple of (suggested_lower_hsv, suggested_upper_hsv)
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, w = img.shape[:2]
    
    # Sample from various regions (avoid edges)
    samples = []
    for _ in range(num_samples * 10):  # Try many, keep best
        x = np.random.randint(w * 0.1, w * 0.9)
        y = np.random.randint(h * 0.1, h * 0.9)
        hsv_val = hsv[y, x]
        # Prefer saturated, bright colors (likely to be drawn lines)
        if hsv_val[1] > 50 and hsv_val[2] > 100:
            samples.append(hsv_val)
            if len(samples) >= num_samples:
                break
    
    if len(samples) == 0:
        return None, None
    
    samples = np.array(samples)
    h_vals = samples[:, 0]
    s_vals = samples[:, 1]
    v_vals = samples[:, 2]
    
    # Suggest range based on sampled colors
    h_min, h_max = int(max(0, h_vals.min() - 5)), int(min(179, h_vals.max() + 5))
    s_min, s_max = int(max(0, s_vals.min() - 20)), int(min(255, s_vals.max() + 20))
    v_min, v_max = int(max(0, v_vals.min() - 30)), int(min(255, v_vals.max() + 30))
    
    lower = np.array([h_min, s_min, v_min])
    upper = np.array([h_max, s_max, v_max])
    
    return lower, upper


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Extract problem line coordinates from boulder images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python export_lines_from_image.py image.jpg
  python export_lines_from_image.py image.jpg -o output.json
  python export_lines_from_image.py image.jpg --no-ocr
  python export_lines_from_image.py image.jpg --sample-colors
        """
    )
    
    parser.add_argument(
        "image",
        type=str,
        help="Path to the input image file"
    )
    
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output JSON file path (default: <image_name>_lines.json)"
    )
    
    parser.add_argument(
        "--no-ocr",
        action="store_true",
        help="Skip OCR label detection (extract all lines without names)"
    )
    
    parser.add_argument(
        "--eps",
        type=float,
        default=0.01,
        help="DBSCAN clustering epsilon (default: 0.01)"
    )
    
    parser.add_argument(
        "--min-samples",
        type=int,
        default=10,
        help="DBSCAN min_samples parameter (default: 10)"
    )
    
    parser.add_argument(
        "--lower-hsv",
        type=int,
        nargs=3,
        metavar=("H", "S", "V"),
        default=[5, 80, 120],
        help="Lower HSV bound for line detection (default: 5 80 120)"
    )
    
    parser.add_argument(
        "--upper-hsv",
        type=int,
        nargs=3,
        metavar=("H", "S", "V"),
        default=[25, 255, 255],
        help="Upper HSV bound for line detection (default: 25 255 255)"
    )
    
    parser.add_argument(
        "--debug",
        type=str,
        default=None,
        metavar="OUTPUT_IMAGE",
        help="Save debug visualization showing detected mask (e.g., debug.jpg)"
    )
    
    parser.add_argument(
        "--preset",
        type=str,
        choices=["orange-bright", "orange-dark", "orange-light", "red", "yellow"],
        help="Use preset HSV ranges: orange-bright (5,80,120-25,255,255), orange-dark (0,100,100-20,255,200), orange-light (8,50,150-30,255,255), red (0,100,100-10,255,255), yellow (15,100,100-35,255,255)"
    )
    
    parser.add_argument(
        "--sample-colors",
        action="store_true",
        help="Automatically sample colors from image to suggest HSV values (doesn't extract lines)"
    )
    
    args = parser.parse_args()
    
    # Apply preset if specified
    if args.preset:
        presets = {
            "orange-bright": ([5, 80, 120], [25, 255, 255]),
            "orange-dark": ([0, 100, 100], [20, 255, 200]),
            "orange-light": ([8, 50, 150], [30, 255, 255]),
            "red": ([0, 100, 100], [10, 255, 255]),
            "yellow": ([15, 100, 100], [35, 255, 255]),
        }
        lower, upper = presets[args.preset]
        args.lower_hsv = lower
        args.upper_hsv = upper
        print(f"Using preset '{args.preset}': lower={lower}, upper={upper}")
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        image_path = Path(args.image)
        output_path = image_path.parent / f"{image_path.stem}_lines.json"
    
    try:
        # Load image
        img, h, w = load_image(args.image)
        
        # Color sampling mode
        if args.sample_colors:
            print("Sampling colors from image to suggest HSV values...")
            lower, upper = sample_line_colors(img)
            if lower is not None and upper is not None:
                print(f"\nSuggested HSV range:")
                print(f"  --lower-hsv {lower[0]} {lower[1]} {lower[2]}")
                print(f"  --upper-hsv {upper[0]} {upper[1]} {upper[2]}")
                print(f"\nTry running with:")
                print(f"  python scripts/export_lines_from_image.py {args.image} --lower-hsv {lower[0]} {lower[1]} {lower[2]} --upper-hsv {upper[0]} {upper[1]} {upper[2]} --debug debug.jpg")
            else:
                print("Could not sample colors. Try using a preset or manual HSV values.")
            return
        
        # Detect labels (optional)
        labels = {}
        if not args.no_ocr:
            try:
                labels = detect_labels(img)
            except Exception as e:
                print(f"Warning: OCR failed: {e}")
                print("Continuing without label detection...")
        
        # Detect and extract lines
        lower_color = np.array(args.lower_hsv)
        upper_color = np.array(args.upper_hsv)
        mask = detect_lines(img, lower_color, upper_color, debug_output=args.debug)
        
        if np.sum(mask > 0) == 0:
            print("\nError: No lines detected with current HSV values.")
            print(f"  Lower HSV: {args.lower_hsv}")
            print(f"  Upper HSV: {args.upper_hsv}")
            print("\nTry:")
            print("  1. Use a preset: --preset orange-bright (or orange-dark, orange-light)")
            print("  2. Adjust HSV manually: --lower-hsv H S V --upper-hsv H S V")
            print("  3. Use debug mode to visualize: --debug debug.jpg")
            print("\nCommon orange HSV ranges:")
            print("  Bright orange: --lower-hsv 5 80 120 --upper-hsv 25 255 255")
            print("  Dark orange:   --lower-hsv 0 100 100 --upper-hsv 20 255 200")
            print("  Light orange:  --lower-hsv 8 50 150 --upper-hsv 30 255 255")
            sys.exit(1)
        
        skel = skeletonize_lines(mask)
        norm_points = extract_normalized_coordinates(skel, h, w)
        
        if len(norm_points) == 0:
            print("Error: No skeleton points extracted.")
            sys.exit(1)
        
        # Cluster lines
        route_labels, unique_routes = cluster_lines(
            norm_points,
            eps=args.eps,
            min_samples=args.min_samples
        )
        
        if len(unique_routes) == 0:
            print("Warning: No routes clustered. Try adjusting --eps and --min-samples parameters.")
            route_map = {}
        else:
            # Assign routes to labels
            route_map = assign_routes_to_labels(
                norm_points,
                route_labels,
                unique_routes,
                labels,
                h,
                w
            )
        
        # Save result
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(route_map, f, indent=2)
        
        print(f"\n✓ Saved {len(route_map)} problem lines to: {output_path}")
        
        if len(route_map) == 0:
            print("\nWarning: No routes were assigned to labels.")
            print("This could mean:")
            print("  - No labels were detected (try without --no-ocr)")
            print("  - Lines are too far from labels")
            print("  - Clustering parameters need adjustment")
            sys.exit(1)
        
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
