// ===========================================
// 1. CONFIGURACIÓN Y CONEXIÓN
// ===========================================
const SUPABASE_URL = 'xd';
const SUPABASE_ANON_KEY = 'uwu'
if (typeof supabase === 'undefined') {
    console.error("CRÍTICO: Supabase no cargó. Revisa tu conexión.");
}

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PACIENTE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ===========================================
// 2. ESTADO GLOBAL
// ===========================================
let mapasGlobales = {};
let catalogoSimbologia = []; // Para llenar el select
let tratamientosPaciente = []; // Cache local de tratamientos
let selectedToothId = null;
let selectedPartName = null; // Para saber qué cara seleccionó el usuario

// ===========================================
// 3. INICIALIZACIÓN
// ===========================================
document.addEventListener('DOMContentLoaded', async () => {
    configurarInterfaz();
    await cargarDatosPaciente();
    await cargarMaestros(); // Carga catálogos primero
    await cargarOdontogramaCompleto();
});

// ===========================================
// 4. CARGA DE DATOS
// ===========================================
async function cargarDatosPaciente() {
    // (Código igual al anterior, carga nombre y DNI)
    const { data: paciente } = await db.from('paciente').select('*').eq('id', PACIENTE_ID).single();
    if (paciente) {
        document.getElementById('lbl-paciente').textContent = `${paciente.nombres} ${paciente.apellidos}`;
        document.getElementById('lbl-dni').textContent = paciente.dni || '-';
        document.getElementById('lbl-hc').textContent = paciente.historia_clinica || '-';
    }
}

async function cargarMaestros() {
    // Cargamos la lista de simbologías para el dropdown
    const { data, error } = await db.from('simbologia').select('*').order('nombre');
    if (data) {
        catalogoSimbologia = data;
        llenarSelectSimbologia();
    }
}

async function cargarOdontogramaCompleto() {
    const statusEl = document.getElementById('status');
    try {
        console.log("Cargando arquitectura dental...");

        // CORRECCIÓN SOLICITADA: Usamos 'diente_Adulto'
        const [dientesRes, ninoRes, cuerposRes, coronasRes, raicesRes, tratamientosRes] = await Promise.all([
            db.from('diente_Adulto').select('*'), // <--- AQUÍ ESTÁ EL CAMBIO
            db.from('diente_nino').select('*'),
            db.from('cuerpo').select('nombre, path'),
            db.from('corona').select('nombre, path'),
            db.from('raiz').select('nombre, path'),
            db.from('paciente_tratamiento')
                .select(`*, simbologia ( valor_visual, tipo_renderizado, nombre, categoria )`)
                .eq('paciente_id', PACIENTE_ID)
        ]);

        // Mapas gráficos
        mapasGlobales = {
            cuerpo: new Map((cuerposRes.data || []).map(p => [p.nombre, p.path])),
            corona: new Map((coronasRes.data || []).map(p => [p.nombre, p.path])),
            raiz: new Map((raicesRes.data || []).map(p => [p.nombre, p.path]))
        };

        // Cacheamos tratamientos
        tratamientosPaciente = tratamientosRes.data || [];

        // Renderizado
        renderizarArco(dientesRes.data || [], [1, 2], 'arco-superior');
        renderizarArco(dientesRes.data || [], [4, 3], 'arco-inferior');
        renderizarArco(ninoRes.data || [], [5, 6], 'arco-superior-nino');
        renderizarArco(ninoRes.data || [], [8, 7], 'arco-inferior-nino');

        // Pintamos
        aplicarTratamientosVisuales();

        if(statusEl) statusEl.style.display = 'none';

    } catch (error) {
        console.error("Error fatal:", error);
        if(statusEl) statusEl.textContent = "Error de red. Revisa la consola.";
    }
}

