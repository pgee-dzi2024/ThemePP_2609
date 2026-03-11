from rest_framework import serializers
from .models import CertificateTemplate

class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificateTemplate
        fields = ['id', 'name', 'file', 'preview_image', 'description', 'uploaded_at']

# Този сериализатор ще се ползва само за валидация на заявката за генериране
class GenerateRequestSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    participants = serializers.ListField(
        child=serializers.DictField() # Очакваме списък от обекти (напр. {"name": "Иван", "date": "10.05.2024"})
    )
    text_settings = serializers.DictField(required=False, default=dict)