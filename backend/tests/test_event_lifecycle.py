"""主催者によるイベントの公開状態・日時の変更に関するテスト"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import Event, Reservation, ReservationLog
from booking.services import cancel, reserve

pytestmark = pytest.mark.django_db


@pytest.fixture
def host(organizer):
    client = APIClient()
    client.force_authenticate(organizer)
    return client


def patch(client, event, data):
    return client.patch(f"/api/organizer/events/{event.pk}/", data, format="json")


def new_event_payload(**overrides):
    starts = timezone.now() + timedelta(days=10)
    payload = {
        "title": "新しいイベント",
        "description": "説明",
        "category": "community",
        "location": "東京",
        "starts_at": starts.isoformat(),
        "ends_at": (starts + timedelta(hours=2)).isoformat(),
        "booking_deadline": (starts - timedelta(hours=1)).isoformat(),
        "cancellation_deadline": (starts - timedelta(days=1)).isoformat(),
        "capacity": 10,
        "status": "draft",
    }
    payload.update(overrides)
    return payload


def test_開催中止にすると有効な予約がすべてキャンセルされ履歴が残る(
    host, event, user, other
):
    first = reserve(event.pk, user)
    second = reserve(event.pk, other)
    # すでに本人がキャンセルした予約は、開催中止の対象に含めない
    cancel(second.pk, other)

    response = patch(host, event, {"status": "cancelled"})

    assert response.status_code == 200
    assert response.data["status"] == "cancelled"
    assert response.data["reserved_count"] == 0
    first.refresh_from_db()
    assert first.status == Reservation.Status.CANCELLED
    assert list(
        ReservationLog.objects.filter(reservation=first).values_list(
            "action", flat=True
        )
    ) == ["reserved", "event_cancelled"]
    assert not ReservationLog.objects.filter(
        reservation=second, action="event_cancelled"
    ).exists()


def test_予約がない公開イベントも開催中止にできる(host, event):
    assert patch(host, event, {"status": "cancelled"}).status_code == 200
    event.refresh_from_db()
    assert event.status == Event.Status.CANCELLED


@pytest.mark.parametrize("next_status", ["published", "draft"])
def test_開催中止したイベントは公開や下書きに戻せない(host, event, next_status):
    patch(host, event, {"status": "cancelled"})

    response = patch(host, event, {"status": next_status})

    assert response.status_code == 400
    event.refresh_from_db()
    assert event.status == Event.Status.CANCELLED


def test_開催中止したイベントは内容も編集できない(host, event):
    patch(host, event, {"status": "cancelled"})

    response = patch(host, event, {"title": "変更後のタイトル"})

    assert response.status_code == 400
    assert "status" in response.data


def test_下書きから公開そして予約がなければ下書きに戻せる(host, event):
    event.status = Event.Status.DRAFT
    event.save()

    assert patch(host, event, {"status": "published"}).status_code == 200
    assert patch(host, event, {"status": "draft"}).status_code == 200


def test_新規作成時に開催中止は選べない(host):
    response = host.post(
        "/api/organizer/events/", new_event_payload(status="cancelled"), format="json"
    )
    assert response.status_code == 400
    assert "status" in response.data


def test_編集で開始日時を過去にはできない(host, event):
    past = timezone.now() - timedelta(hours=1)
    response = patch(
        host,
        event,
        {
            "starts_at": past.isoformat(),
            "ends_at": (past + timedelta(hours=2)).isoformat(),
            "booking_deadline": (past - timedelta(hours=1)).isoformat(),
            "cancellation_deadline": (past - timedelta(days=1)).isoformat(),
        },
    )
    assert response.status_code == 400
    assert "starts_at" in response.data


def test_開始済みのイベントでも日時を変えなければ他の項目は編集できる(host, event):
    # 画面からは日時も含めて全項目が送られるため、同じ値なら日時の変更とみなさない
    started = timezone.now() - timedelta(minutes=30)
    Event.objects.filter(pk=event.pk).update(
        starts_at=started,
        ends_at=started + timedelta(hours=2),
        booking_deadline=started - timedelta(hours=1),
        cancellation_deadline=started - timedelta(days=1),
    )
    event.refresh_from_db()

    response = patch(
        host,
        event,
        {
            "title": "タイトルだけ変更",
            "starts_at": event.starts_at.isoformat(),
            "ends_at": event.ends_at.isoformat(),
            "booking_deadline": event.booking_deadline.isoformat(),
            "cancellation_deadline": event.cancellation_deadline.isoformat(),
        },
    )

    assert response.status_code == 200
    assert response.data["title"] == "タイトルだけ変更"


def test_編集で開始日時を未来の別日時に変えられる(host, event):
    later = event.starts_at + timedelta(days=3)
    response = patch(
        host,
        event,
        {
            "starts_at": later.isoformat(),
            "ends_at": (later + timedelta(hours=2)).isoformat(),
        },
    )
    assert response.status_code == 200
