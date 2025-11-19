from django.contrib import admin
from .models import City, Crag, Wall, BoulderProblem, BoulderImage


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['name', 'crag_count', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at', 'crag_count']
    
    def crag_count(self, obj):
        return obj.crag_count
    crag_count.short_description = 'Crags'


@admin.register(Crag)
class CragAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'latitude', 'longitude', 'created_by', 'created_at']
    list_filter = ['city', 'created_at']
    search_fields = ['name', 'description', 'city__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Wall)
class WallAdmin(admin.ModelAdmin):
    list_display = ['name', 'crag', 'created_by', 'created_at']
    list_filter = ['crag', 'created_at']
    search_fields = ['name', 'description', 'crag__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(BoulderProblem)
class BoulderProblemAdmin(admin.ModelAdmin):
    list_display = ['name', 'crag', 'wall', 'grade', 'created_by', 'created_at']
    list_filter = ['crag', 'wall', 'grade', 'created_at']
    search_fields = ['name', 'crag__name', 'wall__name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'crag', 'wall', 'grade', 'description')
        }),
        ('Media & Links', {
            'fields': ('external_links', 'video_links'),
            'description': 'External links: [{"label": "8a.nu", "url": "https://..."}]. Video links: [{"label": "Send Video", "url": "https://youtube.com/..."}]'
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(BoulderImage)
class BoulderImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'wall', 'problem', 'is_primary', 'uploaded_by', 'uploaded_at']
    list_filter = ['is_primary', 'uploaded_at']
    readonly_fields = ['uploaded_at']

