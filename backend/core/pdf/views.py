"""The weekly program PDF: the coach downloads it or sends it into the athlete's chat; the athlete downloads
their own (the app opens a short-lived signed link, since a browser download can't carry the token)."""

from django.core import signing
from django.core.files.base import ContentFile
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import Athlete
from core.permissions import IsAthlete, IsCoach

from .program import filename, render_pdf

LINK_SALT = "program-pdf"
LINK_MAX_AGE = 10 * 60


def pdf_response(athlete, inline: bool = False) -> HttpResponse:
    r = HttpResponse(render_pdf(athlete), content_type="application/pdf")
    r["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{filename(athlete)}"'
    r["Cache-Control"] = "no-store"
    return r


class CoachProgramPdfView(APIView):
    """`GET athletes/{id}/program.pdf`: this week's training, nutrition, supplements and recovery."""

    permission_classes = [IsCoach]

    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, pk):
        return pdf_response(get_object_or_404(Athlete, pk=pk, coach=request.user.coach))


class SendProgramPdfView(APIView):
    """`POST athletes/{id}/program-pdf/send/`: attach the PDF to a coach message in the athlete's chat."""

    permission_classes = [IsCoach]

    def post(self, request, pk):
        from messaging import push, realtime
        from messaging.models import Message
        from messaging.views import MessageSerializer

        athlete = get_object_or_404(Athlete, pk=pk, coach=request.user.coach)
        msg = Message(athlete=athlete, sender="coach", sender_user=request.user, text="برنامه هفتگی شما (PDF)")
        msg.attachment.save(f"program-{timezone.localdate():%Y-%m-%d}.pdf", ContentFile(render_pdf(athlete)), save=False)
        msg.save()
        data = MessageSerializer(msg, context={"request": request}).data
        realtime.send_to_users(realtime.thread_users(athlete), {"type": "chat.message", "message": dict(data)})
        if not athlete.coach.in_quiet_hours():
            push.notify([athlete.user_id], athlete.coach.user.name, msg.preview, {"type": "message", "athleteId": athlete.pk, "messageId": msg.pk})
        return Response(data, status=201)


class MyProgramPdfView(APIView):
    """`GET me/program.pdf`: the athlete's own program (with the auth header)."""

    permission_classes = [IsAthlete]

    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request):
        return pdf_response(request.user.athlete)


class MyProgramLinkView(APIView):
    """`POST me/program-link/` → `{url}`: a link to the athlete's PDF that works without a token for 10 minutes."""

    permission_classes = [IsAthlete]

    def post(self, request):
        token = signing.TimestampSigner(salt=LINK_SALT).sign(str(request.user.athlete.pk))
        return Response({"url": request.build_absolute_uri(reverse("program-pdf-link", args=[token])), "expires_in": LINK_MAX_AGE})


class SignedProgramPdfView(APIView):
    """`GET program-pdf/{token}/`: the PDF behind a signed link from `me/program-link/`."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, token):
        try:
            pk = signing.TimestampSigner(salt=LINK_SALT).unsign(token, max_age=LINK_MAX_AGE)
        except signing.BadSignature:
            raise Http404 from None
        return pdf_response(get_object_or_404(Athlete, pk=pk), inline=True)
