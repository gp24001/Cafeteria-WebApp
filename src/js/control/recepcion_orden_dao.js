import OrdenDao from "./orden_dao.js";
import OrdenProductoDao from "./orden_producto_dao.js";
import FacturaDao from "./factura_dao.js";
import FacturaOrdenProductoDao from "./factura_orden_producto_dao.js";
import ProductoDao from "./producto_dao.js";
import { leerPreparacion, escribirPreparacion, ordenConPreparacion, leerPreparacionUnidad, escribirPreparacionUnidad, leerPresentacionUnidad } from "./preparacion_estado.js";

/** Separa cocina de caja usando las facturas vigentes y los estados de preparación. */
export default class RecepcionOrdenDao {
    /** Inicializa el estado y las dependencias de esta clase. */
    constructor() {
        this.ordenes = new OrdenDao();
        this.facturas = new FacturaDao();
        this.productos = new ProductoDao();
        this.relaciones = new Map();
        this.unidadesCerradas = new Map();
    }

    /** Relaciona estados de factura para distinguir unidades pagadas, vigentes y anuladas. */
    async sinPagar() {
        const [ordenes, facturas] = await Promise.all([this.ordenes.listarTodos(), this.facturas.listarTodos()]);
        const relaciones = await Promise.all(facturas.map(async factura => ({
            factura, unidades: await this.unidadesFacturadas(factura.idFactura)
        })));
        const unidadesFacturadas = new Set();
        const unidadesPagadas = new Set();
        const unidadesAnuladas = new Set();
        for (const { factura, unidades } of relaciones) {
            for (const unidad of unidades) {
                const id = unidad.idOrdenProducto?.idOrdenProducto;
                if (!id) continue;
                if (factura.estado === "ANULADA") { unidadesAnuladas.add(id); continue; }
                unidadesFacturadas.add(id);
                if (factura.estado === "PAGADA") unidadesPagadas.add(id);
            }
        }
        const detalle = await Promise.all(ordenes.map(async orden => {
            const anteriores = this.unidadesCerradas.get(orden.idOrden);
            const pagada = unidades => unidades.length && unidades.every(u => unidadesPagadas.has(u.idOrdenProducto));
            if (anteriores && pagada(anteriores)) return { ...orden, unidades: anteriores };
            const unidades = await new OrdenProductoDao(orden.idOrden).listarTodos();
            if (pagada(unidades)) this.unidadesCerradas.set(orden.idOrden, unidades);
            else this.unidadesCerradas.delete(orden.idOrden);
            return { ...orden, unidades };
        }));
        return detalle.filter(orden => orden.unidades.some(u => !unidadesPagadas.has(u.idOrdenProducto)))
            .map(orden => {
                const facturada = orden.unidades.some(u => unidadesFacturadas.has(u.idOrdenProducto));
                return { ...orden, facturada, anulada: !facturada && orden.unidades.some(u => unidadesAnuladas.has(u.idOrdenProducto)) };
            })
            .sort((a, b) => new Date(a.fechaOrden) - new Date(b.fechaOrden));
    }

    /** Reutiliza por un minuto los vínculos fijos, sin dejar de consultar el estado actual de cada factura. */
    async unidadesFacturadas(idFactura) {
        const anterior = this.relaciones.get(idFactura);
        if (anterior && anterior.vence > Date.now()) return anterior.unidades;
        const unidades = await new FacturaOrdenProductoDao(idFactura).listarTodos();
        this.relaciones.set(idFactura, { unidades, vence: Date.now() + 60000 });
        return unidades;
    }

    /** Devuelve las órdenes de cocina excluyendo anuladas, facturadas y despachadas. */
    async pendientes() {
        return (await this.sinPagar()).map(o => ordenConPreparacion(o, o.unidades))
            .filter(o => !o.anulada && !o.facturada && o.estadoPreparacion !== "DESPACHADA");
    }

    /** Devuelve órdenes que requieren pago, excluyendo las que solo tienen facturas anuladas. */
    async paraFacturacion() {
        return (await this.sinPagar()).map(o => ordenConPreparacion(o, o.unidades))
            .filter(o => !o.anulada && (o.facturada || o.estadoPreparacion === "DESPACHADA"));
    }

