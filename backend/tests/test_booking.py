from datetime import timedelta
from unittest.mock import patch
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from booking.models import Reservation, ReservationLog
from booking.services import reserve

pytestmark = pytest.mark.django_db


def test_reserve_cancel_and_rebook(client, event, user):
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


def test_full_event_rejects_without_side_effects(client, event, other):
    event.capacity = 1
    event.save()
    reserve(event.pk, other)
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 409
    assert Reservation.objects.count() == 1
    event.refresh_from_db()
    assert event.reserved_count == 1


def test_booking_deadline_is_exclusive(client, event):
    now = timezone.now()
    event.booking_deadline = now
    event.save()
    with patch("booking.services.timezone.now", return_value=now):
        assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 409
    assert Reservation.objects.count() == 0


def test_cancellation_deadline_is_exclusive(client, event, user):
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
def test_non_public_events_cannot_be_booked(client, event, event_status):
    event.status = event_status
    event.save()
    assert client.post(f"/api/events/{event.pk}/reserve/").status_code == 404


def test_cancelled_event_can_be_cancelled_after_deadline(client, event, user):
    reservation = reserve(event.pk, user)
    event.status = "cancelled"
    event.cancellation_deadline = timezone.now() - timedelta(hours=1)
    event.save(update_fields=["status", "cancellation_deadline"])
    assert client.post(f"/api/reservations/{reservation.pk}/cancel/").status_code == 200
    assert client.get(f"/api/events/{event.pk}/").status_code == 200


def test_history_failure_rolls_back_entire_booking(event, user):
    with patch(
        "booking.services.ReservationLog.objects.create",
        side_effect=RuntimeError("storage failure"),
    ):
        with pytest.raises(RuntimeError):
            reserve(event.pk, user)
    event.refresh_from_db()
    assert event.reserved_count == 0
    assert Reservation.objects.count() == 0


def test_other_user_cannot_read_or_cancel_reservation(client, event, other):
    reservation = reserve(event.pk, other)
    assert client.get(f"/api/reservations/{reservation.pk}/").status_code == 404
    assert client.post(f"/api/reservations/{reservation.pk}/cancel/").status_code == 404
    assert client.get("/api/reservations/").data["count"] == 0


def test_attendees_and_event_updates_are_owner_only(client, event):
    assert client.get(f"/api/organizer/events/{event.pk}/attendees/").status_code == 404
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"title": "Changed"}, format="json"
        ).status_code
        == 404
    )
    assert client.get("/api/organizer/events/").data["count"] == 0


def test_anonymous_cannot_book_or_read_reservations(event):
    anonymous = APIClient()
    assert anonymous.post(f"/api/events/{event.pk}/reserve/").status_code == 403
    assert anonymous.get("/api/reservations/").status_code == 403


def test_capacity_edit_cannot_discard_existing_reservations(
    client, event, user, other, organizer
):
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
def test_invalid_capacity(client, event, organizer, capacity):
    client.force_authenticate(organizer)
    assert (
        client.patch(
            f"/api/organizer/events/{event.pk}/", {"capacity": capacity}, format="json"
        ).status_code
        == 400
    )


def test_attendees_only_include_current_event(client, event, organizer, user):
    reserve(event.pk, user)
    client.force_authenticate(organizer)
    response = client.get(f"/api/organizer/events/{event.pk}/attendees/")
    assert response.status_code == 200
    assert response.data["results"][0]["participant"] == "Alice"


def test_public_filter_and_draft_visibility(client, event):
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


def test_full_events_can_be_filtered(client, event, user):
    event.capacity = 1
    event.save()
    reserve(event.pk, user)
    assert client.get("/api/events/?available=true").data["count"] == 0


def test_registration_rejects_weak_password():
    client = APIClient()
    response = client.post(
        "/api/auth/register/",
        {"username": "someone", "display_name": "Name", "password": "12345678"},
        format="json",
    )
    assert response.status_code == 400


def test_session_login_and_logout(user):
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


def test_signup_requires_csrf():
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


def test_health_and_schema():
    client = APIClient()
    assert client.get("/api/health/").status_code == 200
    assert client.get("/api/schema/").status_code == 200


@pytest.mark.parametrize(
    "path",
    ["/api/events/not-a-number/reserve/", "/api/reservations/not-a-number/cancel/"],
)
def test_invalid_path_ids_return_not_found(client, path):
    assert client.post(path).status_code == 404
