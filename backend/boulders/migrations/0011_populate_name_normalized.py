# Generated manually to populate name_normalized for existing records

import unicodedata
import re
from django.db import migrations


def normalize_problem_name(name):
    """
    Normalize a problem name for safe lookups.
    Same logic as in boulders.utils.normalize_problem_name
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


def populate_name_normalized(apps, schema_editor):
    """Populate name_normalized for all existing BoulderProblem records"""
    BoulderProblem = apps.get_model("boulders", "BoulderProblem")
    for problem in BoulderProblem.objects.all():
        if problem.name:
            problem.name_normalized = normalize_problem_name(problem.name)
            problem.save(update_fields=["name_normalized"])


def reverse_populate_name_normalized(apps, schema_editor):
    """Reverse migration - set name_normalized to None"""
    BoulderProblem = apps.get_model("boulders", "BoulderProblem")
    BoulderProblem.objects.all().update(name_normalized=None)


class Migration(migrations.Migration):

    dependencies = [
        ("boulders", "0010_add_name_normalized_field"),
    ]

    operations = [
        migrations.RunPython(
            populate_name_normalized, reverse_populate_name_normalized
        ),
    ]