// ===========================================
// 5. RENDERIZADO Y HOVER (SVG)
// ===========================================
function renderizarArco(listaDientes, cuadrantes, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Filtro y orden (mismo de antes)
    const cA = listaDientes.filter(d => Math.floor(d.numero_fdi / 10) === cuadrantes[0])
        .sort((a, b) => cuadrantes[0] === 1 || cuadrantes[0] === 5 || cuadrantes[0] === 8 ? b.numero_fdi - a.numero_fdi : a.numero_fdi - b.numero_fdi);
    const cB = listaDientes.filter(d => Math.floor(d.numero_fdi / 10) === cuadrantes[1])
        .sort((a, b) => a.numero_fdi - b.numero_fdi);

    // Orden visual estándar
    let finalOrder = [...cA, ...cB];
    if(cuadrantes.includes(4)) finalOrder = [...cA, ...cB]; // Ajuste visual inferior

    finalOrder.forEach(diente => {
        const svgHTML = construirSvg(diente);
        const div = document.createElement('div');
        div.className = 'diente group relative flex flex-col items-center justify-center p-1 hover:bg-blue-50 rounded transition-colors cursor-pointer';
        div.dataset.id = diente.numero_fdi;

        div.innerHTML = `
            <span class="text-[10px] font-bold text-gray-400 mb-1 select-none pointer-events-none">${diente.numero_fdi}</span>
            <div class="contenedor-svgs w-[45px] h-[90px] relative transition-transform group-hover:scale-105">
                ${svgHTML}
                <!-- Capa extra para iconos grandes (X, Puentes) -->
                <div class="simbologia-overlay absolute inset-0 pointer-events-none"></div>
            </div>
        `;

        // Evento principal: Seleccionar Diente
        div.addEventListener('click', (e) => {
            // Si el click vino de un path específico, ya lo manejó el evento del path (bubbling)
            // Pero necesitamos setear el ID global
            seleccionarDiente(diente, div);
        });

        container.appendChild(div);
    });
}

function construirSvg(diente) {
    const parse = (s) => s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
    const getPath = (mapName, nombre) => mapasGlobales[mapName]?.get(nombre) || '';

    // Estilo base
    const estiloDiente = 'fill:white; stroke:#334155; stroke-width:1.5px; vector-effect: non-scaling-stroke;';

    // Función helper para crear path con eventos
    const makePath = (d, clase, nombre) => {
        // onclick="seleccionarParte('${nombre}')"
        // Nota: Agregamos listeners directos en el HTML string no es ideal, mejor delegación.
        // Pero usaremos clases para identificar.
        return `<path d="${d}" class="parte-diente ${clase}" data-nombre="${nombre}" style="${estiloDiente}" onclick="event.stopPropagation(); seleccionarParte('${diente.numero_fdi}', '${nombre}', this)" />`;
    };

    const pCuerpo = parse(diente.nombre_cuerpo).map(n => makePath(getPath('cuerpo', n), 'cuerpo', n)).join('');
    const pCorona = parse(diente.nombre_coronas).map(n => makePath(getPath('corona', n), 'corona', n)).join('');
    const pRaiz = parse(diente.nombre_raices).map(n => makePath(getPath('raiz', n), 'raiz', n)).join('');

    // Transformaciones ViewBox (Igual que antes)
    const esSuperior = [1, 2, 5, 6].includes(Math.floor(diente.numero_fdi / 10));
    let tRaiz = esSuperior ? `translate(2.5, 10) scale(1, 1.2)` : `translate(2.5, 90) scale(1, 1.2)`;
    let tCorona = esSuperior ? `translate(2.5, 80)` : `translate(2.5, 20)`;

    return `
        <svg viewBox="0 0 105 205" class="w-full h-full overflow-visible drop-shadow-sm">
            <g class="grupo-raiz" transform="${tRaiz}">${pRaiz}</g>
            <g class="grupo-corona" transform="${tCorona}">${pCuerpo}${pCorona}</g>
        </svg>
    `;
}

// ===========================================
// 6. GESTIÓN DEL SIDEBAR Y SELECCIÓN
// ===========================================

