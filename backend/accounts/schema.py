from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class EpochJWTScheme(SimpleJWTScheme):
    """Documents `EpochJWTAuthentication` as a bearer JWT in the OpenAPI schema."""

    target_class = "accounts.authentication.EpochJWTAuthentication"
    name = "jwtAuth"
