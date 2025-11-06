import os
import textwrap

# --- Nombre del Proyecto ---
NOMBRE_PROYECTO = "odontograma_supabase"

# --- Contenido de los Archivos ---

# 1. package.json (Igual, para instalar Tailwind)
CONTENIDO_PACKAGE_JSON = f"""
{{
  "name": "{NOMBRE_PROYECTO}",
  "version": "1.0.0",
  "description": "Odontograma con Tailwind y Supabase",
  "scripts": {{
    "dev": "tailwindcss -i ./src/input.css -o ./public/css/style.css --watch"
  }},
  "devDependencies": {{
    "tailwindcss": "^3.4.1"
  }}
}}
"""

# 2. tailwind.config.js (Igual, para configurar Tailwind)
CONTENIDO_TAILWIND_CONFIG = """
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"""

# 3. src/input.css (Igual, el CSS fuente)
CONTENIDO_INPUT_CSS = """
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Puedes añadir clases base para tu odontograma aquí */
.diente-parte-svg {
  @apply fill-current text-gray-300 transition-colors duration-150 ease-in-out cursor-pointer;
}

.diente-parte-svg:hover {
  @apply text-blue-400;
}

.caries {
  @apply text-red-500 !important; /* !important para sobreescribir el hover */
}
"""

# 4. public/index.html (¡MODIFICADO!)
#    Aquí cargamos la librería de Supabase y ponemos un 'div' contenedor
CONTENIDO_INDEX_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Odontograma con Supabase</title>
    <link href="./css/style.css" rel="stylesheet">
    
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="bg-gray-900 text-white p-8">

    <div class="max-w-4xl mx-auto">
        <h1 class="text-4xl font-bold text-cyan-400 mb-6 text-center">
            Odontograma
        </h1>
        
        <p class="text-center text-gray-400 mb-8">
            Cargando datos desde Supabase...
        </p>

        <div id="odontograma-container" 
             class="bg-gray-800 p-6 rounded-lg shadow-xl grid grid-cols-8 gap-4">
            
            </div>
    </div>

    <script src="./js/main.js"></script>
</body>
</html>
"""

# 5. public/js/main.js (¡MODIFICADO!)
#    Este es el cerebro. Se conecta a Supabase y dibuja los SVGs
CONTENIDO_MAIN_JS = """
// --- ¡EL CEREBRO DE LA OPERACIÓN! ---

// 1. Configura tus llaves de Supabase
// ¡Obvio, pon tus llaves reales aquí!
const SUPABASE_URL = 'https://TU_PROYECTO_ID.supabase.co';
const SUPABASE_KEY = 'TU_ANON_KEY_PUBLICA';

// 2. Inicializa el cliente
// (Asegúrate de que la variable 'supabase' exista globalmente desde el CDN)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. Referencia al contenedor en el HTML
const container = document.getElementById('odontograma-container');

// 4. Función ASÍNCRONA para traer los datos
async function cargarPathsOdontograma() {
    console.log("Buscando paths en Supabase...");
    
    // Asumo que tu tabla se llama 'partes_diente'
    // y la columna con el path SVG se llama 'svg_path'
    // ¡Cambia 'partes_diente' y 'svg_path' por tus nombres reales!
    
    const { data, error } = await supabase
        .from('partes_diente')  // <-- CAMBIA ESTO
        .select('id, diente_id, nombre_parte, svg_path'); // <-- CAMBIA ESTO

    if (error) {
        console.error("¡Piñas! Hubo un error al traer los datos:", error);
        container.innerHTML = `<p class="text-red-500 col-span-8">Error: ${error.message}</p>`;
        return;
    }

    if (data.length === 0) {
        console.warn("No se encontraron datos en la tabla.");
        container.innerHTML = `<p class="text-yellow-500 col-span-8">No hay 'paths' en la base de datos.</p>`;
        return;
    }
    
    console.log("¡Datos encontrados!", data);
    
    // Limpiamos el contenedor (por si acaso)
    container.innerHTML = ''; 
    
    // 5. Dibujamos cada parte que encontramos
    // (Esta es una forma simple, agrupando por 'diente_id' sería más pro)
    
    data.forEach(parte => {
        // Creamos un wrapper para el diente (o parte)
        const dienteWrapper = document.createElement('div');
        dienteWrapper.className = 'w-20 h-20 p-1'; // Tailwind: Define el tamaño
        dienteWrapper.title = `${parte.nombre_parte} (ID: ${parte.id})`;

        // Creamos el SVG y le metemos el path de Supabase
        // (Ajusta el viewBox a tus necesidades)
        const svgHtml = `
            <svg viewBox="0 0 100 100" 
                 class="diente-svg" 
                 data-diente-id="${parte.diente_id}">
                
                <path d="${parte.svg_path}" 
                      class="diente-parte-svg" 
                      data-parte-id="${parte.id}">
                </path>
            </svg>
        `;
        
        dienteWrapper.innerHTML = svgHtml;
        
        // 6. ¡Hacemos que sea interactivo!
        const pathElement = dienteWrapper.querySelector('.diente-parte-svg');
        pathElement.addEventListener('click', () => {
            console.log(`¡Click en la parte: ${parte.nombre_parte}!`);
            
            // Ejemplo: marcar/desmarcar con 'caries'
            pathElement.classList.toggle('caries');
            
            // Aquí llamarías a una función para GUARDAR el estado en Supabase
            // guardarEstadoDiente(parte.id, pathElement.classList.contains('caries'));
        });
        
        // Lo añadimos al contenedor
        container.appendChild(dienteWrapper);
    });
}

// 7. ¡Llamar a la función al cargar la página!
// 'DOMContentLoaded' se asegura que el HTML esté listo antes de ejecutar el JS
document.addEventListener('DOMContentLoaded', cargarPathsOdontograma);

// (Opcional) Función para guardar cambios en Supabase
async function guardarEstadoDiente(parteId, tieneCaries) {
    console.log(`Guardando estado de ${parteId}: ${tieneCaries}`);
    
    // const { data, error } = await supabase
    //     .from('partes_diente')
    //     .update({ tiene_caries: tieneCaries }) // Asumiendo que tienes una columna 'tiene_caries'
    //     .eq('id', parteId);
        
    // if (error) console.error("Error al guardar:", error);
    // else console.log("¡Guardado!");
}
"""

# --- Función para crear archivos ---
def crear_archivo(ruta, contenido):
    """Una ayudita para no repetir código"""
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(textwrap.dedent(contenido))

# --- Lógica Principal del Script ---
def main():
    print(f"Creando tu odontograma: {NOMBRE_PROYECTO}...")

    # 1. Definir rutas
    ruta_base = NOMBRE_PROYECTO

    # 2. Crear archivos
    crear_archivo(os.path.join(ruta_base, "package.json"), CONTENIDO_PACKAGE_JSON)
    crear_archivo(os.path.join(ruta_base, "tailwind.config.js"), CONTENIDO_TAILWIND_CONFIG)
    crear_archivo(os.path.join(ruta_base, "src", "input.css"), CONTENIDO_INPUT_CSS)
    crear_archivo(os.path.join(ruta_base, "public", "index.html"), CONTENIDO_INDEX_HTML)
    crear_archivo(os.path.join(ruta_base, "public", "js", "main.js"), CONTENIDO_MAIN_JS)

    print("Archivos creados.")
    print("\n--- ¡Listo el pollo! ---")
    print(f"\nTu proyecto '{NOMBRE_PROYECTO}' está listo.")
    print("Recuerda editar 'public/js/main.js' con tus llaves de Supabase y nombres de tablas.")

if __name__ == "__main__":
    main()