// Esta función se llama al hacer click en el DIV del diente o en una PARTE
function seleccionarDiente(dienteData, divElement) {
    selectedToothId = dienteData.numero_fdi; // Guardamos ID Global

    // Resaltado Visual
    document.querySelectorAll('.diente-seleccionado').forEach(el => el.classList.remove('diente-seleccionado', 'ring-2', 'ring-blue-500'));
    divElement.classList.add('diente-seleccionado', 'ring-2', 'ring-blue-500');

    // Abrir Sidebar
    const sidebar = document.getElementById('sidebar-derecho');
    const emptyState = document.getElementById('empty-state');
    const detail = document.getElementById('diente-detail');

    sidebar.classList.remove('translate-x-full');
    emptyState.classList.add('hidden');
    detail.classList.remove('hidden');
    detail.classList.add('flex');

    // Llenar Datos Header
    document.getElementById('detalle-numero').textContent = selectedToothId;

    // Zoom Visual
    const zoomContainer = document.getElementById('zoom-container');
    zoomContainer.innerHTML = '';
    const svgClon = divElement.querySelector('svg').cloneNode(true);
    svgClon.classList.add('w-full', 'h-full');
    // Removemos onclicks del clon para que no bugueen
    svgClon.querySelectorAll('path').forEach(p => p.removeAttribute('onclick'));
    zoomContainer.appendChild(svgClon);

    // Llenar Lista de Tratamientos
    renderizarListaTratamientos();

    // Resetear Formulario (por defecto selecciona todo el diente)
    resetFormulario();
    llenarSelectCaras(dienteData); // Llenamos dropdown con las partes disponibles de ESTE diente
}

// Esta función se llama al hacer click ESPECÍFICAMENTE en un PATH (una cara)
window.seleccionarParte = function(dienteId, nombreParte, pathElement) {
    // 1. Disparamos la selección del diente padre primero (para abrir sidebar)
    // Buscamos el div padre usando el ID
    const divPadre = document.querySelector(`.diente[data-id="${dienteId}"]`);
    // Simulamos click en el padre si no está seleccionado, pero necesitamos los datos del diente.
    // Hack rápido: el evento del padre ya se disparó por bubbling si no usamos stopPropagation.
    // Como usamos stopPropagation en el HTML string, llamamos manualmente:

    // Necesitamos la data del diente. La buscamos en el DOM o memoria?
    // Mejor dejamos que el evento Bubble UP y manejamos la selección de parte después.
    // REFACTOR: Quitamos stopPropagation del HTML string y manejamos lógica aquí.

    // Lógica actual: El click en path selecciona el diente Y ADEMÁS selecciona la cara en el combo.
    const dienteData = { numero_fdi: dienteId, ...obtenerPartesDiente(dienteId) }; // Dummy data wrapper
    seleccionarDiente(dienteData, divPadre);

    // 2. Seleccionar la cara en el UI
    selectedPartName = nombreParte;
    document.getElementById('select-cara').value = nombreParte;
    document.getElementById('zona-seleccionada-badge').textContent = nombreParte;
    document.getElementById('zona-seleccionada-badge').className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200";

    // Resaltar en el zoom (opcional)
    const zoomSvg = document.getElementById('zoom-container').querySelector('svg');
    if(zoomSvg) {
        zoomSvg.querySelectorAll('path').forEach(p => p.style.opacity = '0.4');
        const target = zoomSvg.querySelector(`path[data-nombre="${nombreParte}"]`);
        if(target) {
            target.style.opacity = '1';
            target.style.fill = '#bfdbfe'; // Azulito claro
            target.style.stroke = '#2563eb';
        }
    }
}

// Helper para re-obtener info de partes (usado al clickear)
function obtenerPartesDiente(id) {
    // Esto es un parche porque en seleccionarParte no tenemos todo el objeto diente.
    // En una app real, 'dientesRes.data' debería ser global o buscable.
    // Por ahora confiamos en que seleccionarDiente maneja lo visual.
    // Solo necesitamos las partes para el dropdown.
    // El dropdown se llena en 'llenarSelectCaras' usando el DOM actual del diente.
    return {};
}

function llenarSelectCaras(dienteData) {
    const select = document.getElementById('select-cara');
    select.innerHTML = '<option value="">Todo el Diente</option>';

    // Buscamos las partes en el SVG del diente seleccionado
    const divDiente = document.querySelector(`.diente[data-id="${dienteData.numero_fdi}"]`);
    if(!divDiente) return;

    const partes = divDiente.querySelectorAll('path.parte-diente');
    partes.forEach(p => {
        const nombre = p.getAttribute('data-nombre');
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre; // Mostrar nombre técnico (Oclusal_1) o mapear a bonito
        select.appendChild(option);
    });
}

function resetFormulario() {
    selectedPartName = null;
    document.getElementById('select-simbologia').value = "";
    document.getElementById('select-cara').value = "";
    document.getElementById('input-observacion').value = "";
    document.getElementById('zona-seleccionada-badge').textContent = "Todo el Diente";
    document.getElementById('zona-seleccionada-badge').className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200";
}

