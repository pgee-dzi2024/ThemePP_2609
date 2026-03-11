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
                name: {x: 420, y: 300, size: 36, show: true},
                course: {x: 420, y: 240, size: 18, show: true},
                date: {x: 600, y: 150, size: 18, show: true}
            },
        }
    },
    methods: {
        // 1. Зареждане на наличните шаблони от бекенда
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

        // 2. Обработка на избора на файл от компютъра
        handleFileUpload(event) {
            this.selectedFile = event.target.files[0];
            this.errorMessage = ''; // изчистване на стари грешки
        },

        // 3. Изпращане на файла към бекенда за парсване
        uploadList() {
            if (!this.selectedFile) {
                this.errorMessage = "Моля, изберете файл първо!";
                return;
            }

            this.isLoading = true;
            let formData = new FormData();
            formData.append('file', this.selectedFile);

            axios.post('/api/upload-participants/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            .then(response => {
                this.participants = response.data.data;
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                this.errorMessage = error.response?.data?.error || "Грешка при обработката на файла.";
            });
        },

        // 4. Изтриване на участник от списъка (част от валидацията)
        removeParticipant(index) {
            this.participants.splice(index, 1);
        },

        // 5. Изпращане на заявка за финално генериране
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

        // Помощен метод за смяна на изгледа
        goToGenerateMode(templateId = null) {
            if (templateId) {
                this.selectedTemplate = templateId;
            }
            this.showMode = 'upload'; // Преминаваме към екрана за качване и генериране
        }
    },
    created: function() {
        this.showMode = 'home'; // Добавено е this.
        this.fetchTemplates();  // Извикваме шаблоните при стартиране
    }
}

Vue.createApp(App).mount('#app')
