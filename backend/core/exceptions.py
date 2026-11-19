from rest_framework.views import exception_handler as drf_exception_handler


def _flatten(codes):
    if isinstance(codes, str):
        yield codes
    elif isinstance(codes, dict):
        for v in codes.values():
            yield from _flatten(v)
    elif isinstance(codes, list):
        for v in codes:
            yield from _flatten(v)


def exception_handler(exc, context):
    """DRF errors plus a stable top-level `code` the clients can switch on (mirrors `ApiError.code` in the
    web app): the error's own code when there is exactly one, otherwise `invalid`."""
    response = drf_exception_handler(exc, context)
    if response is None or not isinstance(response.data, dict) or "code" in response.data:
        return response
    codes = set(_flatten(getattr(exc, "get_codes", lambda: None)()))
    response.data["code"] = codes.pop() if len(codes) == 1 else "invalid"
    return response
