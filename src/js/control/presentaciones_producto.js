import CaracteristicaDao from "./caracteristica_dao.js";
import ProductoCaracteristicaDao from "./producto_caracteristica_dao.js";
import TipoCaracteristicaDao from "./tipo_caracteristica_dao.js";
import { etiquetaCaracteristica } from "./formato_caracteristicas.js";

/** Identifica una combinación completa sin depender del orden de las relaciones REST. */
function firmaCaracteristicas(caracteristicas) {
    return JSON.stringify(caracteristicas.map(c => [c.idCaracteristica, c.valor])
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])));
}

/** Distingue las opciones de preparación de los datos descriptivos, como onzas o porciones. */
function esOpcion(caracteristica) {
    if (esMedida(caracteristica)) return false;
    return Boolean(caracteristica.idTipoCaracteristica) || caracteristica.opcion === true
        || !/^\d+(?:[.,]\d+)?$/.test(caracteristica.valor);
}

/** Reconoce medidas por su definición, incluso cuando el valor ya incluye la unidad. */
function esMedida(caracteristica) {
    const normalizar = texto => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    return ["volumen", "cantidad", "peso"].includes(normalizar(caracteristica.nombreTipo))
        || /^(onzas?|oz|mililitros?|ml|gramos?|kilogramos?|porcion(?:es)?|tamano)$/.test(normalizar(caracteristica.nombre));
}

/** Presenta tamaños reales sin reutilizar opciones de leche ni inferir tamaños del precio. */
function etiquetaPresentacion(producto) {
    if (!producto.caracteristicas?.length) return producto.presentacion || producto.nombre;
    const descriptivas = producto.caracteristicas.filter(c => !esOpcion(c));
    const medidas = descriptivas.filter(esMedida);
    const etiquetas = (medidas.length ? medidas : descriptivas).map(c => {
        const nombre = c.nombre.trim().toLowerCase();
        if (/^(onzas?|oz)$/.test(nombre)) return c.valor.replace(/\s*(?:onzas?|oz)$/i, "").trim() + " oz";
        if (/^(mililitros?|ml)$/.test(nombre)) return c.valor.replace(/\s*(?:mililitros?|ml)$/i, "").trim() + " ml";
        return c.etiqueta;
    });
    return etiquetas.join(" · ") || "Tamaño no especificado";
}

/** Agrupa las alternativas por el identificador de su tipo, usando el nombre registrado. */
function tipoOpcion(caracteristica) {
    if (caracteristica.idTipoCaracteristica) return { id: "tipo:" + caracteristica.idTipoCaracteristica, nombre: caracteristica.nombreTipo || "Características" };
    return { id: "caracteristica:" + caracteristica.idCaracteristica, nombre: caracteristica.nombre };
}

/**
 * Consulta las características de todos los productos y agrupa nombres coincidentes.
 * Cada variante conserva el ID y el precio de su registro; no se crean combinaciones.
 * Los homónimos sin datos suficientes o con combinaciones ambiguas permanecen separados.
 * @param {object[]} productos Registros originales del catálogo.
 * @returns {Promise<object[]>} Productos activos con características y variantes distinguibles.
 */
export async function agruparPresentaciones(productos) {
    const activos = productos.filter(p => p.activo);
    if (!activos.length) return [];
    const caracteristicas = (await new CaracteristicaDao().listarTodos()).filter(c => c.activo);
    const tipos = caracteristicas.some(c => c.idTipoCaracteristica?.idTipoCaracteristica)
        ? await new TipoCaracteristicaDao().listarTodos() : [];
    const porId = new Map(caracteristicas.map(c => [c.idCaracteristica, c]));
    const tiposPorId = new Map(tipos.map(t => [t.idTipoCaracteristica, t]));
    const detallados = await Promise.all(activos.map(async producto => {
        const relaciones = await new ProductoCaracteristicaDao(producto.idProducto).listarTodos();
        const detalles = relaciones.filter(r => porId.has(r.idCaracteristica?.idCaracteristica)).map(relacion => {
            const caracteristica = porId.get(relacion.idCaracteristica.idCaracteristica);
            const idTipo = caracteristica.idTipoCaracteristica?.idTipoCaracteristica;
            const tipo = tiposPorId.get(idTipo);
            const valor = String(relacion.valor ?? "").trim();
            const detalle = { idCaracteristica: caracteristica.idCaracteristica, nombre: caracteristica.nombre, valor,
                ...(idTipo ? { idTipoCaracteristica: idTipo, nombreTipo: tipo?.nombre || "Características" } : {}) };
            return { ...detalle, etiqueta: etiquetaCaracteristica(detalle.nombre, valor, { medida: esMedida(detalle) }) };
        }).filter(c => c.valor).sort((a, b) => a.idCaracteristica.localeCompare(b.idCaracteristica));
        return detalles.length ? { ...producto, caracteristicas: detalles, presentacion: detalles.map(c => c.etiqueta).join(" · ") } : producto;
    }));
    const grupos = new Map();
    for (const producto of detallados) {
        const nombre = producto.nombre.trim().toLocaleLowerCase("es");
        if (!grupos.has(nombre)) grupos.set(nombre, []);
        grupos.get(nombre).push(producto);
    }
    const resultado = [];
    for (const grupo of grupos.values()) {
        const firmas = grupo.map(p => firmaCaracteristicas(p.caracteristicas || []));
        const distinguibles = grupo.every(p => p.caracteristicas?.length) && new Set(firmas).size === grupo.length;
        if (grupo.length > 1 && distinguibles) resultado.push({ ...grupo[0], variantes: grupo });
        else resultado.push(...grupo);
    }
    return resultado;
}

