from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Event, Reservation, ReservationLog, User


@admin.register(User)
class GatherUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Gather", {"fields": ("display_name", "is_organizer")}),
    )


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "organizer",
        "starts_at",
        "status",
        "reserved_count",
        "capacity",
    ]
    readonly_fields = ["reserved_count"]
    list_filter = ["status", "category"]
    search_fields = ["title"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # capacity changes must pass through the locked service/API

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Reservation, ReservationLog)
class AuditAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
