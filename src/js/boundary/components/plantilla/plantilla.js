/** Resuelve recursos locales del HTML sin cambiar los enlaces de navegación interna. */
function resolverRecursos(contenido, url) {
    for (const elemento of contenido.querySelectorAll("[href], [src]")) {
        for (const atributo of ["href", "src"]) {
            const valor = elemento.getAttribute(atributo);
            if (valor && !valor.startsWith("#")) elemento.setAttribute(atributo, new URL(valor, url).href);
        }
    }
    for (const fragmento of contenido.querySelectorAll("template")) resolverRecursos(fragmento.content, url);
}

/**
 * Carga una plantilla HTML propia; cada módulo la solicita una vez al importarse.
 * @param {URL} url Archivo HTML local, resuelto respecto al módulo que lo utiliza.
 * @returns {Promise<HTMLTemplateElement>} Plantilla lista para clonar en el Shadow DOM.
 */
export async function cargarPlantilla(url) {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("No se pudo cargar la plantilla " + url.pathname.split("/").at(-1) + ".");
    const plantilla = document.createElement("template");
    plantilla.innerHTML = await respuesta.text();
    resolverRecursos(plantilla.content, url);
    return plantilla;
}
