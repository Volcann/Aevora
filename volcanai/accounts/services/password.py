from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

User = get_user_model()


class PasswordService:
    @staticmethod
    def change_password(user, old_password, new_password):
        if not user.check_password(old_password):
            raise ValueError("Invalid old password.")
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return {"message": "Password changed successfully."}

    @staticmethod
    def forgot_password(user):
        token = default_token_generator.make_token(user)
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        return {"uidb64": uidb64, "token": token}

    @staticmethod
    def reset_password(uidb64, token, password):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValueError("Invalid reset link.")

        if not default_token_generator.check_token(user, token):
            raise ValueError("Invalid or expired token.")

        user.set_password(password)
        user.save(update_fields=["password"])
        return {"message": "Password reset successfully."}
