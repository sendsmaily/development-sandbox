from rest_framework.viewsets import ModelViewSet

from tasks.models import Task
from tasks.serializers import TaskSerializer


class TaskViewSet(ModelViewSet):

    """Task management viewset.
    """

    queryset = Task.objects.all().order_by('created_at')
    serializer_class = TaskSerializer
