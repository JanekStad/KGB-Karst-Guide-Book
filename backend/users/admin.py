from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profile"
    fieldsets = (
        ("Basic Info", {"fields": ("bio", "avatar", "location")}),
        (
            "Physical Stats",
            {
                "fields": ("height", "ape_index"),
                "description": "Height category and ape index (wingspan - height) in cm",
            },
        ),
    )


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "height", "ape_index", "location", "created_at"]
    search_fields = ["user__username", "user__email", "location", "bio"]
    fieldsets = (
        ("User Information", {"fields": ("user", "bio", "avatar", "location")}),
        (
            "Physical Stats",
            {
                "fields": ("height", "ape_index"),
                "description": "Height category and ape index (wingspan - height) in cm",
            },
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )
    readonly_fields = ["created_at", "updated_at"]
