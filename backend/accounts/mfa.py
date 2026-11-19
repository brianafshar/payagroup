"""TOTP two-factor authentication: authenticator-app codes (30 s steps, ±1 step drift) and one-time
recovery codes. Codes can't be replayed; recovery codes are stored hashed."""

import hashlib
import secrets
from datetime import UTC, datetime

import pyotp
from django.core import signing

ISSUER = "indow"
MFA_TOKEN_SALT = "accounts.mfa-login"
MFA_TOKEN_MAX_AGE = 300  # seconds to enter the code after the password step
RECOVERY_CODE_COUNT = 10

_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _normalize(code: str) -> str:
    return "".join((code or "").translate(_FA_DIGITS).split()).replace("-", "").lower()


def _hash(code: str) -> str:
    return hashlib.sha256(_normalize(code).encode()).hexdigest()


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(user, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=user.username, issuer_name=ISSUER)


def verify_totp(user, secret: str, code: str) -> bool:
    """Accepts the current, previous or next step, never a step at or before the last one used."""
    code = _normalize(code)
    if not secret or len(code) != 6 or not code.isdigit():
        return False
    totp = pyotp.TOTP(secret)
    current = totp.timecode(datetime.now(UTC))
    for step in (current - 1, current, current + 1):
        if secrets.compare_digest(totp.generate_otp(step), code):
            if user.totp_last_step is not None and step <= user.totp_last_step:
                return False
            user.totp_last_step = step
            user.save(update_fields=["totp_last_step"])
            return True
    return False


def new_recovery_codes() -> tuple[list[str], list[str]]:
    """Returns `(codes to show once, hashes to store)`. Codes look like `a1b2-c3d4`."""
    plain = [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}" for _ in range(RECOVERY_CODE_COUNT)]
    return plain, [_hash(c) for c in plain]


def use_recovery_code(user, code: str) -> bool:
    h = _hash(code)
    if h not in (user.recovery_codes or []):
        return False
    user.recovery_codes = [x for x in user.recovery_codes if x != h]
    user.save(update_fields=["recovery_codes"])
    return True


def verify_code(user, code: str) -> bool:
    """A code from the authenticator app, or one of the recovery codes."""
    return verify_totp(user, user.totp_secret, code) or use_recovery_code(user, code)


def login_token(user) -> str:
    """Short-lived proof that the password step passed; exchanged for JWTs with a valid code."""
    return signing.dumps({"u": user.pk, "e": user.session_epoch}, salt=MFA_TOKEN_SALT)


def user_from_login_token(token: str):
    from .models import User

    try:
        data = signing.loads(token, salt=MFA_TOKEN_SALT, max_age=MFA_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    user = User.objects.filter(pk=data.get("u"), is_active=True).first()
    if user is None or user.session_epoch != data.get("e") or not user.two_factor:
        return None
    return user