// ===========================================
// 7. CRUD DE TRATAMIENTOS
// ===========================================

function renderizarListaTratamientos() {
    const listaEl = document.getElementById('lista-tratamientos');
    listaEl.innerHTML = '';

    // Filtramos tratamientos de ESTE diente
    const tratamientosDiente = tratamientosPaciente.filter(t => t.diente_fdi == selectedToothId);
    document.getElementById('contador-tratamientos').textContent = tratamientosDiente.length;

    if (tratamientosDiente.length === 0) {
        listaEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 italic">Sin historial registrado.</p>';
        return;
    }

    tratamientosDiente.forEach(t => {
        const item = document.createElement('div');
        item.className = 'bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex justify-between items-start group';

        const nombreSim = t.simbologia?.nombre || 'Desconocido';
        const caraTexto = t.cara_diente ? `En: ${t.cara_diente}` : 'Todo el diente';
        const obs = t.observaciones ? `<p class="text-[10px] text-gray-400 mt-1 italic">"${t.observaciones}"</p>` : '';

        item.innerHTML = `
            <div>
                <p class="text-xs font-bold text-slate-700">${nombreSim}</p>
                <p class="text-[10px] text-gray-500">${caraTexto}</p>
                ${obs}
            </div>
            <button onclick="eliminarTratamiento('${t.id}')" class="text-gray-300 hover:text-red-500 transition-colors p-1" title="Eliminar">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        listaEl.appendChild(item);
    });
    lucide.createIcons();
}

window.agregarTratamiento = async function() {
    const simbologiaId = document.getElementById('select-simbologia').value;
    const cara = document.getElementById('select-cara').value || null; // Si es vacío, es NULL (todo el diente)
    const obs = document.getElementById('input-observacion').value;

    if (!selectedToothId || !simbologiaId) {
        alert("Por favor selecciona una condición.");
        return;
    }

    // Insertar en Supabase
    const { data, error } = await db.from('paciente_tratamiento').insert({
        paciente_id: PACIENTE_ID,
        diente_fdi: selectedToothId,
        simbologia_id: simbologiaId,
        cara_diente: cara,
        observaciones: obs
    }).select(`*, simbologia ( valor_visual, tipo_renderizado, nombre, categoria )`).single();

    if (error) {
        console.error(error);
        alert("Error al guardar.");
    } else {
        // Actualizar cache local y repintar
        tratamientosPaciente.push(data);
        renderizarListaTratamientos();
        aplicarTratamientosVisuales(); // Repinta todo el odontograma
        resetFormulario();

        // Feedback visual
        const btn = document.querySelector('button[onclick="agregarTratamiento()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Guardado`;
        btn.classList.replace('bg-blue-600', 'bg-green-600');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-green-600', 'bg-blue-600');
            lucide.createIcons();
        }, 1500);
    }
}

window.eliminarTratamiento = async function(id) {
    if(!confirm("¿Seguro que deseas eliminar este registro?")) return;

    const { error } = await db.from('paciente_tratamiento').delete().eq('id', id);
    if (error) {
        console.error(error);
        alert("Error al eliminar.");
    } else {
        // Eliminar de cache local
        tratamientosPaciente = tratamientosPaciente.filter(t => t.id !== id);
        renderizarListaTratamientos();
        aplicarTratamientosVisuales(); // Repinta para borrar lo visual
    }
}

