# Generated migration to add is_secret field to Sector model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("boulders", "0003_add_polygon_boundary_to_sector"),
    ]

    operations = [
        migrations.AddField(
            model_name="sector",
            name="is_secret",
            field=models.BooleanField(
                default=False,
                help_text="If True, this sector is hidden from public view (secret/illegal climbing spots)",
            ),
        ),
    ]

