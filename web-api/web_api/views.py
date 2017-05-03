from collections import OrderedDict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.reverse import reverse


class RootView(APIView):

    """API root view.
    """

    def get(self, request, *args, **kwargs):
        # Render API schema.
        rendered_api_schema = OrderedDict((
            ('tasks_url', reverse('task-list', request=request), ),
        ))

        # Return response.
        return Response(rendered_api_schema)