// ===========================================
// 8. LOGICA VISUAL (PINTOR)
// ===========================================
function aplicarTratamientosVisuales() {
    // Primero limpiamos todo visualmente (reset)
    document.querySelectorAll('.parte-diente').forEach(p => {
        p.style.fill = 'white';
        p.classList.remove('tratado');
    });
    document.querySelectorAll('.simbologia-overlay').forEach(d => d.innerHTML = '');
    document.querySelectorAll('svg line, svg rect, svg text').forEach(e => e.remove()); // Limpieza agresiva de extras

    // Re-aplicamos todo
    tratamientosPaciente.forEach(t => {
        if (!t.simbologia) return;

        const dienteDiv = document.querySelector(`.diente[data-id="${t.diente_fdi}"]`);
        if (!dienteDiv) return;

        const svg = dienteDiv.querySelector('svg');
        const simbologia = t.simbologia;

        // 1. PINTAR CARAS
        if (simbologia.tipo_renderizado === 'color_cara' || simbologia.tipo_renderizado === 'pintar_forma') {
            let color = '#3b82f6'; // Azul default
            // Lógica de colores simple basada en nombre/valor
            if(simbologia.valor_visual && (simbologia.valor_visual.includes('MB') || simbologia.valor_visual.includes('CE') || simbologia.valor_visual.includes('CD'))) color = '#ef4444';
            if(simbologia.nombre && simbologia.nombre.includes('Amalgama')) color = '#334155';

            if (t.cara_diente) {
                const partes = svg.querySelectorAll(`path[data-nombre="${t.cara_diente}"]`);
                partes.forEach(p => {
                    p.style.fill = color;
                    p.classList.add('tratado');
                });
                agregarTexto(svg, simbologia.valor_visual, color === '#ef4444' ? 'red' : 'blue');
            } else {
                svg.querySelectorAll('.corona, .cuerpo').forEach(p => p.style.fill = color);
            }
        }
        // 2. EXTRACCIONES
        else if (simbologia.tipo_renderizado === 'aspa_total') {
            const xGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            xGroup.innerHTML = `<line x1="10" y1="10" x2="95" y2="195" stroke="blue" stroke-width="4" /><line x1="95" y1="10" x2="10" y2="195" stroke="blue" stroke-width="4" />`;
            svg.appendChild(xGroup);
            svg.querySelectorAll('path').forEach(p => p.style.opacity = '0.5');
            agregarTexto(svg, simbologia.valor_visual, 'blue');
        }
        // 3. BORDES (CORONAS)
        else if (simbologia.tipo_renderizado.includes('borde_corona')) {
            const color = simbologia.tipo_renderizado.includes('rojo') ? 'red' : 'blue';
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const esSuperior = [1,2,5,6].includes(Math.floor(t.diente_fdi/10));
            rect.setAttribute('x', '5'); rect.setAttribute('y', esSuperior ? '80' : '20');
            rect.setAttribute('width', '95'); rect.setAttribute('height', '60');
            rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', color); rect.setAttribute('stroke-width', '3');
            svg.appendChild(rect);
            agregarTexto(svg, simbologia.valor_visual, color);
        }
        // 4. ENDODONCIA
        else if (['TC', 'PC'].includes(simbologia.valor_visual)) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            const esSuperior = [1,2,5,6].includes(Math.floor(t.diente_fdi/10));
            line.setAttribute('x1', '52.5'); line.setAttribute('y1', esSuperior ? '10' : '130');
            line.setAttribute('x2', '52.5'); line.setAttribute('y2', esSuperior ? '70' : '190');
            line.setAttribute('stroke', 'red'); line.setAttribute('stroke-width', '3');
            svg.appendChild(line);
            agregarTexto(svg, simbologia.valor_visual, 'red', esSuperior ? 5 : 200);
        }
    });
}

function agregarTexto(svg, texto, color, yPos = null) {
    if (!texto || texto.length > 5) return;
    // Chequear si ya existe para no duplicar
    const existe = Array.from(svg.querySelectorAll('text')).some(t => t.textContent === texto);
    if(existe) return;

    const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textEl.setAttribute('x', '52.5');
    textEl.setAttribute('y', yPos || '102.5');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('fill', color);
    textEl.setAttribute('font-weight', 'bold');
    textEl.setAttribute('font-size', '24px');
    textEl.textContent = texto;
    svg.appendChild(textEl);
}

// Helpers UI
function llenarSelectSimbologia() {
    const select = document.getElementById('select-simbologia');
    select.innerHTML = '<option value="">-- Seleccionar --</option>';

    // Agrupar por categoría (opcional, por ahora plano)
    catalogoSimbologia.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.nombre} (${s.valor_visual || 'Icono'})`;
        select.appendChild(option);
    });
}

function configurarInterfaz() {
    const sb = document.getElementById('sidebar-derecho');
    if(sb) sb.classList.add('translate-x-full');
}
function cerrarPanelDerecho() {
    document.getElementById('sidebar-derecho').classList.add('translate-x-full');
    document.querySelectorAll('.diente-seleccionado').forEach(el => el.classList.remove('diente-seleccionado', 'ring-2', 'ring-blue-500'));
    selectedToothId = null;
}