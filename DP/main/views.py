from django.shortcuts import render
import pandas as pd
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from .models import *
from .serializers import *

import io
import os
import zipfile
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from .serializers import GenerateRequestSerializer
from django.views.decorators.csrf import ensure_csrf_cookie

# Импорти за PDF обработка
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pypdf import PdfReader, PdfWriter

@ensure_csrf_cookie
def index(request):
    return render(request, 'main/index.html')

@ensure_csrf_cookie
def index_old(request):
    return render(request, 'main/index_old.html')


class TemplateListAPIView(generics.ListAPIView):
    """
    Връща списък с всички налични шаблони за сертификати.
    GET /api/templates/
    """
    queryset = CertificateTemplate.objects.all()
    serializer_class = TemplateSerializer


class UploadParticipantsAPIView(APIView):
    """
    Приема файл (.xlsx, .csv, .txt) и връща масив с данни (JSON) към фронтенда за валидация.
    POST /api/upload-participants/
    """

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({"error": "Моля, прикачете файл."}, status=status.HTTP_400_BAD_REQUEST)

        file_name = file_obj.name.lower()

        try:
            # Парсване в зависимост от разширението на файла
            if file_name.endswith('.xlsx'):
                df = pd.read_excel(file_obj)
            elif file_name.endswith('.csv'):
                df = pd.read_csv(file_obj)
            elif file_name.endswith('.txt'):
                df = pd.read_csv(file_obj, sep='\t')  # или друг разделител според заданието
            else:
                return Response({"error": "Неподдържан файлов формат."}, status=status.HTTP_400_BAD_REQUEST)

            # Изчистване на празни редове и преобразуване в речник
            df = df.dropna(how='all')
            # Заменяме празни стойности (NaN) с празен стринг за по-лесна обработка във Vue
            df = df.fillna('')

            records = df.to_dict(orient='records')
            return Response({"data": records}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"Грешка при обработка на файла: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateCertificatesAPIView(APIView):
    @staticmethod
    def _format_bg_date(value):
        if value is None:
            return ""

        text = str(value).strip()
        if not text:
            return ""

        patterns = [
            "%d/%m/%Y",
            "%d.%m.%Y",
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
        ]

        for pattern in patterns:
            try:
                dt = datetime.strptime(text, pattern)
                return dt.strftime("%d/%m/%Y г.")
            except ValueError:
                continue

        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return dt.strftime("%d/%m/%Y г.")
        except ValueError:
            return text

    def post(self, request, *args, **kwargs):
        serializer = GenerateRequestSerializer(data=request.data)

        if serializer.is_valid():
            template_id = serializer.validated_data['template_id']
            participants = serializer.validated_data['participants']

            try:
                template_obj = CertificateTemplate.objects.get(id=template_id)
            except CertificateTemplate.DoesNotExist:
                return Response({"error": "Шаблонът не е намерен."}, status=status.HTTP_404_NOT_FOUND)

            font_path = os.path.join(settings.BASE_DIR, 'fonts', 'arial.ttf')
            pdfmetrics.registerFont(TTFont('Arial-Cyrillic', font_path))

            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
                for idx, participant in enumerate(participants):
                    # Четем първо шаблона и взимаме реалните размери на страницата
                    template_pdf = PdfReader(template_obj.file.path)
                    template_page = template_pdf.pages[0]
                    page_width = float(template_page.mediabox.width)
                    page_height = float(template_page.mediabox.height)

                    packet = io.BytesIO()
                    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

                    text_settings = serializer.validated_data.get('text_settings', {})
                    name_conf = text_settings.get('name', {'x': 260, 'y': 90, 'size': 36, 'show': True})
                    course_conf = text_settings.get('course', {'x': 260, 'y': 60, 'size': 18, 'show': True})
                    date_conf = text_settings.get('date', {'x': 260, 'y': 30, 'size': 18, 'show': True})

                    if name_conf.get('show'):
                        c.setFont('Arial-Cyrillic', int(name_conf.get('size', 36)))
                        name_text = participant.get('Име') or participant.get('Name') or f"Участник_{idx + 1}"
                        c.drawCentredString(int(name_conf.get('x')), int(name_conf.get('y')), str(name_text))

                    if course_conf.get('show') and 'Тема' in participant:
                        c.setFont('Arial-Cyrillic', int(course_conf.get('size', 18)))
                        c.drawCentredString(int(course_conf.get('x')), int(course_conf.get('y')), str(participant['Тема']))

                    raw_date = participant.get('Дата') or participant.get('Date')
                    date_text = self._format_bg_date(raw_date)
                    if date_conf.get('show') and date_text:
                        c.setFont('Arial-Cyrillic', int(date_conf.get('size', 18)))
                        c.drawCentredString(int(date_conf.get('x')), int(date_conf.get('y')), date_text)

                    c.save()
                    packet.seek(0)
                    text_pdf = PdfReader(packet)

                    output = PdfWriter()
                    page = template_page
                    page.merge_page(text_pdf.pages[0])
                    output.add_page(page)

                    cert_buffer = io.BytesIO()
                    output.write(cert_buffer)

                    safe_name = str(name_text).replace(" ", "_").replace("/", "-")
                    zip_file.writestr(f"Certificate_{safe_name}.pdf", cert_buffer.getvalue())

            zip_filename = 'generated_certificates.zip'
            fs = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'generated'))

            if fs.exists(zip_filename):
                fs.delete(zip_filename)

            fs.save(zip_filename, zip_buffer)
            download_url = f"{settings.MEDIA_URL}generated/{zip_filename}"

            return Response({
                "message": f"Успешно генерирани {len(participants)} сертификата.",
                "download_url": download_url
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)