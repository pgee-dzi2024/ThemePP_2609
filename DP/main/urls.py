from django.urls import path
from .views import *

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', index, name='home'),
    path('old', index_old, name='home_old'),
    path('api/templates/', TemplateListAPIView.as_view(), name='api_templates'),
    path('api/upload-participants/', UploadParticipantsAPIView.as_view(), name='api_upload_participants'),
    path('api/generate/', GenerateCertificatesAPIView.as_view(), name='api_generate_certificates'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