    /**
     * Actualiza estados usando los PUT existentes, preservando observaciones y detectando lecturas obsoletas.
     * @param {object} orden Instantánea seleccionada con su revisión de preparación.
     * @param {string} idEmpleadoRol Asignación activa de quien prepara la orden.
     * @param {string} accion PREPARAR, ITEM, TODOS_LISTOS o DESPACHAR.
     * @param {string|string[]} [idOrdenProducto] Una unidad o las unidades agrupadas por producto y presentación.
     * @param {boolean} [listo] Estado solicitado al marcar unidades con la acción ITEM.
     * @returns {Promise<object>} Orden y unidades confirmadas, con su nueva revisión solo en memoria.
     * @throws {Error|object} Lectura obsoleta, transición inválida o fallo de una operación REST.
     */
    async cambiarPreparacion(orden, idEmpleadoRol, accion, idOrdenProducto, listo) {
        if (!idEmpleadoRol) throw new Error("Inicia sesión con un rol de preparación.");
        const [actual, unidades] = await Promise.all([
            this.ordenes.findById(orden.idOrden), new OrdenProductoDao(orden.idOrden).listarTodos()
        ]);
        const datos = leerPreparacion(actual.observacion);
        const instantanea = ordenConPreparacion(actual, unidades);
        if (datos.estado === "DESPACHADA" && accion === "DESPACHAR") return ordenConPreparacion(actual, unidades);
        if (datos.estado === "DESPACHADA") throw new Error("La orden ya fue despachada.");
        if ((orden.revisionPreparacion && orden.revisionPreparacion !== instantanea.revisionPreparacion)
            || (datos.legado && datos.version !== (orden.versionPreparacion || 0)))
            throw new Error("La orden cambió en otra pantalla. Actualiza antes de continuar.");
        if (!unidades.length) throw new Error("La orden no contiene productos.");
        const ids = new Set(unidades.map(u => u.idOrdenProducto));
        const listos = new Set(instantanea.listos);
        if (accion === "PREPARAR") datos.estado = "EN_PREPARACION";
        else if (accion === "ITEM") {
            const seleccionados = Array.isArray(idOrdenProducto) ? idOrdenProducto : [idOrdenProducto];
            if (!seleccionados.length || !seleccionados.every(id => ids.has(id))) throw new Error("El ítem no pertenece a esta orden.");
            if (datos.estado !== "EN_PREPARACION") throw new Error("Marca primero la orden en preparación.");
            for (const id of seleccionados) {
                if (listo) listos.add(id); else listos.delete(id);
            }
        } else if (accion === "TODOS_LISTOS") {
            if (datos.estado !== "EN_PREPARACION") throw new Error("Marca primero la orden en preparación.");
            for (const id of ids) listos.add(id);
        } else if (accion === "DESPACHAR") {
            if (datos.estado !== "EN_PREPARACION" || !unidades.every(u => listos.has(u.idOrdenProducto)))
                throw new Error("Todos los ítems deben estar listos antes de despachar.");
            datos.estado = "DESPACHADA";
        } else throw new Error("La acción de preparación no es válida.");
        const detalle = new OrdenProductoDao(orden.idOrden);
        for (let indice = 0; indice < unidades.length; indice++) {
            const unidad = unidades[indice];
            const estado = leerPreparacionUnidad(unidad.observaciones).listo;
            const deseado = listos.has(unidad.idOrdenProducto);
            // Migrar el formato anterior sin perder avances si una petición falla a mitad.
            if (estado === deseado || (!datos.legado && estado === null && !deseado)) continue;
            unidades[indice] = await detalle.solicitarJson(`${detalle.URL}/${encodeURIComponent(unidad.idOrdenProducto)}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...unidad, observaciones: escribirPreparacionUnidad(unidad.observaciones, deseado) })
            });
        }
        const observacion = escribirPreparacion(actual.observacion, datos);
        let actualizado = actual;
        if (observacion !== actual.observacion) actualizado = await this.ordenes.solicitarJson(`${this.ordenes.URL}/${encodeURIComponent(orden.idOrden)}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actual, observacion })
        });
        return ordenConPreparacion(actualizado, unidades);
    }

    /**
     * Agrupa cantidades por producto, precio y presentación para mostrar el detalle de la orden.
     * @param {object} orden Orden con sus unidades y precios persistidos.
     * @returns {Promise<object[]>} Líneas de lectura con nombre, cantidad, precio y presentación original.
     */
    async detalle(orden) {
        const ids = [...new Set(orden.unidades.map(u => u.idProducto.idProducto))];
        const productos = await Promise.all(ids.map(id => this.productos.findById(id)));
        const nombres = new Map(productos.map(p => [p.idProducto, p.nombre]));
        const lineas = new Map();
        for (const unidad of orden.unidades) {
            const idProducto = unidad.idProducto.idProducto;
            const presentacion = leerPresentacionUnidad(unidad.observaciones);
            const clave = JSON.stringify([idProducto, unidad.precio, presentacion]);
            if (lineas.has(clave)) lineas.get(clave).cantidad++;
            else lineas.set(clave, {
                idProducto, nombre: nombres.get(idProducto) || "Producto", precio: unidad.precio,
                cantidad: 1, ...(presentacion ? { presentacion } : {})
            });
        }
        return [...lineas.values()];
    }
}
