from django.contrib.auth import authenticate, login, logout
from django.db import connection, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .models import Event, Reservation
from .serializers import (
    AttendeeSerializer,
    EventSerializer,
    LoginSerializer,
    RegisterSerializer,
    ReservationSerializer,
    SessionSerializer,
    UserSerializer,
)
from .services import cancel, reserve


@extend_schema(responses=SessionSerializer)
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def session(request):
    return Response(
        {
            "user": UserSerializer(request.user).data
            if request.user.is_authenticated
            else None,
            "csrf_token": get_token(request),
        }
    )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=LoginSerializer, responses=UserSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            raise ValidationError({"detail": "ユーザー名またはパスワードが違います。"})
        login(request, user)
        return Response(UserSerializer(user).data)


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=RegisterSerializer, responses=UserSerializer)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=204)


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "q", str, description="タイトル・説明・場所の部分一致検索"
            ),
            OpenApiParameter(
                "category", str, enum=[choice.value for choice in Event.Category]
            ),
            OpenApiParameter("location", str, description="開催場所の部分一致検索"),
            OpenApiParameter(
                "available",
                bool,
                description="trueの場合、予約受付中で空席のあるイベントのみ",
            ),
        ]
    )
)
class EventViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = EventSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        visible = (
            [Event.Status.PUBLISHED, Event.Status.CANCELLED]
            if self.action == "retrieve"
            else [Event.Status.PUBLISHED]
        )
        queryset = Event.objects.select_related("organizer").filter(status__in=visible)
        if self.action == "list":
            queryset = queryset.filter(ends_at__gt=timezone.now())
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(location__icontains=query)
            )
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        location = self.request.query_params.get("location", "").strip()
        if location:
            queryset = queryset.filter(location__icontains=location)
        if self.request.query_params.get("available") == "true":
            from django.db.models import F

            queryset = queryset.filter(
                reserved_count__lt=F("capacity"), booking_deadline__gt=timezone.now()
            )
        return queryset

    @extend_schema(request=None, responses=ReservationSerializer)
    @action(
        detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated]
    )
    def reserve(self, request, pk=None):
        reservation = reserve(pk, request.user)
        return Response(ReservationSerializer(reservation).data, status=201)


class MyReservationViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Reservation.objects.none()
        return Reservation.objects.filter(user=self.request.user).select_related(
            "event__organizer"
        )

    @extend_schema(request=None, responses=ReservationSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return Response(ReservationSerializer(cancel(pk, request.user)).data)


class OrganizerEventViewSet(viewsets.ModelViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()
        return Event.objects.filter(organizer=self.request.user).select_related(
            "organizer"
        )

    def perform_create(self, serializer):
        if not self.request.user.is_organizer:
            raise PermissionDenied("主催者アカウントが必要です。")
        serializer.save(organizer=self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # The same row lock as reservation creation protects capacity edits.
        partial = kwargs.pop("partial", False)
        instance = get_object_or_404(
            self.get_queryset().select_for_update(), pk=kwargs["pk"]
        )
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(responses=AttendeeSerializer(many=True))
    @action(detail=True, methods=["get"])
    def attendees(self, request, pk=None):
        event = self.get_object()
        reservations = event.reservations.select_related("user").all()
        page = self.paginate_queryset(reservations)
        return self.get_paginated_response(AttendeeSerializer(page, many=True).data)


def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})
