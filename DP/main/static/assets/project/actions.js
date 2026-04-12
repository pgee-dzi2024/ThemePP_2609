const App = {
    delimiters: ['[[', ']]'], // Променяме синтаксиса на [[ ]] заради Django шаблоните
    data() {
        return {
            showMode: 'home',

            // Данни за файлове и участници
            selectedFile: null,
            participants: [],

            // Данни за шаблоните
            templates: [],
            selectedTemplate: null,

            // Състояния и съобщения
            isLoading: false,
            errorMessage: '',
            successMessage: '',
            downloadUrl: '',

            // Настройки за позициониране на текста
            textSettings: {
                name: {x: 260, y: 90, size: 36, show: true},
                course: {x: 260, y: 60, size: 18, show: true},
                date: {x: 260, y: 30, size: 18, show: true}
            },

            // Preview мета-данни (A4 landscape в точки за PDF координатите)
            previewPdfWidth: 842,
            previewPdfHeight: 595,
            previewImageWidth: 0,
            previewImageHeight: 0,

            activeDragField: null,
        }
    },

    computed: {
        selectedTemplateObj() {
            const selectedId = Number(this.selectedTemplate);
            return this.templates.find(t => Number(t.id) === selectedId) || null;
        },
        previewScaleX() {
            if (!this.previewImageWidth) return 1;
            return this.previewImageWidth / this.previewPdfWidth;
        },
        previewScaleY() {
            if (!this.previewImageHeight) return 1;
            return this.previewImageHeight / this.previewPdfHeight;
        },
        previewParticipant() {
            if (this.participants.length > 0) return this.participants[0];
            return { 'Име': 'Иван Иванов', 'Тема': 'Python/Django', 'Дата': '12.04.2026' };
        },
        previewImageSrc() {
            const raw = this.selectedTemplateObj?.preview_image;
            if (!raw) return '/static/images/pic01.jpg';
            if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) return raw;
            return `/${raw}`;
        }
    },

    methods: {
        getCookie(name) {
            const cookies = document.cookie ? document.cookie.split('; ') : [];
            for (let i = 0; i < cookies.length; i++) {
                const parts = cookies[i].split('=');
                const key = decodeURIComponent(parts[0]);
                if (key === name) {
                    return decodeURIComponent(parts.slice(1).join('='));
                }
            }
            return null;
        },

        fetchTemplates() {
            axios.get('/api/templates/')
                .then(response => {
                    this.templates = response.data;
                })
                .catch(error => {
                    console.error("Грешка при зареждане на шаблони:", error);
                    this.errorMessage = 'Неуспешно зареждане на шаблоните.';
                });
        },

        handleFileUpload(event) {
            this.selectedFile = event.target.files[0];
            this.errorMessage = '';
        },

        onPreviewImageLoad(event) {
            this.previewImageWidth = event.target.clientWidth || event.target.naturalWidth || 0;
            this.previewImageHeight = event.target.clientHeight || event.target.naturalHeight || 0;
        },

        getPreviewTextStyle(conf) {
            const x = Number(conf?.x || 0) * this.previewScaleX;
            const y = Number(conf?.y || 0) * this.previewScaleY;
            const fontSize = Math.max(8, Number(conf?.size || 12) * ((this.previewScaleX + this.previewScaleY) / 2));

            return {
                position: 'absolute',
                left: `${x}px`,
                top: `${this.previewImageHeight - y}px`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${fontSize}px`,
                fontWeight: '700',
                color: '#111',
                textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                cursor: 'move'
            };
        },

        formatDateForPreview(value) {
            if (!value) return '12/04/2026 г.';
            const text = String(value).trim();

            const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/;
            const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;

            if (slash.test(text)) return `${text} г.`;
            if (dot.test(text)) return `${text.replace(/\./g, '/')} г.`;

            const m = text.match(iso);
            if (m) return `${m[3]}/${m[2]}/${m[1]} г.`;

            return text;
        },

        startDrag(fieldName, event) {
            this.activeDragField = fieldName;
            window.addEventListener('pointermove', this.onDragMove);
            window.addEventListener('pointerup', this.stopDrag);
        },

        onDragMove(event) {
            if (!this.activeDragField) return;
            const container = this.$refs.previewContainer;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const relX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
            const relY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

            const pdfX = Math.round(relX / this.previewScaleX);
            const pdfY = Math.round((rect.height - relY) / this.previewScaleY);

            this.textSettings[this.activeDragField].x = pdfX;
            this.textSettings[this.activeDragField].y = pdfY;
        },

        stopDrag() {
            this.activeDragField = null;
            window.removeEventListener('pointermove', this.onDragMove);
            window.removeEventListener('pointerup', this.stopDrag);
        },

        uploadList() {
            if (!this.selectedFile) {
                this.errorMessage = "Моля, изберете файл първо!";
                return;
            }

            this.isLoading = true;
            let formData = new FormData();
            formData.append('file', this.selectedFile);

            axios.post('/api/upload-participants/', formData)
            .then(response => {
                this.participants = response.data.data;
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                this.errorMessage = error.response?.data?.error || "Грешка при обработката на файла.";
            });
        },

        removeParticipant(index) {
            this.participants.splice(index, 1);
        },

        generateCertificates() {
            if (!this.selectedTemplate) {
                this.errorMessage = "Моля, изберете шаблон за сертификата!";
                return;
            }
            if (this.participants.length === 0) {
                this.errorMessage = "Списъкът с участници е празен!";
                return;
            }

            this.isLoading = true;
            this.errorMessage = '';
            this.successMessage = '';

            const payload = {
                template_id: this.selectedTemplate,
                participants: this.participants,
                text_settings: this.textSettings
            };

            axios.post('/api/generate/', payload)
                .then(response => {
                    this.isLoading = false;
                    this.successMessage = response.data.message;
                    this.downloadUrl = response.data.download_url;
                })
                .catch(error => {
                    this.isLoading = false;
                    this.errorMessage = "Възникна грешка при генерирането.";
                });
        },

        goToGenerateMode(templateId = null) {
            if (templateId) {
                this.selectedTemplate = Number(templateId);
            }

            const tpl = this.templates.find(t => Number(t.id) === Number(this.selectedTemplate));
            this.previewPdfWidth = Number(tpl?.pdf_width) || 842;
            this.previewPdfHeight = Number(tpl?.pdf_height) || 595;

            this.showMode = 'upload';
        }
    },
    created: function() {
        this.showMode = 'home';

        const csrftoken = this.getCookie('csrftoken');
        if (csrftoken) {
            axios.defaults.headers.common['X-CSRFToken'] = csrftoken;
        }
        axios.defaults.xsrfCookieName = 'csrftoken';
        axios.defaults.xsrfHeaderName = 'X-CSRFToken';

        this.fetchTemplates();
    }
}

Vue.createApp(App).mount('#app')
