const App = {
    delimiters: ['[[', ']]'], // Променяме синтаксиса на [[ ]]
    data() {
        return {
            showMode: 0,
        }
    },
    methods: {
    },
    created: function(){
        console.log("created *******************");
        showMode = 0;
    }
}

Vue.createApp(App).mount('#app')
