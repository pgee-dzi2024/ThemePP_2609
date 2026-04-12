from rest_framework import serializers
from .models import CertificateTemplate
from pypdf import PdfReader


class TemplateSerializer(serializers.ModelSerializer):
    pdf_width = serializers.SerializerMethodField()
    pdf_height = serializers.SerializerMethodField()

    class Meta:
        model = CertificateTemplate
        fields = ['id', 'name', 'file', 'preview_image', 'description', 'uploaded_at', 'pdf_width', 'pdf_height']

    def get_pdf_width(self, obj):
        try:
            reader = PdfReader(obj.file.path)
            page = reader.pages[0]
            return float(page.mediabox.width)
        except Exception:
            return 842.0  # fallback A4 landscape width

    def get_pdf_height(self, obj):
        try:
            reader = PdfReader(obj.file.path)
            page = reader.pages[0]
            return float(page.mediabox.height)
        except Exception:
            return 595.0  # fallback A4 landscape height


class GenerateRequestSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    participants = serializers.ListField(
        child=serializers.DictField()
    )
    text_settings = serializers.DictField(required=False, default=dict)