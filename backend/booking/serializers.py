from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from .models import Event, Reservation

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name", "is_organizer"]


class SessionSerializer(serializers.Serializer):
    user = UserSerializer(allow_null=True)
    csrf_token = serializers.CharField()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["username", "display_name", "password", "is_organizer"]

    def validate(self, attrs):
        try:
            validate_password(
                attrs["password"],
                User(username=attrs["username"], display_name=attrs["display_name"]),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class EventSerializer(serializers.ModelSerializer):
    organizer_name = serializers.CharField(
        source="organizer.display_name", read_only=True
    )
    remaining = serializers.SerializerMethodField()
    can_book = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "category",
            "location",
            "starts_at",
            "ends_at",
            "booking_deadline",
            "cancellation_deadline",
            "capacity",
            "reserved_count",
            "remaining",
            "can_book",
            "status",
            "organizer_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reserved_count", "created_at", "updated_at"]

    def get_remaining(self, obj) -> int:
        return obj.capacity - obj.reserved_count

    def get_can_book(self, obj) -> bool:
        return (
            obj.status == Event.Status.PUBLISHED
            and obj.booking_deadline > timezone.now()
            and obj.reserved_count < obj.capacity
        )

    def validate(self, attrs):
        current = self.instance

        def value(key):
            return attrs.get(key, getattr(current, key, None))

        start, end = value("starts_at"), value("ends_at")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"ends_at": "終了日時は開始日時より後にしてください。"}
            )
        for field in ["booking_deadline", "cancellation_deadline"]:
            if value(field) and start and value(field) > start:
                raise serializers.ValidationError(
                    {field: "期限はイベント開始以前にしてください。"}
                )
        if value("capacity") is not None and not 1 <= value("capacity") <= 10000:
            raise serializers.ValidationError(
                {"capacity": "定員は1〜10000人にしてください。"}
            )
        if current and value("capacity") < current.reserved_count:
            raise serializers.ValidationError(
                {"capacity": "予約人数より小さい定員には変更できません。"}
            )
        if current and current.reserved_count and value("status") == Event.Status.DRAFT:
            raise serializers.ValidationError(
                {"status": "予約のあるイベントを下書きには戻せません。"}
            )
        if not current and start and start <= timezone.now():
            raise serializers.ValidationError(
                {"starts_at": "開始日時は未来にしてください。"}
            )
        return attrs


class ReservationSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ["id", "event", "status", "created_at", "updated_at", "can_cancel"]
        read_only_fields = fields

    def get_can_cancel(self, obj) -> bool:
        return obj.status == Reservation.Status.ACTIVE and (
            obj.event.status == Event.Status.CANCELLED
            or timezone.now() < obj.event.cancellation_deadline
        )


class AttendeeSerializer(serializers.ModelSerializer):
    participant = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = Reservation
        fields = ["id", "participant", "status", "created_at"]
