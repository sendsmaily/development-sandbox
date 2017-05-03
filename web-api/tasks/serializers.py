from rest_framework.serializers import HyperlinkedModelSerializer

from tasks.models import Task


class TaskSerializer(HyperlinkedModelSerializer):

    """Hyperlinked task serializer.
    """

    class Meta:
        model = Task
        fields = ('url', 'uuid', 'body', 'is_done', 'created_at', )
