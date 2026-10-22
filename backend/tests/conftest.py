from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import Event, User


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="alice", password="Example-Password-94!", display_name="Alice"
    )


@pytest.fixture
def other(db):
    return User.objects.create_user(
        username="bob", password="Example-Password-95!", display_name="Bob"
    )


@pytest.fixture
def organizer(db):
    return User.objects.create_user(
        username="host",
        password="Example-Password-96!",
        display_name="Host",
        is_organizer=True,
    )


@pytest.fixture
def event(organizer):
    starts = timezone.now() + timedelta(days=7)
    return Event.objects.create(
        organizer=organizer,
        title="Weekend meetup",
        description="A community event.",
        category="community",
        location="東京",
        starts_at=starts,
        ends_at=starts + timedelta(hours=2),
        booking_deadline=starts - timedelta(hours=1),
        cancellation_deadline=starts - timedelta(days=1),
        capacity=2,
        status="published",
    )


@pytest.fixture
def client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client
