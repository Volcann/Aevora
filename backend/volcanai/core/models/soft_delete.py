from django.db import models
from django.utils import timezone

from volcanai.core.models.base import TimeStampedModel, UUIDTimeStampedModel


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        return super().update(
            is_deleted=True,
            deleted_at=timezone.now(),
        )

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):  # noqa: FBT002
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(using=using, update_fields=["is_deleted", "deleted_at"])
        return (1, {self._meta.label: 1})


class TimeStampedSoftDeleteModel(TimeStampedModel, SoftDeleteModel):
    class Meta:
        abstract = True


class UUIDTimeStampedSoftDeleteModel(UUIDTimeStampedModel, SoftDeleteModel):
    class Meta:
        abstract = True
