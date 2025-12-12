"""
Base mixins for boulders app viewsets.
"""


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
