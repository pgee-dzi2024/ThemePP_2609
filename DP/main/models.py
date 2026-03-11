from django.db import models

class CertificateTemplate(models.Model):
    name = models.CharField(max_length=255, verbose_name="Име на шаблона")
    file = models.FileField(upload_to='templates/', verbose_name="Файл на шаблона (PDF/Image)")

    # ПОЛЕТА ЗА ГАЛЕРИЯТА:
    preview_image = models.ImageField(upload_to='templates/previews/', null=True, blank=True,
                                      verbose_name="Снимка за галерията (JPG/PNG)")
    description = models.TextField(null=True, blank=True, verbose_name="Кратко описание")

    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
