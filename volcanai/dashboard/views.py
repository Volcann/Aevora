from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def index(request):
    """Main post-login screen — intentionally minimal (black screen)."""
    return render(request, "dashboard/index.html")