/**
 * Prepara las opciones visibles sin alterar sus registros originales.
 * Primero se elige el registro de producto y su precio. Sus opciones de preparación
 * se presentan después, agrupadas por tipo; cada grupo exige una elección.
 * Las opciones pueden pertenecer al mismo ID sin alterar el precio.
 * @param {object} producto Producto individual o agrupado por agruparPresentaciones.
 * @returns {{variantes: object[], fijas: object[], grupos: object[]}} Datos para el selector.
 */
export function opcionesDeProducto(producto) {
    const variantes = producto?.variantes?.length ? producto.variantes : (producto ? [producto] : []);
    if (!variantes.length) return { variantes, fijas: [], grupos: [] };
    const grupos = [];
    if (variantes.length > 1) grupos.push({ id: "presentacion", nombre: "Presentación", condicional: false,
        opciones: variantes.map(v => ({ id: v.idProducto,
            etiqueta: etiquetaPresentacion(v),
            variantes: [v.idProducto] })) });
    const secundarios = new Map();
    for (const variante of variantes) for (const caracteristica of (variante.caracteristicas || []).filter(esOpcion)) {
        const tipo = tipoOpcion(caracteristica);
        if (!secundarios.has(tipo.id)) secundarios.set(tipo.id, { ...tipo, condicional: true, opciones: [] });
        const grupo = secundarios.get(tipo.id);
        const id = firmaCaracteristicas([caracteristica]);
        let opcion = grupo.opciones.find(o => o.id === id);
        if (!opcion) {
            opcion = { id, etiqueta: caracteristica.etiqueta, caracteristicas: [caracteristica], variantes: [] };
            grupo.opciones.push(opcion);
        }
        opcion.variantes.push(variante.idProducto);
    }
    grupos.push(...secundarios.values());
    const fijas = variantes.length === 1 ? (variantes[0].caracteristicas || []).filter(c => !esOpcion(c)) : [];
    return { variantes, fijas, grupos };
}

/** Devuelve únicamente los campos y valores disponibles para el producto elegido. */
export function gruposVisibles(configuracion, selecciones) {
    const primarios = configuracion.grupos.filter(g => !g.condicional);
    if (!primarios.every(g => selecciones.has(g.id))) return primarios;
    const candidatos = configuracion.variantes.filter(v => primarios.every(g => g.opciones.find(o => o.id === selecciones.get(g.id))?.variantes.includes(v.idProducto)));
    return configuracion.grupos.map(grupo => grupo.condicional
        ? { ...grupo, opciones: grupo.opciones.filter(o => candidatos.some(v => o.variantes.includes(v.idProducto))) } : grupo)
        .filter(grupo => grupo.opciones.length);
}

/**
 * Resuelve el ID y precio originales y conserva solo las características elegidas.
 * La clave diferencia en el carrito las combinaciones elegidas para un mismo producto.
 * @param {object} configuracion Resultado de opcionesDeProducto.
 * @param {Map<string,string>} selecciones Identificadores elegidos por grupo.
 * @returns {object|null} Selección completa, o nulo mientras falte elegir una opción obligatoria.
 */
export function seleccionarProducto(configuracion, selecciones) {
    const grupos = gruposVisibles(configuracion, selecciones);
    if (grupos.some(g => !selecciones.has(g.id))) return null;
    const compatibles = configuracion.variantes.filter(v => grupos.every(g => g.opciones.find(o => o.id === selecciones.get(g.id))?.variantes.includes(v.idProducto)));
    if (compatibles.length !== 1) return null;
    const producto = compatibles[0];
    const extras = grupos.filter(g => g.condicional).flatMap(g => g.opciones.find(o => o.id === selecciones.get(g.id)).caracteristicas);
    if (!extras.length) return producto;
    const caracteristicas = [...(producto.caracteristicas || []).filter(c => !esOpcion(c)), ...extras];
    const presentacion = caracteristicas.map(c => c.etiqueta).join(" · ");
    return { ...producto, caracteristicas, presentacion,
        claveSeleccion: JSON.stringify([producto.idProducto, firmaCaracteristicas(extras)]) };
}
