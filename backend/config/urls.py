from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from booking import views

router = DefaultRouter()
router.register("events", views.EventViewSet, basename="events")
router.register("reservations", views.MyReservationViewSet, basename="reservations")
router.register(
    "organizer/events", views.OrganizerEventViewSet, basename="organizer-events"
)
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/auth/session/", views.session),
    path("api/auth/login/", views.LoginView.as_view()),
    path("api/auth/register/", views.RegisterView.as_view()),
    path("api/auth/logout/", views.LogoutView.as_view()),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/health/", views.health),
]
