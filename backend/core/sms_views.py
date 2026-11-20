"""Head-coach SMS settings (Kavenegar key, sender line, message texts) and a test send."""

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from core import notify, sms
from core.models import DEFAULT_ACCOUNT_SMS, DEFAULT_PROGRAM_SMS, SmsSettings
from core.permissions import IsCoach


def _guard(request):
    """Only the head coach (or a coach without a head, i.e. the account owner) manages the SMS setup."""
    c = request.user.coach
    if c.gym_head.pk != c.pk:
        raise PermissionDenied("Only the head coach can change SMS settings.")


def _out() -> dict:
    row = SmsSettings.load()
    key, sender = sms.credentials()
    return {
        "key_set": bool(key),
        "key_hint": key[-4:] if key else "",
        "key_from_app": bool(row.api_key.strip()),
        "sender": row.sender,
        "account_text": row.account_text,
        "program_text": row.program_text,
        "site_configured": bool(settings.SITE_API_URL),
        "placeholders": ["name", "brand", "link"],
    }


class SmsSettingsView(APIView):
    """`GET/PUT sms-settings/`. `api_key` is write-only (the response only says whether one is set and its last 4
    characters); an empty `api_key` on PUT keeps the saved one, `clear_key: true` removes it."""

    permission_classes = [IsCoach]

    class Input(serializers.Serializer):
        api_key = serializers.CharField(max_length=200, required=False, allow_blank=True)
        clear_key = serializers.BooleanField(required=False)
        sender = serializers.CharField(max_length=32, required=False, allow_blank=True)
        account_text = serializers.CharField(max_length=500, required=False, allow_blank=True)
        program_text = serializers.CharField(max_length=500, required=False, allow_blank=True)

        def validate_program_text(self, v):
            if v.strip() and "{link}" not in v:
                raise serializers.ValidationError("The program text must contain {link}.")
            return v

    @extend_schema(responses=dict)
    def get(self, request):
        return Response(_out())

    @extend_schema(request=Input, responses=dict)
    def put(self, request):
        _guard(request)
        s = self.Input(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        row = SmsSettings.load()
        if d.get("clear_key"):
            row.api_key = ""
        elif d.get("api_key", "").strip():
            row.api_key = d["api_key"].strip()
        if "sender" in d:
            row.sender = d["sender"].strip()
        if "account_text" in d:
            row.account_text = d["account_text"].strip() or DEFAULT_ACCOUNT_SMS
        if "program_text" in d:
            row.program_text = d["program_text"].strip() or DEFAULT_PROGRAM_SMS
        row.save()
        return Response(_out())


class SmsTestView(APIView):
    """`POST sms-settings/test/` `{phone}`: send a test message with the saved setup."""

    permission_classes = [IsCoach]

    class Input(serializers.Serializer):
        phone = serializers.RegexField(r"^09\d{9}$")

    @extend_schema(request=Input, responses=dict)
    def post(self, request):
        _guard(request)
        s = self.Input(data=request.data)
        s.is_valid(raise_exception=True)
        text = notify.render_text(SmsSettings.load().account_text, name="آزمایشی", brand=notify.brand_of_coach(request.user.coach))
        detail: list = []
        status = notify._send(s.validated_data["phone"], text, detail)
        return Response({"status": status, "detail": detail[0] if detail else ""})
