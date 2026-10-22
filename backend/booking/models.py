from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import F, Q


class User(AbstractUser):
    display_name = models.CharField(max_length=80)
    is_organizer = models.BooleanField(default=False)


class Event(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "下書き"
        PUBLISHED = "published", "公開中"
        CANCELLED = "cancelled", "開催中止"

    class Category(models.TextChoices):
        TECHNOLOGY = "technology", "テクノロジー"
        ART = "art", "アート・カルチャー"
        FOOD = "food", "フード"
        OUTDOOR = "outdoor", "アウトドア"
        COMMUNITY = "community", "交流会"

    organizer = models.ForeignKey(User, on_delete=models.PROTECT, related_name="events")
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=10000)
    category = models.CharField(max_length=20, choices=Category.choices)
    location = models.CharField(max_length=150)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    booking_deadline = models.DateTimeField()
    cancellation_deadline = models.DateTimeField()
    capacity = models.PositiveIntegerField()
    reserved_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "id"]
        indexes = [
            models.Index(fields=["status", "starts_at"]),
            models.Index(fields=["category", "starts_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(capacity__gte=1) & Q(capacity__lte=10000),
                name="valid_event_capacity",
            ),
            models.CheckConstraint(
                condition=Q(reserved_count__gte=0)
                & Q(reserved_count__lte=F("capacity")),
                name="event_capacity_not_exceeded",
            ),
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")), name="event_ends_after_start"
            ),
            models.CheckConstraint(
                condition=Q(booking_deadline__lte=F("starts_at"))
                & Q(cancellation_deadline__lte=F("starts_at")),
                name="event_deadlines_before_start",
            ),
        ]

    def __str__(self):
        return self.title


class Reservation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "予約済み"
        CANCELLED = "cancelled", "キャンセル済み"

    event = models.ForeignKey(
        Event, on_delete=models.PROTECT, related_name="reservations"
    )
    user = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="reservations"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"], name="one_reservation_per_user_event"
            )
        ]


class ReservationLog(models.Model):
    reservation = models.ForeignKey(
        Reservation, on_delete=models.PROTECT, related_name="history"
    )
    action = models.CharField(
        max_length=12, choices=[("reserved", "予約"), ("cancelled", "キャンセル")]
    )
    created_at = models.DateTimeField(auto_now_add=True)
