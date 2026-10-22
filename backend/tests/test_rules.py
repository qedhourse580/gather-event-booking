"""APIを通さずに、モデル・シリアライザの判定ロジックだけを確かめる単体テスト"""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from booking.models import Event, Reservation
from booking.serializers import EventSerializer, ReservationSerializer

S = Event.Status


@pytest.mark.parametrize(
    ("current", "new", "expected"),
    [
        (S.DRAFT, S.DRAFT, True),
        (S.DRAFT, S.PUBLISHED, True),
        (S.DRAFT, S.CANCELLED, False),
        (S.PUBLISHED, S.PUBLISHED, True),
        (S.PUBLISHED, S.DRAFT, True),
        (S.PUBLISHED, S.CANCELLED, True),
        (S.CANCELLED, S.DRAFT, False),
        (S.CANCELLED, S.PUBLISHED, False),
        (S.CANCELLED, S.CANCELLED, False),
    ],
)
def test_公開状態の遷移の可否(current, new, expected):
    assert Event(status=current).can_change_status_to(new) is expected


def make_event(**overrides):
    now = timezone.now()
    values = {
        "status": S.PUBLISHED,
        "capacity": 10,
        "reserved_count": 0,
        "starts_at": now + timedelta(days=7),
        "booking_deadline": now + timedelta(days=6),
        "cancellation_deadline": now + timedelta(days=5),
    }
    values.update(overrides)
    return Event(**values)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, True),
        ({"reserved_count": 9}, True),  # 残り1席
        ({"reserved_count": 10}, False),  # 満席
        ({"status": S.DRAFT}, False),
        ({"status": S.CANCELLED}, False),
    ],
)
def test_予約できるかの判定(overrides, expected):
    assert EventSerializer().get_can_book(make_event(**overrides)) is expected


def test_予約締切ちょうどは予約できない():
    now = timezone.now()
    event = make_event(booking_deadline=now)
    with patch("booking.serializers.timezone.now", return_value=now):
        assert EventSerializer().get_can_book(event) is False
    with patch(
        "booking.serializers.timezone.now", return_value=now - timedelta(seconds=1)
    ):
        assert EventSerializer().get_can_book(event) is True


def test_残席数は定員から予約数を引いた値():
    assert EventSerializer().get_remaining(make_event(reserved_count=3)) == 7


@pytest.mark.parametrize(
    ("reservation_status", "event_overrides", "expected"),
    [
        (Reservation.Status.ACTIVE, {}, True),
        (Reservation.Status.CANCELLED, {}, False),
        # キャンセル期限を過ぎていてもイベントが中止なら取り消せる
        (
            Reservation.Status.ACTIVE,
            {
                "status": S.CANCELLED,
                "cancellation_deadline": timezone.now() - timedelta(days=1),
            },
            True,
        ),
        (
            Reservation.Status.ACTIVE,
            {"cancellation_deadline": timezone.now() - timedelta(seconds=1)},
            False,
        ),
    ],
)
def test_キャンセルできるかの判定(reservation_status, event_overrides, expected):
    reservation = SimpleNamespace(
        status=reservation_status, event=make_event(**event_overrides)
    )
    assert ReservationSerializer().get_can_cancel(reservation) is expected


def schedule(start_offset):
    start = timezone.now() + start_offset
    return {
        "starts_at": start,
        "ends_at": start + timedelta(hours=2),
        "booking_deadline": start - timedelta(hours=1),
        "cancellation_deadline": start - timedelta(days=1),
    }


def validate(attrs, instance=None):
    serializer = EventSerializer(instance=instance)
    return serializer.validate(attrs)


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"ends_at_offset": timedelta(0)}, "ends_at"),  # 終了 = 開始は不可
        ({"booking_deadline_offset": timedelta(minutes=1)}, "booking_deadline"),
        (
            {"cancellation_deadline_offset": timedelta(minutes=1)},
            "cancellation_deadline",
        ),
    ],
)
def test_日時の前後関係のチェック(changes, field):
    attrs = {**schedule(timedelta(days=7)), "capacity": 10, "status": S.DRAFT}
    start = attrs["starts_at"]
    for key, offset in changes.items():
        attrs[key.removesuffix("_offset")] = start + offset
    with pytest.raises(ValidationError) as exc:
        validate(attrs)
    assert field in exc.value.detail


def test_期限が開始日時ちょうどなら許可する():
    attrs = {**schedule(timedelta(days=7)), "capacity": 10, "status": S.DRAFT}
    attrs["booking_deadline"] = attrs["starts_at"]
    attrs["cancellation_deadline"] = attrs["starts_at"]
    assert validate(attrs) == attrs


@pytest.mark.parametrize(
    ("capacity", "ok"), [(0, False), (1, True), (10000, True), (10001, False)]
)
def test_定員の境界値(capacity, ok):
    attrs = {**schedule(timedelta(days=7)), "capacity": capacity, "status": S.DRAFT}
    if ok:
        assert validate(attrs) == attrs
    else:
        with pytest.raises(ValidationError):
            validate(attrs)


def test_新規作成で開始日時が過去なら拒否する():
    attrs = {**schedule(-timedelta(minutes=1)), "capacity": 10, "status": S.DRAFT}
    with pytest.raises(ValidationError) as exc:
        validate(attrs)
    assert "starts_at" in exc.value.detail
