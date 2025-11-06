// ===========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ===========================================
const SUPABASE_URL = 'https://oxmzmsjnvygosptvzfsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bXptc2pudnlnb3NwdHZ6ZnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjIzNTIsImV4cCI6MjA3NzkzODM1Mn0.ZhsjFNnp22eOl2_im-ZnbDaSCrg-W7TfrGWtzftjimY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================================
// 2. REFERENCIAS AL DOM (NUESTRO HTML)
// ===========================================
const arcoSuperiorEl = document.getElementById('arco-superior'); // Renombrado de filaSuperior para seguir la lógica del ejemplo
const arcoInferiorEl = document.getElementById('arco-inferior'); // Renombrado de filaInferior para seguir la lógica del ejemplo
const statusEl = document.getElementById('status'); // Renombrado de loadingState para seguir la lógica del ejemplo

// ===========================================
// 3. LÓGICA PRINCIPAL
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    cargarOdontogramaCompleto(); // Renombrado para seguir el ejemplo
});

/**
 * Función principal que orquesta todo.
 */
async function cargarOdontogramaCompleto() { // Renombrado para seguir el ejemplo
    console.log("Empezando la chamba... 🦷");
    statusEl.textContent = "'Jalando' plantilla y piezas de Supabase..."; // Texto de estado

    try {
        // --- A. JALAMOS TODOS LOS DATOS (Tu método eficiente) ---
        console.log("Consultando las 4 tablas en paralelo...");
        const [
            dientesRes,
            cuerposRes,
            coronasRes,
            raicesRes
        ] = await Promise.all([
            db.from('diente').select('*'),
            db.from('cuerpo').select('nombre, path'),
            db.from('corona').select('nombre, path'),
            db.from('raiz').select('nombre, path')
        ]);

        // Manejo de errores
        if (dientesRes.error) throw new Error(`Error jalando Dientes: ${dientesRes.error.message}`);
        if (cuerposRes.error) throw new Error(`Error jalando Cuerpos: ${cuerposRes.error.message}`);
        if (coronasRes.error) throw new Error(`Error jalando Coronas: ${coronasRes.error.message}`);
        if (raicesRes.error) throw new Error(`Error jalando Raices: ${raicesRes.error.message}`);

        const dientesData = dientesRes.data; // Renombrado para evitar conflicto con la función
        console.log(`Se encontraron ${dientesData.length} dientes.`);

        // --- B. CREAMOS "MAPAS" PARA BÚSQUEDA RÁPIDA (Tu lógica) ---
        const cuerpoMap = new Map(cuerposRes.data.map(p => [p.nombre, p.path]));
        const coronaMap = new Map(coronasRes.data.map(p => [p.nombre, p.path]));
        const raizMap = new Map(raicesRes.data.map(p => [p.nombre, p.path]));

        console.log("Maps de piezas creados. Empezando a dibujar...");

        // --- C. ¡AQUÍ LA LÓGICA DEL EJEMPLO EXITOSO! (El Ordenamiento) ---

        // 1. Separamos por cuadrante
        // La tabla 'Diente' tiene 'numero_fdi'. Usaremos ese para inferir el cuadrante.
        // Cuadrante 1 y 2 son superiores, 3 y 4 son inferiores.
        const superiores = dientesData.filter(d => Math.floor(d.numero_fdi / 10) === 1 || Math.floor(d.numero_fdi / 10) === 2);
        const inferiores = dientesData.filter(d => Math.floor(d.numero_fdi / 10) === 3 || Math.floor(d.numero_fdi / 10) === 4);

        // 2. Ordenamos como 'Dios manda' (para el visual)
        const c1 = superiores.filter(d => Math.floor(d.numero_fdi / 10) === 1).sort((a, b) => b.numero_fdi - a.numero_fdi); // 18 -> 11
        const c2 = superiores.filter(d => Math.floor(d.numero_fdi / 10) === 2).sort((a, b) => a.numero_fdi - b.numero_fdi); // 21 -> 28
        const arcoSupOrdenado = [...c1, ...c2];

        const c4 = inferiores.filter(d => Math.floor(d.numero_fdi / 10) === 4).sort((a, b) => b.numero_fdi - a.numero_fdi); // 48 -> 41
        const c3 = inferiores.filter(d => Math.floor(d.numero_fdi / 10) === 3).sort((a, b) => a.numero_fdi - b.numero_fdi); // 31 -> 38
        const arcoInfOrdenado = [...c4, ...c3];


        // --- D. ITERAMOS Y DIBUJAMOS EN EL ORDEN CORRECTO ---
        arcoSuperiorEl.innerHTML = '';
        arcoInferiorEl.innerHTML = '';

        arcoSupOrdenado.forEach(diente => {
            renderDiente(diente, arcoSuperiorEl, false, { cuerpoMap, coronaMap, raizMap });
        });

        arcoInfOrdenado.forEach(diente => {
            renderDiente(diente, arcoInferiorEl, true, { cuerpoMap, coronaMap, raizMap });
        });

        statusEl.textContent = "¡Yalaza! Odontograma cargado desde la nube.";
        console.log("¡Listo el pollo! Odontograma dibujado.");

    } catch (error) {
        console.error("¡Piñas! Algo salió mal:", error);
        statusEl.innerHTML = `¡Error 'mostro'! No 'funca'. <br><pre class="text-xs">${error.message}</pre>`;
    }
}

