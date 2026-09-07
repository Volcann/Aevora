from django.http import JsonResponse


def health_check(request):  # noqa: ARG001
    return JsonResponse({"status": "ok"})
