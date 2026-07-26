import jwt
from django.conf import settings

ONBOARDING_PURPOSE = "onboarding"


class TokenService:
    @staticmethod
    def decode_token(token, expected_purpose=None):
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            if expected_purpose and payload.get("purpose") != expected_purpose:
                return None, "Invalid token purpose"
            return payload, None
        except jwt.PyJWTError as e:
            return None, str(e)
