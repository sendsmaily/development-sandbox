from django.conf import settings
from django.conf.urls import (
    include,
    url)

from rest_framework import routers

from web_api.views import RootView
from tasks.views import TaskViewSet


router = routers.SimpleRouter(trailing_slash=settings.APPEND_SLASH)
router.register(r'tasks', TaskViewSet, base_name='task')

urlpatterns = [
    url(r'^$', RootView.as_view()),
    url(r'^', include(router.urls)),
]
