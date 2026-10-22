from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import Reservation, ReservationLog
from booking.services import reserve

pytestmark = pytest.mark.django_db


def test_予約とキャンセルと再予約ができる(client, event, user):
    response = client.post(f"/api/events/{event.pk}/reserve/")
    assert response.status_code == 201
    reservation = response.data["id"]
    event.refresh_from_db()
    assert event.reserved_count == 1
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 409
    assert client.post(f"/api/reservations/{reservation}/cancel/").status_code == 200
    assert client.post(f"/api/reservations/{reservation}/cancel/").status_code == 200
    event.refresh_from_db()
    assert event.reserved_count == 0
    assert ReservationLog.objects.count() == 2
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 201
    assert Reservation.objects.count() == 1
    assert ReservationLog.objects.count() == 3


def test_満席なら予約を拒否しデータを変えない(client, event, other):
    event.capacity = 1
    event.save()
    reserve(event.pk, other)
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 409
    assert Reservation.objects.count() == 1
    event.refresh_from_db()
    assert event.reserved_count == 1


def test_予約締切ちょうどは予約できない(client, event):
    now = timezone.now()
    event.booking_deadline = now
    event.save()
    with patch("booking.services.timezone.now", return_value=now):
        assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 409
    assert Reservation.objects.count() == 0


def test_キャンセル期限ちょうどはキャンセルできない(client, event, user):
    reservation = reserve(event.pk, user)
    now = timezone.now()
    event.cancellation_deadline = now
    event.save(update_fields=["cancellation_deadline"])
    with patch("booking.services.timezone.now", return_value=now):
        assert (
            client.post(f"/api/reservations/{reservation.pk}/cancel/").status_code
            == 409
        )
    event.refresh_from_db()
    assert event.reserved_count == 1


@pytest.mark.parametrize("event_status", ["draft", "cancelled"])
def test_公開中以外のイベントは予約できない(client, event, event_status):
    event.status = event_status
    event.save()
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 404


def test_中止イベントは期限後でもキャンセルできる(client, event, user):
    reservation = reserve(event.pk, user)
    event.status = "cancelled"
    event.cancellation_deadline = timezone.now() - timedelta(hours=1)
    event.save(update_fields=["status", "cancellation_deadline"])
    assert client.post(f"/api/reservations/{reservation.pk}/cancel/").status_code == 200
    assert client.get(f"/api/events/{event.pk}/").status_code == 200


def test_履歴の保存に失敗したら予約全体を取り消す(event, user):
    with patch(
        "booking.services.ReservationLog.objects.create",
        side_effect=RuntimeError("storage failure"),
    ):
        with pytest.raises(RuntimeError):
            reserve(event.pk, user)
    event.refresh_from_db()
    assert event.reserved_count == 0
    assert Reservation.objects.count() == 0


def test_他人の予約は参照もキャンセルもできない(client, event, other):
    reservation = reserve(event.pk, other)
    assert client.get(f"/api/reservations/{reservation.pk}/").status_code == 404
    assert client.post(f"/api/reservations/{reservation.pk}/cancel/").status_code == 404
    assert client.get("/api/reservations/").data["count"] == 0


def test_予約者一覧とイベント編集は主催者本人だけ(client, event):
    assert client.get(f"/api/organizer/events/{event.pk}/attendees/").status_code == 404
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"title": "Changed"}, format="json"
        ).status_code
        == 404
    )
    assert client.get("/api/organizer/events/").data["count"] == 0


def test_未ログインでは予約も予約一覧の参照もできない(event):
    anonymous = APIClient()
    assert anonymous.post(f"/api/events/{event.pk}/reserve/").status_code == 403
    assert anonymous.get("/api/reservations/").status_code == 403


def test_既存の予約を減らす定員変更はできない(client, event, user, other, organizer):
    reserve(event.pk, user)
    reserve(event.pk, other)
    client.force_authenticate(organizer)
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"capacity": 1}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"status": "draft"}, format="json"
        ).status_code
        == 400
    )
    assert client.delete(f"/api/organizer/events/{event.pk}/").status_code == 405


@pytest.mark.parametrize("capacity", [0, -1, 10001])
def test_範囲外の定員は拒否する(client, event, organizer, capacity):
    client.force_authenticate(organizer)
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"capacity": capacity}, format="json"
        ).status_code
        == 400
    )


def test_予約者一覧は対象イベントの予約だけを返す(client, event, organizer, user):
    reserve(event.pk, user)
    client.force_authenticate(organizer)
    response = client.get(f"/api/organizer/events/{event.pk}/attendees/")
    assert response.status_code == 200
    assert response.data["results"][0]["participant"] == "Alice"


def test_一覧の絞り込みと下書きの非表示(client, event):
    assert (
        client.get("/api/events/?q=Weekend&category=community&location=東京").data[
            "count"
        ]
        == 1
    )
    assert client.get("/api/events/?q=not-found").data["count"] == 0
    event.status = "draft"
    event.save()
    assert client.get("/api/events/").data["count"] == 0
    assert client.get(f"/api/events/{event.pk}/").status_code == 404


def test_満席のイベントを除外して絞り込める(client, event, user):
    event.capacity = 1
    event.save()
    reserve(event.pk, user)
    assert client.get("/api/events/?available=true").data["count"] == 0


def test_弱いパスワードでは登録できない():
    client = APIClient()
    response = client.post(
        "/api/auth/register/",
        {"username": "someone", "display_name": "Name", "password": "12345678"},
        format="json",
    )
    assert response.status_code == 400


def test_セッションでログインとログアウトができる(user):
    client = APIClient(enforce_csrf_checks=True)
    assert client.get("/api/auth/session/").data["user"] is None
    assert (
        client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "Example-Password-94!"},
            format="json",
        ).status_code
        == 403
    )
    token = client.cookies["csrftoken"].value
    assert (
        client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "Example-Password-94!"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        ).status_code
        == 200
    )
    assert client.get("/api/auth/session/").data["user"]["username"] == "alice"
    token = client.cookies["csrftoken"].value
    assert client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code == 204
    assert client.get("/api/auth/session/").data["user"] is None


def test_登録にはCSRFトークンが必要():
    client = APIClient(enforce_csrf_checks=True)
    client.get("/api/auth/session/")
    payload = {
        "username": "new-person",
        "display_name": "New Person",
        "password": "A-Unique-Long-Pass-94!",
        "is_organizer": True,
    }
    assert client.post("/api/auth/register/", payload, format="json").status_code == 403
    token = client.cookies["csrftoken"].value
    response = client.post(
        "/api/auth/register/", payload, format="json", HTTP_X_CSRFTOKEN=token
    )
    assert response.status_code == 201
    assert response.data["is_organizer"] is True
    assert "password" not in response.data


def test_ヘルスチェックとAPI仕様書を返す():
    client = APIClient()
    assert client.get("/api/health/").status_code == 200
    assert client.get("/api/schema/").status_code == 200


@pytest.mark.parametrize(
    "path",
    ["/api/events/not-a-number/reserve/", "/api/reservations/not-a-number/cancel/"],
)
def test_不正なIDのパスは404を返す(client, path):
    assert client.post(path).status_code == 404
