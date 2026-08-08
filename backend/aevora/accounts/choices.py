from enum import StrEnum


class TokenPurpose(StrEnum):
    ONBOARDING = "set_initial_password"
    RESET_PASSWORD = "reset_password"
