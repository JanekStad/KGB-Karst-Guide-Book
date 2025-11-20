# Generated manually to make name_normalized non-nullable

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("boulders", "0011_populate_name_normalized"),
    ]

    operations = [
        migrations.AlterField(
            model_name="boulderproblem",
            name="name_normalized",
            field=models.CharField(
                db_index=True,
                help_text="Normalized version of name (lowercase, no diacritics) for safe lookups",
                max_length=200,
            ),
        ),
    ]
