import RecepcionOrdenDao from "../control/recepcion_orden_dao.js";
import { sesionEmpleado } from "../control/sesion_empleado.js";
import ActualizacionAutomatica from "../control/actualizacion_automatica.js";
import { actualizarTexto } from "./components/lista_dinamica/lista_dinamica.js";
import { notificar } from "./components/notificaciones_sistema/notificaciones_sistema.js";
import "./components/resumen_orden/resumen_orden.js";
import "./components/items_preparacion/items_preparacion.js";

import { cargarPlantilla } from "./components/plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./components/bandeja_ordenes/bandeja_ordenes.html", import.meta.url));
const filaOrden = plantilla.content.querySelector("#fila-orden");

/** Obtiene la descripción del cliente sin mostrar la referencia interna del pedido. */
const descripcion = orden => (orden.observacion || "").split(" · Pedido web ")[0].trim() || "Pedido del establecimiento";
/** Formatea la fecha recibida de la API y omite valores no interpretables. */
const fecha = valor => {
    const date = new Date(valor);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const estados = { PENDIENTE: "Pendiente", EN_PREPARACION: "En preparación", DESPACHADA: "Despachada" };

/** Consulta órdenes sin pagar y reutiliza el resumen de productos en modo de lectura. */
export default class OrdenModel extends HTMLElement {
    /** Crea la bandeja, el detalle y los eventos de preparación sin registrar cambios. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        customElements.upgrade(this.root);
        this.dao = new RecepcionOrdenDao();
        this.sesion = sesionEmpleado;
        this.estado = this.root.querySelector(".estado");
        this.lista = this.root.querySelector(".lista-ordenes");
        this.resumen = this.root.querySelector("resumen-orden");
        this.actualizacion = new ActualizacionAutomatica(() => this.sincronizar());
        this.items = this.root.querySelector("items-preparacion");
        this.root.querySelector(".preparar").onclick = () => this.cambiar("PREPARAR");
        this.root.querySelector(".despachar").onclick = () => this.cambiar("DESPACHAR");
        this.root.querySelector(".todos-listos").onclick = () => this.cambiar("TODOS_LISTOS");
        this.items.addEventListener("cambiar-item", e => this.cambiar("ITEM", e.detail.idOrdenProducto, e.detail.listo));
    }

    /** Determina el área de acceso de la bandeja de cocina o caja. */
    get permiso() { return this.facturacion ? "pagos" : "preparacion"; }
    /** Obtiene la asignación activa correspondiente al área de trabajo. */
    get responsable() {
        const nombres = this.facturacion ? ["cajero", "cajera"] : ["barista", "cocinero", "cocinera"];
        return this.sesion.actual?.roles?.find(r => nombres.includes(r.nombre.trim().toLowerCase()))?.idEmpleadoRol;
    }

    /**
     * Presenta los ítems y las acciones según el estado de la orden seleccionada.
     * @param {object} orden Orden con unidades, estado de preparación e ítems listos.
     * @param {object[]} lineas Productos agrupados por presentación y precio.
     */
    mostrarPreparacion(orden, lineas) {
        const enCaja = Boolean(this.facturacion);
        this.items.hidden = enCaja;
        this.items.datos = { orden, lineas };
        this.root.querySelector(".acciones-preparacion").hidden = enCaja;
        this.root.querySelector(".estado-preparacion").textContent = estados[orden.estadoPreparacion || "PENDIENTE"];
        this.root.querySelector(".preparar").hidden = orden.estadoPreparacion === "EN_PREPARACION";
        this.root.querySelector(".despachar").hidden = enCaja;
        this.root.querySelector(".todos-listos").hidden = enCaja;
        this.root.querySelector(".ayuda-despacho").hidden = enCaja;
        this.root.querySelector(".resumen-lectura").hidden = false;
        this.bloquear(false);
    }

    /** Habilita o deshabilita controles durante el guardado y valida la disponibilidad del despacho. */
    bloquear(guardando) {
        this.guardando = guardando;
        this.root.querySelector(".preparar").disabled = guardando;
        for (const boton of this.lista.children) boton.disabled = guardando;
        this.items.disabled = guardando;
        const orden = this.seleccionada;
        const listos = new Set(orden?.listos || []);
        this.root.querySelector(".todos-listos").disabled = guardando || orden?.estadoPreparacion !== "EN_PREPARACION"
            || !orden?.unidades.length || orden.unidades.every(u => listos.has(u.idOrdenProducto));
        this.root.querySelector(".despachar").disabled = guardando || orden?.estadoPreparacion !== "EN_PREPARACION"
            || !orden?.unidades.length || !orden.unidades.every(u => listos.has(u.idOrdenProducto));
    }

    /** Guarda la acción de preparación y vuelve a consultar la orden si ocurre un error. */
    async cambiar(accion, idOrdenProducto, listo) {
        if (this.guardando || this.facturacion || !this.seleccionada || !this.responsable || !this.sesion.puedeAcceder("preparacion")) return;
        const estado = this.root.querySelector(".estado-detalle");
        this.bloquear(true);
        try {
            const orden = await this.dao.cambiarPreparacion(this.seleccionada, this.responsable, accion, idOrdenProducto, listo);
            if (!this.isConnected) return;
            this.guardando = false;
            if (orden.estadoPreparacion === "DESPACHADA") {
                this.ordenes = (this.ordenes || []).filter(o => o.idOrden !== orden.idOrden);
                this.limpiarDetalle(); this.representarOrdenes(this.ordenes);
                notificar(this, "Orden despachada correctamente.", "exito");
            } else {
                this.seleccionada = orden;
                this.mostrarPreparacion(orden, this.lineas);
                const tarjeta = Array.from(this.lista.children).find(b => b.dataset.id === orden.idOrden);
                if (tarjeta) tarjeta.querySelector(".estado-orden").textContent = estados[orden.estadoPreparacion];
                estado.textContent = "";
            }
        } catch (error) {
            if (!this.isConnected) return;
            this.guardando = false;
            // Releer ante errores de red o conflictos: la respuesta pudo perderse después de guardar.
            await this.cargar();
            notificar(this, (error.mensaje || error.message || "No se pudo guardar el cambio.") + " Se consultó nuevamente el estado de la orden.", "error");
        } finally { if (this.isConnected) this.bloquear(false); }
    }

    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() { this.actualizacion.iniciar(); return this.cargar(); }
    /** Libera los eventos o invalida consultas pendientes al retirar el componente. */
    disconnectedCallback() { this.actualizacion.detener(); this.consulta = null; this.consultaDetalle = null; }

    /** Actualiza la bandeja sin reiniciar el formulario de pago ni interrumpir escrituras. */
    async sincronizar() {
        if (this.guardando || this.cargando || !this.sesion.puedeAcceder(this.permiso)) return;
        const consulta = this.consulta;
        let ordenes;
        try {
            ordenes = this.facturacion ? await this.dao.paraFacturacion(this.responsable) : await this.dao.pendientes(this.responsable);
        } catch (error) {
            if (this.isConnected && consulta === this.consulta) this.notificarErrorConsulta(error);
            throw error;
        }
        if (!this.isConnected || consulta !== this.consulta || this.guardando) return;
        this.errorConsulta = "";
        let cambio = JSON.stringify(ordenes) !== JSON.stringify(this.ordenes);
        if (cambio) {
            const anterior = this.seleccionada;
            this.ordenes = ordenes;
            this.representarOrdenes(ordenes);
            const seleccion = ordenes.find(o => o.idOrden === anterior?.idOrden);
            if (seleccion && !this.facturacion && JSON.stringify(seleccion) !== JSON.stringify(anterior)) await this.seleccionar(seleccion, true);
            if (anterior && !seleccion && !(this.facturacion && (this.cobro?.datos?.factura || this.cobro?.anulada))) {
                this.limpiarDetalle(); this.representarOrdenes(ordenes);
            }
        }
        if (this.facturacion && this.seleccionada && !this.cobro.hidden && !this.cobro.anulada && this.cobro.datos?.saldo !== 0)
            cambio = await this.cobro.recargar(true) || cambio;
        if (this.facturacion && this.seleccionada && !this.cobro.anulada && this.cobro.datos?.factura?.estado === "ANULADA") {
            this.limpiarDetalle(); this.representarOrdenes(this.ordenes);
        }
        return cambio;
    }

    /** Notifica una falla de consulta sin repetir el mismo aviso durante cada sondeo fallido. */
    notificarErrorConsulta(error) {
        const mensaje = (error.mensaje || error.message || "No se pudieron cargar las órdenes.") + " Se reintentará automáticamente.";
        if (this.errorConsulta !== mensaje) notificar(this, mensaje, "error");
        this.errorConsulta = mensaje;
    }

    /** Limpia el detalle y vuelve al estado inicial de selección sin alterar las órdenes. */
    limpiarDetalle() {
        this.consultaDetalle = null;
        this.seleccionada = null;
        this.lineas = [];
        this.resumen.estado.lineas = [];
        this.resumen.hidden = true;
        for (const selector of ["items-preparacion", ".acciones-preparacion", ".todos-listos", ".despachar", ".ayuda-despacho", ".resumen-lectura"]) this.root.querySelector(selector).hidden = true;
        this.root.querySelector("#titulo-orden").textContent = "Selecciona una orden";
        this.root.querySelector(".cliente").textContent = "";
        this.root.querySelector(".fecha").textContent = "";
        this.root.querySelector(".estado-detalle").textContent = "";
        this.root.querySelector(".detalle-orden").setAttribute("aria-busy", "false");
    }

    /** Consulta los datos de la vista, informa errores y descarta respuestas obsoletas. */
    async cargar() {
        if (!this.sesion.actual || !this.sesion.puedeAcceder(this.permiso)) {
            notificar(this, "Inicia sesión con un rol de barista o cocinero para consultar las órdenes.", "aviso");
            return;
        }
        const consulta = this.consulta = Symbol();
        const anterior = this.seleccionada?.idOrden;
        this.limpiarDetalle();
        this.lista.replaceChildren();
        this.estado.textContent = "Cargando órdenes pendientes…";
        this.cargando = true;
        try {
            const ordenes = this.facturacion ? await this.dao.paraFacturacion(this.responsable) : await this.dao.pendientes(this.responsable);
            if (consulta !== this.consulta) return;
            this.errorConsulta = "";
            this.ordenes = ordenes;
            this.representarOrdenes(ordenes);
            const seleccion = ordenes.find(o => o.idOrden === anterior);
            if (seleccion) await this.seleccionar(seleccion);
        } catch (error) {
            if (consulta === this.consulta) {
                this.estado.textContent = "";
                this.notificarErrorConsulta(error);
            }
        } finally {
            if (consulta === this.consulta) this.cargando = false;
        }
    }

    /**
     * Representa la cola conservando sus nodos, la selección y el desplazamiento.
     * @param {object[]} ordenes Órdenes en el orden que deben aparecer en la bandeja.
     */
    representarOrdenes(ordenes) {
        const desplazamiento = this.lista.scrollTop;
        const anteriores = new Map(Array.from(this.lista.children, boton => [boton.dataset.id, boton]));
        for (const [indice, orden] of ordenes.entries()) {
            const boton = anteriores.get(orden.idOrden) || document.createElement("button");
            anteriores.delete(orden.idOrden);
            boton.type = "button";
            boton.className = "orden";
            boton.dataset.id = orden.idOrden;
            const seleccionada = String(this.seleccionada?.idOrden === orden.idOrden);
            if (boton.getAttribute("aria-pressed") !== seleccionada) boton.setAttribute("aria-pressed", seleccionada);
            const revision = JSON.stringify([orden.observacion, orden.fechaOrden, orden.unidades.length, orden.estadoPreparacion]);
            if (boton.revision !== revision) {
                if (!boton.children.length) boton.appendChild(filaOrden.content.cloneNode(true));
                actualizarTexto(boton.children[0], "Orden #" + orden.idOrden.slice(0, 8));
                actualizarTexto(boton.children[1], descripcion(orden));
                actualizarTexto(boton.children[2], `${fecha(orden.fechaOrden)} · ${orden.unidades.length} ${orden.unidades.length === 1 ? "unidad" : "unidades"}`);
                actualizarTexto(boton.children[3], this.facturacion ? "Pendiente de pago" : estados[orden.estadoPreparacion || "PENDIENTE"]);
                boton.revision = revision;
            }
            boton.onclick = () => this.seleccionar(orden);
            if (this.lista.children[indice] !== boton) this.lista.insertBefore(boton, this.lista.children[indice] || null);
        }
        for (const boton of anteriores.values()) boton.remove();
        const cantidad = ordenes.length;
        if (this.facturacion && !this.seleccionada) this.root.querySelector("#titulo-orden").textContent = cantidad ? "Selecciona una orden" : "No hay órdenes pendientes de pago";
        this.estado.textContent = this.facturacion
            ? (cantidad ? `${cantidad} ${cantidad === 1 ? "orden pendiente de pago" : "órdenes pendientes de pago"}` : "No hay órdenes pendientes de pago.")
            : (cantidad ? `${cantidad} ${cantidad === 1 ? "orden en recepción" : "órdenes en recepción"}` : "No hay órdenes pendientes de preparación.");
        this.lista.scrollTop = desplazamiento;
    }

    /**
     * Selecciona una orden y descarta respuestas antiguas de otras selecciones.
     * @param {object} orden Orden cuyo detalle se consultará.
     * @param {boolean} silenciosa Conserva el panel visible durante el sondeo automático.
     */
    async seleccionar(orden, silenciosa = false) {
        if (this.guardando || !this.sesion.actual || !this.sesion.puedeAcceder(this.permiso)) return;
        const consulta = this.consultaDetalle = Symbol();
        const anterior = this.seleccionada;
        if (!silenciosa) this.seleccionada = orden;
        for (const boton of this.lista.children) boton.setAttribute("aria-pressed", String(boton.dataset.id === orden.idOrden));
        this.root.querySelector("#titulo-orden").textContent = "Orden #" + orden.idOrden.slice(0, 8);
        this.root.querySelector(".cliente").textContent = descripcion(orden);
        this.root.querySelector(".fecha").textContent = fecha(orden.fechaOrden);
        const estado = this.root.querySelector(".estado-detalle");
        const panel = this.root.querySelector(".detalle-orden");
        if (!silenciosa) {
            panel.setAttribute("aria-busy", "true");
            this.resumen.hidden = true;
            for (const selector of ["items-preparacion", ".acciones-preparacion", ".todos-listos", ".despachar", ".ayuda-despacho", ".resumen-lectura"]) this.root.querySelector(selector).hidden = true;
            this.root.querySelector(".resumen-lectura").open = false;
            estado.textContent = "Cargando productos de la orden…";
        }
        try {
            const lineas = await this.dao.detalle(orden);
            if (consulta !== this.consultaDetalle) return;
            if (silenciosa && (this.guardando || this.seleccionada !== anterior)) return;
            this.seleccionada = orden;
            if (JSON.stringify(this.lineas) !== JSON.stringify(lineas)) this.resumen.estado.lineas = lineas;
            this.lineas = lineas;
            this.resumen.hidden = false;
            this.mostrarPreparacion(orden, lineas);
            estado.textContent = "";
        } catch (error) {
            if (consulta === this.consultaDetalle) {
                estado.textContent = "";
                notificar(this, error.mensaje || error.message || "No se pudieron cargar los productos. Selecciona la orden para reintentar.", "error");
            }
        } finally {
            if (!silenciosa && consulta === this.consultaDetalle) panel.setAttribute("aria-busy", "false");
        }
    }
}
customElements.define("preparacion-model", OrdenModel);
