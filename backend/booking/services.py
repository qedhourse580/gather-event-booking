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
    # 定員に関わる操作は、すべて同じイベント行を最初にロックしてから行う
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
    ReservationLog.objects.create(
        reservation=reservation, action=ReservationLog.Action.RESERVED
    )
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
    # イベント行のロック後に、予約の最新状態を読み直す
    reservation = Reservation.objects.get(pk=reservation_id, user=user)
    if reservation.status == Reservation.Status.CANCELLED:
        return reservation  # 再送されても、空席を二重に戻さない
    if (
        event.status != Event.Status.CANCELLED
        and timezone.now() >= event.cancellation_deadline
    ):
        raise Conflict("キャンセル期限を過ぎています。")
    reservation.status = Reservation.Status.CANCELLED
    reservation.save(update_fields=["status", "updated_at"])
    event.reserved_count -= 1
    event.save(update_fields=["reserved_count", "updated_at"])
    ReservationLog.objects.create(
        reservation=reservation, action=ReservationLog.Action.CANCELLED
    )
    logger.info(
        "reservation.cancelled event=%s reservation=%s user=%s",
        event.pk,
        reservation.pk,
        user.pk,
    )
    return reservation


def cancel_active_reservations(event):
    """開催中止にしたイベントの有効な予約を、すべてキャンセル扱いにする。

    呼び出し側で、イベント行をロックしたトランザクションの中から呼ぶこと。
    """
    active = list(
        event.reservations.select_for_update().filter(status=Reservation.Status.ACTIVE)
    )
    if not active:
        return 0
    Reservation.objects.filter(pk__in=[r.pk for r in active]).update(
        status=Reservation.Status.CANCELLED, updated_at=timezone.now()
    )
    ReservationLog.objects.bulk_create(
        ReservationLog(reservation=r, action=ReservationLog.Action.EVENT_CANCELLED)
        for r in active
    )
    event.reserved_count = 0
    event.save(update_fields=["reserved_count", "updated_at"])
    logger.info("event.cancelled event=%s reservations=%s", event.pk, len(active))
    return len(active)
