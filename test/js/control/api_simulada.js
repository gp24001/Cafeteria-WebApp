import sinon from "../../lib/sinon/sinon-esm.js";

/**
 * Sustituye únicamente la frontera HTTP para integrar los módulos reales sin guardar datos en la API.
 * Una ruta no prevista falla la prueba en lugar de salir a la red.
 * @param {object} rutas Respuestas o funciones por clave «MÉTODO ruta» relativa a resources/v1.
 * @returns {{peticion: object, solicitudes: object[]}} Espía y solicitudes observadas.
 */
export function simularApi(rutas) {
    const solicitudes = [];
    const peticion = sinon.stub(window, "fetch").callsFake(async (direccion, opciones = {}) => {
        const url = new URL(String(direccion));
        const ruta = url.pathname.split("/resources/v1/")[1];
        const metodo = opciones.method || "GET";
        const clave = metodo + " " + ruta;
        if (!Object.hasOwn(rutas, clave)) throw new Error("Petición no prevista: " + clave);
        const solicitud = { metodo, ruta, cuerpo: opciones.body ? JSON.parse(opciones.body) : null };
        solicitudes.push(solicitud);
        const datos = typeof rutas[clave] === "function" ? await rutas[clave](solicitud) : rutas[clave];
        return new Response(JSON.stringify(datos), { status: 200,
            headers: { "Content-Type": "application/json", "Total-registros": String(Array.isArray(datos) ? datos.length : 1) } });
    });
    return { peticion, solicitudes };
}

/** Proporciona una orden y unidades editables solo en memoria para comprobar el intercambio de preparación. */
export function simularPreparacion() {
    let orden = { idOrden: "orden-prueba", observacion: "Cliente: Ana · Pedido web referencia", fechaOrden: "2026-11-13T12:00:00Z" };
    const unidades = ["u1", "u2"].map((idOrdenProducto, indice) => ({ idOrdenProducto,
        idOrden: { idOrden: "orden-prueba" }, idProducto: { idProducto: "cafe" }, precio: 2,
        observaciones: "Pedido web referencia/cafe/" + (indice + 1) + " · 12 Onzas · Leche deslactosada" }));
    const rutas = {
        "GET orden/orden-prueba": () => structuredClone(orden),
        "GET orden/orden-prueba/producto": () => structuredClone(unidades),
        "PUT orden/orden-prueba": solicitud => (orden = structuredClone(solicitud.cuerpo)),
        "GET producto/cafe": { idProducto: "cafe", nombre: "Latte", activo: true, precioSugerido: 99 }
    };
    for (const unidad of unidades) rutas["PUT orden/orden-prueba/producto/" + unidad.idOrdenProducto] = solicitud => {
        Object.assign(unidad, solicitud.cuerpo);
        return structuredClone(unidad);
    };
    return { ...simularApi(rutas), orden, unidades, leerOrden: () => structuredClone(orden) };
}
