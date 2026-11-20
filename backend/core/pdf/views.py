"""The weekly program PDF: the coach downloads it or sends it into the athlete's chat; the athlete downloads
their own (the app opens a short-lived signed link, since a browser download can't carry the token)."""

import secrets

from django.core import signing
from django.core.files.base import ContentFile
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import AccountStatus, Athlete, ProgramShare
from core import notify, site, sms
from core.models import SmsSettings
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
        return pdf_response(get_object_or_404(Athlete, pk=pk, coach__in=request.user.coach.athlete_scope_ids()))


class SendProgramPdfView(APIView):
    """`POST athletes/{id}/program-pdf/send/`: attach the PDF to a coach message in the athlete's chat."""

    permission_classes = [IsCoach]

    def post(self, request, pk):
        from messaging import push, realtime
        from messaging.models import Message
        from messaging.views import MessageSerializer

        athlete = get_object_or_404(Athlete, pk=pk, coach__in=request.user.coach.athlete_scope_ids())
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


class SendProgramSmsView(APIView):
    """`POST program-pdf/send-sms/` `{athlete?, name, phone}`: publish the athlete's PDF to the site and SMS them
    the link. A new name + phone is saved as a contact (once); an existing contact is found by `athlete` or phone."""

    permission_classes = [IsCoach]

    class Input(serializers.Serializer):
        athlete = serializers.IntegerField(required=False)
        name = serializers.CharField(max_length=120, required=False, allow_blank=True)
        phone = serializers.CharField(max_length=20)

        def validate_phone(self, value):
            digits = value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")).replace(" ", "")
            if not (len(digits) == 11 and digits.startswith("09") and digits.isdigit()):
                raise serializers.ValidationError("Use the 09xxxxxxxxx format.")
            return digits

    @extend_schema(request=Input, responses={201: dict})
    def post(self, request):
        s = self.Input(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        coach = request.user.coach
        scope = coach.athlete_scope_ids()
        athlete = Athlete.objects.filter(coach__in=scope, pk=d["athlete"]).first() if d.get("athlete") else None
        if d.get("athlete") and athlete is None:
            raise ValidationError({"athlete": "Unknown athlete."})
        if athlete is None:
            athlete = Athlete.objects.filter(coach__in=scope, phone=d["phone"]).first()
        if athlete is None:
            if not d.get("name"):
                raise ValidationError({"name": "Name is required for a new contact."})
            athlete = Athlete.objects.create(coach=coach, name=d["name"], phone=d["phone"], status=AccountStatus.ACTIVE)
        elif athlete.phone != d["phone"] or (d.get("name") and athlete.name != d["name"]):
            athlete.phone = d["phone"]
            athlete.name = d.get("name") or athlete.name
            athlete.save(update_fields=["phone", "name"])

        token = secrets.token_urlsafe(24)
        data = render_pdf(athlete)
        try:
            url = site.publish_pdf(token=token, filename=filename(athlete), data=data, base_url=request.build_absolute_uri("/"))
        except site.SiteError:
            return Response({"code": "site_failed", "detail": "Could not publish the PDF to the site."}, status=502)
        share = ProgramShare(athlete=athlete, sent_by=request.user, token=token, url=url)
        share.pdf.save(f"{token}.pdf", ContentFile(data), save=False)
        text = notify.render_text(SmsSettings.load().program_text, name=athlete.name, brand=notify.brand_of(athlete), link=url)
        try:
            sms.send_sms(athlete.phone, text)
        except sms.SmsNotConfigured:
            share.save()
            return Response({"code": "sms_not_configured", "detail": "SMS is not configured (Kavenegar API key).", "url": url}, status=503)
        except sms.SmsError:
            share.save()
            return Response({"code": "sms_failed", "detail": "The SMS could not be sent.", "url": url}, status=502)
        share.sms_sent = True
        share.save()
        return Response({"athlete_id": athlete.pk, "url": url, "sms_sent": True}, status=201)


class SharedPdfView(APIView):
    """`GET shared-pdf/{token}/`: the PDF behind an SMS link when the site API isn't used."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, token):
        share = get_object_or_404(ProgramShare, token=token)
        r = HttpResponse(share.pdf.read(), content_type="application/pdf")
        r["Content-Disposition"] = f'inline; filename="{filename(share.athlete)}"'
        return r
