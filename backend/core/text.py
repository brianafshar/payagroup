FA_DIGITS = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")


def fa_digits(value) -> str:
    """Persian digits with `٫` as the decimal separator (for emails; the apps format on their side)."""
    return str(value).translate(FA_DIGITS)
