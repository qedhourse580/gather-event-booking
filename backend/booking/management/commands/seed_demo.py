import logging
import os
import secrets
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from booking.models import Event, User
from booking.services import reserve


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
        # (タイトル, カテゴリー, 場所, 何日後, 開始時刻, 所要分, 定員, 予約済みの人数, 説明)
        # 掲載するイベントと参加者はすべて架空。残席の表示を確かめられるよう、
        # 余裕あり・残りわずか・満席のイベントを混ぜている
        events = [
            (
                "Djangoで作るREST API入門ハンズオン",
                "technology",
                "オンライン",
                4,
                (19, 30),
                120,
                40,
                12,
                "Django REST frameworkを使って、簡単な予約APIを作りながら基本を学びます。Pythonの基礎文法が分かる方が対象です。",
            ),
            (
                "週末のプロダクトづくり交流会",
                "community",
                "東京・渋谷",
                5,
                (13, 0),
                240,
                24,
                21,
                "個人開発やサービスづくりに取り組む人同士で、進捗共有と相談をする会です。前半は各自の作業、後半は交流タイムです。",
            ),
            (
                "はじめての陶芸 手びねり体験",
                "art",
                "東京・清澄白河",
                6,
                (10, 30),
                120,
                8,
                8,
                "粘土を手でのばして、小皿か湯のみを1つ作ります。焼き上げた作品は約1か月後に郵送します。汚れてもよい服装でお越しください。",
            ),
            (
                "ハンドドリップ珈琲の淹れ方講座",
                "food",
                "東京・蔵前",
                7,
                (11, 0),
                90,
                12,
                4,
                "豆の挽き方とお湯の注ぎ方で、味がどう変わるかを飲み比べながら学びます。器具はすべて会場で用意します。",
            ),
            (
                "みなとみらい写真散歩",
                "outdoor",
                "神奈川・横浜",
                8,
                (9, 0),
                180,
                15,
                13,
                "桜木町駅に集合し、港沿いを歩きながら撮影します。スマートフォンでの参加も歓迎です。雨天の場合は前日に中止をお知らせします。",
            ),
            (
                "UIデザインとフロントエンド実装の勉強会",
                "technology",
                "大阪・梅田",
                10,
                (19, 0),
                120,
                30,
                7,
                "デザインデータを画面に落とし込むときの、余白・文字サイズ・状態の扱い方を、実例をもとに話し合います。",
            ),
            (
                "スパイスカレー料理教室",
                "food",
                "東京・中目黒",
                11,
                (18, 30),
                150,
                10,
                2,
                "ホールスパイスの使い方から、チキンカレーと副菜1品を作ります。材料費は参加費に含まれています（このデモでは無料）。",
            ),
            (
                "井の頭公園で読書会",
                "outdoor",
                "東京・吉祥寺",
                12,
                (10, 0),
                120,
                20,
                0,
                "好きな本を1冊持ち寄って、公園の芝生で紹介し合います。レジャーシートは各自でご用意ください。",
            ),
            (
                "活版印刷でグリーティングカードづくり",
                "art",
                "京都・烏丸",
                13,
                (14, 0),
                120,
                6,
                5,
                "活字を組んで、手動の印刷機でカードを3枚刷ります。文字の組み方は当日スタッフが説明します。",
            ),
            (
                "フリーランスエンジニア交流会",
                "community",
                "東京・新宿",
                15,
                (19, 0),
                120,
                50,
                33,
                "案件の探し方や働き方について、少人数のグループに分かれて情報交換します。会社員の方の参加も歓迎です。",
            ),
        ]
        today = timezone.localdate()
        for (
            title,
            category,
            location,
            days,
            (hour, minute),
            minutes,
            capacity,
            reserved,
            summary,
        ) in events:
            starts = timezone.make_aware(
                datetime.combine(today + timedelta(days=days), time(hour, minute))
            )
            event, created = Event.objects.get_or_create(
                title=title,
                organizer=organizer,
                defaults={
                    "description": f"{summary}\n\n当日は開始10分前から受付します。\n\n※ このイベントはポートフォリオ用の架空のデータです。",
                    "category": category,
                    "location": location,
                    "starts_at": starts,
                    "ends_at": starts + timedelta(minutes=minutes),
                    "booking_deadline": starts - timedelta(hours=3),
                    "cancellation_deadline": starts - timedelta(days=1),
                    "capacity": capacity,
                    "status": Event.Status.PUBLISHED,
                },
            )
            if created:
                # 架空の参加者による予約は、1件ずつログに出さない
                service_logger = logging.getLogger("booking.services")
                level = service_logger.level
                service_logger.setLevel(logging.WARNING)
                try:
                    for number in range(1, reserved + 1):
                        reserve(event.pk, self.demo_guest(number))
                finally:
                    service_logger.setLevel(level)
        self.stdout.write(
            self.style.SUCCESS("Sample events are ready. Accounts: organizer / visitor")
        )
        if not os.getenv("DEMO_PASSWORD"):
            self.stdout.write(
                "New demo accounts use this one-time generated password: " + password
            )

    @staticmethod
    def demo_guest(number):
        """残席の表示を確認するための架空の参加者（ログインはできない）"""
        user, created = User.objects.get_or_create(
            username=f"demo_guest_{number:02d}",
            defaults={"display_name": f"参加者{number:02d}"},
        )
        if created:
            user.set_unusable_password()
            user.save()
        return user
