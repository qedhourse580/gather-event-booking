from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
import pytest
from django.db import close_old_connections, connection
from django.utils import timezone
from booking.models import Event, Reservation, User
from booking.services import Conflict, cancel, reserve


@pytest.mark.django_db(transaction=True)
def test_simultaneous_last_seat_reservations():
    if connection.vendor != "postgresql":
        pytest.skip(
            "Row-lock behavior must be verified against PostgreSQL; SQLite is not equivalent."
        )
    host = User.objects.create_user(username="host", is_organizer=True)
    users = [User.objects.create_user(username=f"person-{i}") for i in range(6)]
    start = timezone.now() + timedelta(days=5)
    event = Event.objects.create(
        organizer=host,
        title="One seat",
        description="Concurrency test",
        category="community",
        location="Tokyo",
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        booking_deadline=start,
        cancellation_deadline=start,
        capacity=1,
        status="published",
    )
    barrier = Barrier(len(users))

    def attempt(user_id):
        close_old_connections()
        try:
            user = User.objects.get(pk=user_id)
            barrier.wait(timeout=15)
            try:
                reserve(event.pk, user)
                return 201
            except Conflict:
                return 409
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(users)) as pool:
        results = list(pool.map(attempt, [user.pk for user in users]))
    assert results.count(201) == 1
    assert results.count(409) == 5
    assert Reservation.objects.filter(status="active").count() == 1
    event.refresh_from_db()
    assert event.reserved_count == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_retries_do_not_duplicate_a_booking():
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks.")
    host = User.objects.create_user(username="host-retry", is_organizer=True)
    user = User.objects.create_user(username="retry-person")
    start = timezone.now() + timedelta(days=5)
    event = Event.objects.create(
        organizer=host,
        title="Retry",
        description="Retry behavior",
        category="community",
        location="Tokyo",
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        booking_deadline=start,
        cancellation_deadline=start,
        capacity=10,
        status="published",
    )
    barrier = Barrier(2)

    def attempt(_):
        close_old_connections()
        try:
            barrier.wait(timeout=15)
            try:
                reserve(event.pk, user)
                return 201
            except Conflict:
                return 409
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, range(2))) == [201, 409]
    event.refresh_from_db()
    assert event.reserved_count == 1
    assert Reservation.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_cancellation_only_returns_one_seat():
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks.")
    host = User.objects.create_user(username="host-cancel", is_organizer=True)
    user = User.objects.create_user(username="cancel-person")
    start = timezone.now() + timedelta(days=5)
    event = Event.objects.create(
        organizer=host,
        title="Cancel",
        description="Cancel behavior",
        category="community",
        location="Tokyo",
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        booking_deadline=start,
        cancellation_deadline=start,
        capacity=1,
        status="published",
    )
    reservation = reserve(event.pk, user)
    barrier = Barrier(2)

    def attempt(_):
        close_old_connections()
        try:
            barrier.wait(timeout=15)
            return cancel(reservation.pk, user).status
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(attempt, range(2))) == ["cancelled", "cancelled"]
    event.refresh_from_db()
    assert event.reserved_count == 0
    assert reservation.history.filter(action="cancelled").count() == 1
