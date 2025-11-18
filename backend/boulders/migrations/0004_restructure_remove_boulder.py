# Generated migration to restructure: remove Boulder, add Wall, make problems belong to Crag

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_boulder_to_crag(apps, schema_editor):
    """Migrate existing BoulderProblems from Boulder to Crag"""
    BoulderProblem = apps.get_model('boulders', 'BoulderProblem')
    Boulder = apps.get_model('boulders', 'Boulder')
    
    # For each problem, get its boulder's crag and assign it
    for problem in BoulderProblem.objects.all():
        if problem.boulder and problem.boulder.crag:
            problem.crag = problem.boulder.crag
            problem.save()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('boulders', '0003_make_crag_required'),
    ]

    operations = [
        # Create Wall model
        migrations.CreateModel(
            name='Wall',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('crag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='walls', to='boulders.crag')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_walls', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['crag', 'name'],
                'unique_together': {('crag', 'name')},
            },
        ),
        
        # Add crag field to BoulderProblem (nullable first)
        migrations.AddField(
            model_name='boulderproblem',
            name='crag',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='problems', to='boulders.crag'),
        ),
        
        # Add wall field to BoulderProblem (nullable)
        migrations.AddField(
            model_name='boulderproblem',
            name='wall',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='problems', to='boulders.wall'),
        ),
        
        # Migrate data: assign crag from boulder
        migrations.RunPython(migrate_boulder_to_crag, migrations.RunPython.noop),
        
        # Make crag required
        migrations.AlterField(
            model_name='boulderproblem',
            name='crag',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='problems', to='boulders.crag'),
        ),
        
        # Update unique_together constraint
        migrations.AlterUniqueTogether(
            name='boulderproblem',
            unique_together={('crag', 'name')},
        ),
        
        # Update ordering
        migrations.AlterModelOptions(
            name='boulderproblem',
            options={'ordering': ['crag', 'wall', 'name']},
        ),
        
        # Update BoulderImage to reference Wall instead of Boulder
        migrations.AddField(
            model_name='boulderimage',
            name='wall',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='boulders.wall'),
        ),
        
        # Migrate images from boulder to wall (if any)
        # For now, we'll just remove boulder reference
        migrations.RemoveField(
            model_name='boulderimage',
            name='boulder',
        ),
        
        # Remove boulder field from BoulderProblem
        migrations.RemoveField(
            model_name='boulderproblem',
            name='boulder',
        ),
        
        # Delete Boulder model
        migrations.DeleteModel(
            name='Boulder',
        ),
    ]
