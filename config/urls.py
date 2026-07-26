from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from volcanai.core.views import health_check

urlpatterns = [
    path("", RedirectView.as_view(pattern_name="accounts:login", permanent=False)),
    path("accounts/", include("volcanai.accounts.api.v1.urls")),
    path("dashboard/", include("volcanai.dashboard.urls")),
    path("health/", health_check, name="health-check"),
    path("api/admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
