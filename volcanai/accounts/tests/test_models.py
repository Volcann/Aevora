import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_user_creation_with_valid_attributes(self):
        user = User.objects.create_user(
            username="modeluser",
            email="modeluser@example.com",
            password="Password123!",
            first_name="Model",
            last_name="User",
        )

        assert user.pk is not None
        assert isinstance(user.id, uuid.UUID)
        assert user.email == "modeluser@example.com"
        assert user.username == "modeluser"
        assert user.first_name == "Model"
        assert user.last_name == "User"
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.theme_config == {}
        assert user.created_at is not None
        assert user.updated_at is not None
        assert str(user) == "modeluser@example.com"

    def test_user_str_fallback_to_username_when_email_empty(self):
        user = User(username="nomailuser", email="")
        assert str(user) == "nomailuser"

    def test_create_superuser_sets_correct_flags(self):
        superuser = User.objects.create_superuser(
            username="adminuser",
            email="admin@example.com",
            password="AdminPassword123!",
        )

        assert superuser.is_staff is True
        assert superuser.is_superuser is True
        assert superuser.is_active is True

    def test_create_superuser_fails_without_staff_flag(self):
        with pytest.raises(ValueError):
            User.objects.create_superuser(
                username="fakeadmin",
                email="fakeadmin@example.com",
                password="AdminPassword123!",
                is_staff=False,
            )

    def test_create_superuser_fails_without_superuser_flag(self):
        with pytest.raises(ValueError):
            User.objects.create_superuser(
                username="fakeadmin2",
                email="fakeadmin2@example.com",
                password="AdminPassword123!",
                is_superuser=False,
            )

    def test_duplicate_email_raises_integrity_error(self):
        User.objects.create_user(
            username="user_one",
            email="duplicate@example.com",
            password="Password123!",
        )

        with pytest.raises(IntegrityError):
            User.objects.create_user(
                username="user_two",
                email="duplicate@example.com",
                password="Password123!",
            )

    def test_theme_config_persists_json_data(self):
        user = User.objects.create_user(
            username="themeuser",
            email="themeuser@example.com",
            password="Password123!",
            theme_config={"mode": "dark", "fontSize": 14},
        )

        user.refresh_from_db()
        assert user.theme_config["mode"] == "dark"
        assert user.theme_config["fontSize"] == 14
