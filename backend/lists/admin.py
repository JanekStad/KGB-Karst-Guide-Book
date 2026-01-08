from django.contrib import admin
from backend.lists.models import Tick, UserList, ListEntry


@admin.register(Tick)
class TickAdmin(admin.ModelAdmin):
    list_display = ["user", "problem", "date", "suggested_grade", "created_at"]
    list_filter = ["date", "suggested_grade", "created_at"]
    search_fields = ["user__username", "problem__name"]
    readonly_fields = ["created_at"]
    fieldsets = (
        ("Tick Information", {"fields": ("user", "problem", "date", "notes")}),
        (
            "Grade Voting",
            {
                "fields": ("suggested_grade",),
                "description": "User's suggested grade for this problem (optional)",
            },
        ),
        ("Metadata", {"fields": ("created_at",), "classes": ("collapse",)}),
    )


@admin.register(UserList)
class UserListAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "is_public", "created_at"]
    list_filter = ["is_public", "created_at"]
    search_fields = ["name", "user__username", "description"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(ListEntry)
class ListEntryAdmin(admin.ModelAdmin):
    list_display = ["user_list", "problem", "added_at"]
    list_filter = ["added_at"]
    search_fields = ["user_list__name", "problem__name"]
    readonly_fields = ["added_at"]
