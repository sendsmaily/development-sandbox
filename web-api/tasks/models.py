import uuid

from django.db import models


class Task(models.Model):

    """Todo task representation.
    """

    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4)
    body = models.TextField()
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
