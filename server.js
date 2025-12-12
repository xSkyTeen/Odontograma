const express = require('express');
const path = require('path');
const app = express();

// 1. Servir carpeta "public"
// TRUCO: Le ponemos { index: false } para que NO cargue index.html automáticamente
// si es que existe. Así forzamos a que entre a nuestra ruta manual de abajo.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 2. Ruta principal explícita
// Ahora sí, cuando entren a la raíz, les mandamos el dashboard de una.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});