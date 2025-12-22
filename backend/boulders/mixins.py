from django.db import models
from boulders.utils import normalize_problem_name


class CreatedByMixin:
    """Mixin that sets created_by to current user on create"""

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ListDetailSerializerMixin:
    """Mixin for viewsets that use different serializers for list and detail views"""

    def get_serializer_class(self):
        if self.action == "list":
            return self.list_serializer_class
        return self.serializer_class


class NameNormalizedMixin(models.Model):
    """
    Abstract model mixin that adds name_normalized field and auto-normalizes name on save.

    Models inheriting from this mixin must have a 'name' field (CharField).
    The name_normalized field will be automatically populated from the 'name' field
    when save() is called.
    """

    name_normalized = models.CharField(
        max_length=200,
        db_index=True,
        blank=True,
        help_text="Normalized version of name (lowercase, no diacritics) for safe lookups",
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Auto-populate name_normalized from name before saving"""
        if hasattr(self, "name") and self.name:
            self.name_normalized = normalize_problem_name(self.name)
        elif not self.name_normalized:
            self.name_normalized = ""

        super().save(*args, **kwargs)

    @classmethod
    def find_by_normalized_name(cls, name):
        """
        Find instances by normalized name (case-insensitive, diacritic-insensitive).

        Args:
            name (str): Name to search for (will be normalized)

        Returns:
            QuerySet: QuerySet of matching instances
        """
        normalized = normalize_problem_name(name)
        return cls.objects.filter(name_normalized=normalized)
