"""Django settings for the indow API. Everything environment-specific comes from env vars (see .env.example)."""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal `.env` loader (KEY=VALUE lines); real env vars win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / ".env")


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    return env(key, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    return [x.strip() for x in env(key, default).split(",") if x.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me-in-production" if DEBUG else "")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false")
# Development accepts any host so a phone on the LAN can reach `runserver 0.0.0.0:8000` by your
# computer's IP; production must list its domains.
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "*" if DEBUG else "localhost,127.0.0.1")
# Origins allowed to post forms with a CSRF cookie (Django admin at /django-admin/ behind https).
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "daphne",  # `runserver` serves HTTP + WebSockets (ASGI)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "channels",
    "core",
    "accounts",
    "coaching",
    "training",
    "tracking",
    "messaging",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Realtime (chat over WebSockets). Redis is required when running more than one server process.
REDIS_URL = env("REDIS_URL")
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": {"hosts": [REDIS_URL]}}
    if REDIS_URL
    else {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}

# Push notifications to the athlete app (messaging/push.py): expo · pushe · webhook · log · off.
# Optional — the app also shows every notification in-app. Development logs them instead of sending;
# EXPO_PUSH_ENABLED=false (older setting) still turns push off.
EXPO_PUSH_ENABLED = env_bool("EXPO_PUSH_ENABLED", True)
PUSH_BACKEND = env("PUSH_BACKEND", ("log" if DEBUG else "expo") if EXPO_PUSH_ENABLED else "off")
EXPO_ACCESS_TOKEN = env("EXPO_ACCESS_TOKEN")
PUSH_WEBHOOK_URL = env("PUSH_WEBHOOK_URL")
PUSH_WEBHOOK_SECRET = env("PUSH_WEBHOOK_SECRET")
# Web Push (browsers, the athlete app installed on an iPhone's home screen): VAPID keys from
# `python manage.py webpush_keys`. Works next to PUSH_BACKEND, which is for the phone apps.
WEBPUSH_PUBLIC_KEY = env("WEBPUSH_PUBLIC_KEY")
WEBPUSH_PRIVATE_KEY = env("WEBPUSH_PRIVATE_KEY")
WEBPUSH_SUBJECT = env("WEBPUSH_SUBJECT", "mailto:support@indow.ir")
# PUSH_BACKEND=pushe: the API token (pushe.co console → account → API token) and the app's id.
PUSHE_API_TOKEN = env("PUSHE_API_TOKEN")
PUSHE_APP_ID = env("PUSHE_APP_ID")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {"default": dj_database_url.parse(env("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"), conn_max_age=60)}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
]

