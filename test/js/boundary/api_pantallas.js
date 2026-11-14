import sinon from "../../lib/sinon/sinon-esm.js";

/**
 * Sustituye únicamente la frontera HTTP para integrar pantallas, componentes y DAO reales.
 * Ninguna petición de estas pruebas llega a PostgreSQL ni a los servicios reales.
 * @returns {object} Datos y llamadas disponibles para comprobar las operaciones de la pantalla.
 */
export function simularApiPantallas() {
    const idEmpleado = "11111111-1111-4111-8111-111111111111";
    const empleado = { idEmpleado, nombre: "Ana", apellido: "Gómez", activo: true };
    const categorias = [{ idTipoProducto: "bebidas", nombre: "Bebidas", activo: true },
        { idTipoProducto: "inactiva", nombre: "Categoría oculta", activo: false }];
    const productos = [{ idProducto: "latte12", nombre: "Latte", precioSugerido: 2, activo: true },
        { idProducto: "latte16", nombre: "Latte", precioSugerido: 3, activo: true },
        { idProducto: "te", nombre: "Té frío", precioSugerido: 1, activo: true }];
    const tipos = [{ idTipoCaracteristica: "volumen", nombre: "Volumen" }, { idTipoCaracteristica: "leche", nombre: "Tipo de leche" }];
    const caracteristicas = [{ idCaracteristica: "onzas", nombre: "Onzas", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "volumen" } },
        { idCaracteristica: "entera", nombre: "Leche entera", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } }];
    const llamadas = [];
    const peticion = sinon.stub(window, "fetch").callsFake(async (url, opciones = {}) => {
        const ruta = new URL(url, location.href).pathname.split("/resources/v1/")[1];
        if (!ruta) throw new Error("La prueba no esperaba solicitar un recurso externo a la API: " + url);
        const metodo = opciones.method || "GET";
        llamadas.push({ ruta, metodo, cuerpo: opciones.body && JSON.parse(opciones.body) });
        if (metodo !== "GET") throw new Error("Esta integración de lectura no permite escrituras: " + metodo + " " + ruta);
        let datos;
        if (ruta === "tipoProducto") datos = categorias;
        else if (ruta.startsWith("tipoProducto/")) datos = categorias.find(c => c.idTipoProducto === ruta.split("/")[1]);
        else if (ruta === "producto") datos = productos;
        else if (ruta === "caracteristica") datos = caracteristicas;
        else if (ruta === "tipoCaracteristica") datos = tipos;
        else if (/^producto\/[^/]+\/tipoproducto$/.test(ruta)) datos = [{ activo: true, idTipoProducto: { idTipoProducto: "bebidas" } }];
        else if (/^producto\/[^/]+\/caracteristica$/.test(ruta)) {
            const id = ruta.split("/")[1];
            datos = id.startsWith("latte") ? [{ idCaracteristica: { idCaracteristica: "onzas" }, valor: id.endsWith("12") ? "12" : "16" },
                ...(id.endsWith("12") ? [{ idCaracteristica: { idCaracteristica: "entera" }, valor: "1" }] : [])] : [];
        } else if (ruta === "empleado/" + idEmpleado) datos = empleado;
        else if (ruta === "empleado/" + idEmpleado + "/rol") datos = [{ idEmpleadoRol: "barista-web", activo: true, idRol: { idRol: "barista" } }];
        else if (ruta === "rol") datos = [{ idRol: "barista", nombre: "Barista", activo: true }];
        else throw new Error("Recurso no definido para esta prueba: " + ruta);
        return new Response(JSON.stringify(datos), { headers: { "Content-Type": "application/json", "Total-registros": String(Array.isArray(datos) ? datos.length : 1) } });
    });
    return { empleado, categorias, productos, llamadas, peticion };
}

/** Crea almacenamiento aislado para comprobar una sesión sin cambiar el navegador del usuario. */
export function almacenDePrueba() {
    const datos = new Map();
    return { getItem: clave => datos.get(clave) ?? null, setItem: (clave, valor) => datos.set(clave, valor), removeItem: clave => datos.delete(clave) };
}

