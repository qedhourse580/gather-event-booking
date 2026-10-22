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

    # 主催者が変更できる公開状態の遷移。開催中止は元に戻せない（終端）
    ALLOWED_TRANSITIONS = {
        Status.DRAFT: {Status.DRAFT, Status.PUBLISHED},
        Status.PUBLISHED: {Status.PUBLISHED, Status.DRAFT, Status.CANCELLED},
        Status.CANCELLED: set(),
    }

    def __str__(self):
        return self.title

    def can_change_status_to(self, new_status):
        return new_status in self.ALLOWED_TRANSITIONS[self.status]


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

    def __str__(self):
        return f"{self.event} / {self.user} ({self.get_status_display()})"


class ReservationLog(models.Model):
    class Action(models.TextChoices):
        RESERVED = "reserved", "予約"
        CANCELLED = "cancelled", "キャンセル"
        EVENT_CANCELLED = "event_cancelled", "開催中止によるキャンセル"

    reservation = models.ForeignKey(
        Reservation, on_delete=models.PROTECT, related_name="history"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.reservation_id}: {self.get_action_display()}"