LANGUAGE_CODE = "fa"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- API ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.EpochJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.Pagination",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # The web and mobile apps speak camelCase (see apps/web/src/data/types.ts).
    "DEFAULT_RENDERER_CLASSES": ["djangorestframework_camel_case.render.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
        "djangorestframework_camel_case.parser.CamelCaseFormParser",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.exception_handler",
    "DEFAULT_THROTTLE_RATES": {"auth": "20/min"},
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("ACCESS_TOKEN_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(env("REFRESH_TOKEN_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "TOKEN_REFRESH_SERIALIZER": "accounts.serializers.EpochTokenRefreshSerializer",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "indow API",
    "DESCRIPTION": "Backend for the indow white-label coaching platform (Admin · Coach · Athlete).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields",
        "drf_spectacular.hooks.postprocess_schema_enums",
    ],
    "ENUM_NAME_OVERRIDES": {
        "AccountStatusEnum": "coaching.models.AccountStatus",
        "UserRoleEnum": "accounts.models.User.Role",
        "AdminRoleEnum": "accounts.models.User.AdminRole",
        "WorkoutStatusEnum": "training.models.WorkoutLog.Status",
        "MealStatusEnum": "tracking.models.MealLog.Status",
        "ProgramKindEnum": "training.models.Program.Kind",
        "CoachDocumentKindEnum": "coaching.models.CoachDocument.Kind",
        "InviteKindEnum": "accounts.models.Invite.Kind",
        "StatusChangeEnum": [("active", "active"), ("inactive", "inactive"), ("paused", "paused")],
        "ReminderDaysEnum": [(1, "1"), (2, "2"), (3, "3"), (7, "7")],
        "WeekdayEnum": "training.models.WEEKDAYS",
    },
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081")
# Our apps name themselves in X-Client (panel / app-android / app-ios / app-web) for the device list.
CORS_ALLOW_HEADERS = (*default_headers, "x-client")

# --- Links & email ---
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "indow <no-reply@indow.ir>")
# Shown on the admin dashboard (A02 › پلتفرم).
PLATFORM_VERSION = env("PLATFORM_VERSION", "indow 2.4.0")
PLATFORM_REGION = env("PLATFORM_REGION", "اروپا (فرانکفورت)")
SUPPORT_EMAIL = env("SUPPORT_EMAIL", "support@indow.ir")
# Real email needs SMTP (without EMAIL_HOST, emails are only printed on the runserver console).
# Gmail: EMAIL_HOST=smtp.gmail.com, EMAIL_HOST_USER=<address>, EMAIL_HOST_PASSWORD=<16-char app password>.
if env("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")
    EMAIL_HOST_USER = env("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD").replace(" ", "")  # Gmail shows app passwords in groups of 4
    EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", env("EMAIL_PORT") == "465")
    EMAIL_USE_TLS = not EMAIL_USE_SSL and env_bool("EMAIL_USE_TLS", True)
    EMAIL_PORT = int(env("EMAIL_PORT", "465" if EMAIL_USE_SSL else "587"))
    EMAIL_TIMEOUT = int(env("EMAIL_TIMEOUT", "20"))
    # Gmail and most providers reject (or rewrite) a From address the account doesn't own.
    if EMAIL_HOST_USER and not env("DEFAULT_FROM_EMAIL"):
        DEFAULT_FROM_EMAIL = f"indow <{EMAIL_HOST_USER}>"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"baseline.email": {"handlers": ["console"], "level": "INFO"}},
}

# --- File storage ---
# Local `media/` by default. Set S3_BUCKET to store uploads in any S3-compatible object storage
# (AWS S3, Cloudflare R2, MinIO, ArvanCloud, …). Files are private and served through signed URLs
# unless S3_PUBLIC=true (e.g. behind a CDN set with S3_CUSTOM_DOMAIN).
S3_BUCKET = env("S3_BUCKET")
if S3_BUCKET:
    _public = env_bool("S3_PUBLIC", False)
    _s3 = {
        "bucket_name": S3_BUCKET,
        "endpoint_url": env("S3_ENDPOINT_URL") or None,
        "region_name": env("S3_REGION") or None,
        "access_key": env("S3_ACCESS_KEY_ID") or None,
        "secret_key": env("S3_SECRET_ACCESS_KEY") or None,
        "custom_domain": env("S3_CUSTOM_DOMAIN") or None,
        "location": env("S3_PREFIX", "media"),
        "default_acl": "public-read" if _public else None,
        "querystring_auth": not _public,
        "querystring_expire": int(env("S3_URL_EXPIRE_SECONDS", "3600")),
        "file_overwrite": False,
        "addressing_style": env("S3_ADDRESSING_STYLE") or None,
        "signature_version": "s3v4",
    }
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {k: v for k, v in _s3.items() if v is not None}},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

# Upload limits from the design (logo ≤ 2 MB; photos ≤ 5 MB; exercise videos ≤ 200 MB).
MAX_LOGO_BYTES = 2 * 1024 * 1024
# Photos are downscaled on save (core.uploads.shrink_image), so large phone photos are fine.
MAX_PHOTO_BYTES = 20 * 1024 * 1024
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
MAX_VIDEO_BYTES = 200 * 1024 * 1024
# Standard exercise library pictures (#48): illustrations from RepDB's free tier, fetched when the
# library is installed (credit "Exercise data by RepDB (repdb.co)" is shown in the app). Off → photos.
EXERCISE_ILLUSTRATIONS = env_bool("EXERCISE_ILLUSTRATIONS", True)
EXERCISE_ILLUSTRATION_URL = env("EXERCISE_ILLUSTRATION_URL", "https://raw.githubusercontent.com/RepDB/exercise-dataset/main/images/flat/{id}-{pose}.webp")
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # Behind a TLS-terminating proxy that already redirects, leave these at their defaults.
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
    SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "0"))
