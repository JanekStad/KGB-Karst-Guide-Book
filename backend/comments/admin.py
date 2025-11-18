from django.contrib import admin
from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'problem', 'user', 'created_at', 'edited']
    list_filter = ['created_at', 'edited']
    search_fields = ['content', 'user__username', 'problem__name']
    readonly_fields = ['created_at', 'updated_at']