/**
 * 'El 'Pintor'' (El que dibuja)
 * Esta función AHORA crea UN diente y lo 'clava' (inserta) en su 'arco'.
 */
function renderDiente(dienteData, container, esInferior, maps) { // Renombrado diente a dienteData para claridad
    // 1. Creamos el HTML del SVG para este diente
    const dienteHtml = construirSvgDiente(dienteData, maps.cuerpoMap, maps.coronaMap, maps.raizMap, esInferior);

    // 2. Creamos un elemento 'div' para meter el SVG
    const dienteDiv = document.createElement('div'); // Renombrado dienteWrapper a dienteDiv
    dienteDiv.className = 'diente'; // Clase del ejemplo
    dienteDiv.setAttribute('data-id', dienteData.numero_fdi); // Usamos numero_fdi como ID
    dienteDiv.innerHTML = dienteHtml;

    // 3. Añadimos interactividad
    agregarEventos(dienteDiv, dienteData);

    // 4. Lo 'clavamos' (insertamos) en el 'arco' (contenedor)
    container.appendChild(dienteDiv);
}


/**
 * Toma la "receta" del diente y los mapas de piezas,
 * y devuelve el string HTML del SVG completo.
 * ¡MODIFICADO para invertir raíces superiores!
 */
function construirSvgDiente(dienteData, cuerpoMap, coronaMap, raizMap, esInferior = false) {
    const nombresCuerpo = parseNombres(dienteData.nombre_cuerpo);
    const nombresCorona = parseNombres(dienteData.nombre_coronas);
    const nombresRaiz = parseNombres(dienteData.nombre_raices);

    const pathsCuerpo = nombresCuerpo.map(nombre =>
        `<path class="parte-cuerpo asset-svg" data-nombre-pieza="${nombre}" d="${cuerpoMap.get(nombre) || ''}" />`
    ).join('');

    const pathsCorona = nombresCorona.map(nombre =>
        `<path class="parte-corona asset-svg" data-nombre-pieza="${nombre}" d="${coronaMap.get(nombre) || ''}" />`
    ).join('');

    const pathsRaiz = nombresRaiz.map(nombre =>
        `<path class="parte-raiz asset-svg" data-nombre-pieza="${nombre}" d="${raizMap.get(nombre) || ''}" />`
    ).join('');

    const coronaViewBox = "0 0 100 100";
    const raizViewBox = "0 0 100 100";

    // Aplicamos la clase para invertir las raíces si es necesario
    const raizClases = `raiz-svg asset-svg ${esInferior ? 'raiz-abajo' : (!esInferior && (Math.floor(dienteData.numero_fdi / 10) === 1 || Math.floor(dienteData.numero_fdi / 10) === 2) ? 'raiz-arriba-invertida' : '')}`;

    const coronaSvg = `
        <svg class="corona-svg asset-svg" viewBox="${coronaViewBox}" xmlns="http://www.w3.org/2000/svg">
            ${pathsCuerpo}
            ${pathsCorona}
        </svg>`;

    const raizSvg = `
        <svg class="${raizClases}" viewBox="${raizViewBox}" xmlns="http://www.w3.org/2000/svg">
            ${pathsRaiz}
        </svg>`;

    const numeroEl = `<span class="numero ${esInferior ? 'numero-abajo' : ''}">${dienteData.numero_fdi}</span>`;

    if (esInferior) {
        return coronaSvg + raizSvg + numeroEl;
    } else {
        return numeroEl + raizSvg + coronaSvg;
    }
}

/**
 * Función de ayuda para limpiar y separar los nombres.
 */
function parseNombres(nombresString) {
    if (!nombresString || nombresString.trim() === '') {
        return [];
    }
    return nombresString.split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Agrega 'click listeners' a todas las partes del diente.
 */
function agregarEventos(dienteDiv, dienteData) {
    const todasLasPartes = dienteDiv.querySelectorAll('.asset-svg path, .asset-svg rect');

    todasLasPartes.forEach(parte => {
        parte.addEventListener('click', (e) => {
            e.stopPropagation();

            const piezaNombre = parte.dataset.nombrePieza;
            console.log(`¡Click! Diente: ${dienteData.numero_fdi}, Pieza: ${piezaNombre}`);

            // Ejemplo de 'toggle' (marcar/desmarcar) con dos estados
            if (parte.classList.contains('estado-caries')) {
                parte.classList.remove('estado-caries');
                parte.classList.add('estado-relleno');
            } else if (parte.classList.contains('estado-relleno')) {
                parte.classList.remove('estado-relleno');
            } else {
                parte.classList.add('estado-caries');
            }
            // Aquí llamarías a una función para GUARDAR este estado en Supabase
        });
    });
}