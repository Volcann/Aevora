from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from volcanai.ai_chat.services.jarvis import generate_speech


@login_required
def jarvis_view(request):
    audio_data = None
    text = ""
    voice = "en-US-AriaNeural"

    if request.method == "POST":
        text = request.POST.get("text_input", "").strip()
        voice = request.POST.get("voice", "en-US-AriaNeural")

        if text:
            audio_data = generate_speech(text, voice)

    return render(
        request,
        "ai_chat/jarvis.html",
        {
            "audio_data": audio_data,
            "text": text,
            "voice": voice,
        },
    )
