import os
import secrets
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from booking.models import Event, User


class Command(BaseCommand):
    help = "Create sample events and demo accounts without deleting existing data."

    def handle(self, *args, **options):
        password = os.getenv("DEMO_PASSWORD") or secrets.token_urlsafe(16)
        organizer, created = User.objects.get_or_create(
            username="organizer",
            defaults={"display_name": "Gather Community", "is_organizer": True},
        )
        if created:
            organizer.set_password(password)
            organizer.save()
        participant, created = User.objects.get_or_create(
            username="visitor", defaults={"display_name": "ゲストさん"}
        )
        if created:
            participant.set_password(password)
            participant.save()
        events = [
            ("週末のプロダクトづくり交流会", "community", "東京・渋谷", 24),
            ("はじめての陶芸、小さな器づくり", "art", "東京・清澄白河", 12),
            ("Pythonでつくる、暮らしのWebサービス", "technology", "オンライン", 40),
            ("コーヒーと過ごす、日曜の朝", "food", "東京・蔵前", 16),
            ("街の余白を探す、フォトウォーク", "outdoor", "神奈川・横浜", 20),
            ("デザインとエンジニアリングの交差点", "technology", "大阪・梅田", 32),
            ("季節のスパイスカレーをつくろう", "food", "東京・中目黒", 10),
            ("森の読書会と、小さなピクニック", "outdoor", "東京・吉祥寺", 18),
            ("活版印刷でつくる、自分だけのカード", "art", "京都・烏丸", 8),
        ]
        base = timezone.localtime().replace(hour=14, minute=0, second=0, microsecond=0)
        for index, (title, category, location, capacity) in enumerate(events):
            starts = base + timedelta(days=index + 5)
            Event.objects.get_or_create(
                title=title,
                organizer=organizer,
                defaults={
                    "description": f"{title}。\n\n新しい体験と、同じことに興味を持つ人との出会いを楽しむイベントです。初めての方もお気軽にご参加ください。\n\n当日は開始10分前から受付します。自己紹介のあと、少人数のグループに分かれて体験・交流を行います。\n\n持ち物：特にありません。動きやすい服装でお越しください。",
                    "category": category,
                    "location": location,
                    "starts_at": starts,
                    "ends_at": starts + timedelta(hours=2),
                    "booking_deadline": starts - timedelta(hours=1),
                    "cancellation_deadline": starts - timedelta(days=1),
                    "capacity": capacity,
                    "status": Event.Status.PUBLISHED,
                },
            )
        self.stdout.write(
            self.style.SUCCESS("Sample events are ready. Accounts: organizer / visitor")
        )
        if not os.getenv("DEMO_PASSWORD"):
            self.stdout.write(
                "New demo accounts use this one-time generated password: " + password
            )
