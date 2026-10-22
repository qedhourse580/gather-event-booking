import logging
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound
from .models import Event, Reservation, ReservationLog

logger = logging.getLogger(__name__)


class Conflict(APIException):
    status_code = 409
    default_code = "conflict"
    default_detail = "現在の状態では操作できません。"


@transaction.atomic
def reserve(event_id, user):
    # All capacity-changing operations lock the SAME event row first.
    try:
        event = Event.objects.select_for_update().get(
            pk=event_id, status=Event.Status.PUBLISHED
        )
    except Event.DoesNotExist:
        raise NotFound("イベントが見つかりません。")
    if timezone.now() >= event.booking_deadline:
        raise Conflict("予約の受付は終了しました。")
    previous = Reservation.objects.filter(event=event, user=user).first()
    if previous and previous.status == Reservation.Status.ACTIVE:
        raise Conflict("このイベントはすでに予約済みです。")
    if event.reserved_count >= event.capacity:
        raise Conflict("満席のため予約できません。")
    if previous:
        previous.status = Reservation.Status.ACTIVE
        previous.save(update_fields=["status", "updated_at"])
        reservation = previous
    else:
        reservation = Reservation.objects.create(event=event, user=user)
    event.reserved_count += 1
    event.save(update_fields=["reserved_count", "updated_at"])
    ReservationLog.objects.create(reservation=reservation, action="reserved")
    logger.info(
        "reservation.created event=%s reservation=%s user=%s",
        event.pk,
        reservation.pk,
        user.pk,
    )
    return reservation


@transaction.atomic
def cancel(reservation_id, user):
    try:
        owned = Reservation.objects.only("event_id").get(pk=reservation_id, user=user)
    except Reservation.DoesNotExist:
        raise NotFound("予約が見つかりません。")
    event = Event.objects.select_for_update().get(pk=owned.event_id)
    reservation = Reservation.objects.get(pk=reservation_id, user=user)
    if reservation.status == Reservation.Status.CANCELLED:
        return reservation  # retry-safe: never return the seat twice
    if (
        event.status != Event.Status.CANCELLED
        and timezone.now() >= event.cancellation_deadline
    ):
        raise Conflict("キャンセル期限を過ぎています。")
    reservation.status = Reservation.Status.CANCELLED
    reservation.save(update_fields=["status", "updated_at"])
    event.reserved_count -= 1
    event.save(update_fields=["reserved_count", "updated_at"])
    ReservationLog.objects.create(reservation=reservation, action="cancelled")
    logger.info(
        "reservation.cancelled event=%s reservation=%s user=%s",
        event.pk,
        reservation.pk,
        user.pk,
    )
    return reservation
