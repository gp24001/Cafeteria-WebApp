import OrdenDao from "../../../control/orden_dao.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";
import "../resumen_orden/resumen_orden.js";

import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./carrito_orden.html", import.meta.url));

/** Conserva el carrito de la pestaña hasta que la API registra la orden y sus unidades. */
export default class CarritoOrden extends HTMLElement {
    /** Recupera el borrador de la pestaña y enlaza la edición y confirmación del carrito. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(document.importNode(plantilla.content, true));
        this.dao = new OrdenDao();
        this.dialogo = this.root.querySelector("dialog");
        this.resumen = this.root.querySelector("resumen-orden");
        this.form = this.root.querySelector("form");
        this.nombre = this.form.elements.cliente;
        this.botonPedir = this.root.querySelector("#pedir");
        this.revision = this.root.querySelector("#revision");
        this.botonEditar = this.root.querySelector("#editar");
        this.estado = this.root.querySelector("[role=status]");
        this.clave = "cafefe.carrito.v1";
        const guardado = this.recuperarBorrador();
        this.referencia = guardado.referencia || "";
        this.nombre.value = guardado.nombre || "";
        this.resumen.estado.lineas = guardado.lineas || [];
        this.enviando = false;
        this.revisando = false;
        this.root.querySelector("#abrir").onclick = () => {
            if (!this.resumen.estado.lineas.length) this.estado.textContent = "Tu carrito está vacío.";
            this.dialogo.showModal();
        };
        this.root.querySelector("#cerrar").onclick = () => this.dialogo.close();
        this.dialogo.addEventListener("close", () => { this.revisando = false; this.actualizar(); });
        this.botonEditar.onclick = () => {
            this.revisando = false;
            this.actualizar();
            this.botonPedir.focus();
        };
        this.root.querySelector("#confirmar").onclick = () => this.confirmar();
        this.form.onsubmit = e => {
            e.preventDefault();
            if (this.referencia) this.confirmar();
            else this.pedir();
        };
        const guardarCambios = () => {
            this.revisando = false;
            if (!this.limpiandoBorrador) this.persistir();
            this.actualizar();
        };
        this.nombre.oninput = guardarCambios;
        this.resumen.addEventListener("orden-actualizada", guardarCambios);
        this.actualizar();
    }

    /** Informa si el borrador local no pudo recuperarse, una vez que el aviso puede llegar a la aplicación. */
    connectedCallback() {
        if (this.errorBorrador) {
            notificar(this, "No se pudo recuperar el borrador guardado. Revisa el carrito antes de hacer un pedido.", "aviso");
            this.errorBorrador = false;
        }
    }

    /**
     * Lee el borrador propio y descarta una estructura dañada sin borrar el dato original.
     * @returns {object} Borrador recuperado, o un objeto vacío si su contenido no puede utilizarse.
     */
    recuperarBorrador() {
        try {
            const guardado = JSON.parse(sessionStorage.getItem(this.clave) || "{}");
            const lineas = guardado?.lineas ?? [];
            if (!guardado || typeof guardado !== "object" || Array.isArray(guardado)
                || !Array.isArray(lineas) || lineas.some(linea => !linea || typeof linea !== "object"
                    || typeof linea.idProducto !== "string" || typeof linea.nombre !== "string"
                    || !Number.isFinite(Number(linea.precio)) || Number(linea.precio) < 0
                    || !Number.isSafeInteger(linea.cantidad) || linea.cantidad < 1)
                || (guardado.nombre != null && typeof guardado.nombre !== "string")
                || (guardado.referencia != null && typeof guardado.referencia !== "string")) {
                throw new Error("El borrador del carrito no tiene una estructura válida.");
            }
            return guardado;
        } catch {
            this.errorBorrador = true;
            return {};
        }
    }

    /**
     * Incorpora la selección sin interrumpir la navegación por el catálogo.
     * @param {object} producto Producto o presentación con ID, precio y cantidad elegida.
     */
    agregar(producto) {
        if (this.referencia) {
            this.dialogo.showModal();
            return;
        }
        this.estado.textContent = "";
        this.resumen.agregar(producto, producto?.cantidad ?? 1);
    }

    /**
     * Guarda el borrador local y avisa si el navegador rechaza la escritura.
     * @returns {boolean} Confirma que el borrador puede recuperarse antes de enviar el pedido.
     */
    persistir() {
        try {
            sessionStorage.setItem(this.clave, JSON.stringify({
                nombre: this.nombre.value, referencia: this.referencia, lineas: this.resumen.estado.lineas
            }));
            this.errorPersistencia = false;
            return true;
        } catch {
            if (!this.errorPersistencia) notificar(this, "No se pudo guardar el carrito en esta pestaña. El pedido no se enviará hasta poder guardar el borrador.", "error");
            this.errorPersistencia = true;
            return false;
        }
    }

    /** Limpia un pedido ya registrado sin presentar una falla del almacenamiento como un error de envío. */
    limpiarBorrador() {
        this.referencia = "";
        this.nombre.value = "";
        this.limpiandoBorrador = true;
        try { this.resumen.estado.lineas = []; }
        finally { this.limpiandoBorrador = false; }
        try { sessionStorage.removeItem(this.clave); }
        catch { notificar(this, "El pedido se registró, pero no se pudo limpiar el borrador de esta pestaña.", "aviso"); }
    }

    /** Sincroniza los controles con el estado actual del componente. */
    actualizar() {
        const cantidad = this.resumen.estado.lineas.reduce((n, l) => n + l.cantidad, 0);
        this.root.querySelector("#abrir span").textContent = `Mi carrito (${cantidad})`;
        this.form.hidden = !cantidad;
        this.resumen.hidden = !cantidad;
        this.resumen.toggleAttribute("solo-lectura", Boolean(this.referencia));
        this.nombre.readOnly = Boolean(this.referencia);
        this.botonPedir.disabled = this.enviando;
        this.revision.hidden = !this.revisando;
        this.botonPedir.hidden = this.revisando;
        this.botonPedir.textContent = this.enviando ? "Registrando…" : (this.referencia ? "Reintentar pedido" : "Pedir");
        if (!cantidad && !this.estado.textContent) this.estado.textContent = "Tu carrito está vacío.";
    }

    /** Muestra la confirmación sin enviar el borrador a la API. */
    pedir() {
        if (this.referencia || !this.resumen.estado.lineas.length) return;
        this.nombre.value = this.nombre.value.trim();
        if (!this.nombre.value || !this.nombre.checkValidity()) {
            notificar(this, "Ingresa el nombre del cliente para confirmar el pedido.", "aviso");
            this.nombre.focus();
            return;
        }
        this.revisando = true;
        this.persistir();
        this.actualizar();
        this.botonEditar.focus();
    }

    /**
     * Envía la selección confirmada y conserva el borrador si falla la respuesta.
     * Un reintento usa la referencia original para recuperar lo ya registrado.
     */
    async confirmar() {
        if (this.enviando || (!this.revisando && !this.referencia) || !this.resumen.estado.lineas.length) return;
        this.revisando = false;
        this.enviando = true;
        const reintento = Boolean(this.referencia);
        let borradorGuardado = false;
        try {
            this.referencia ||= crypto.randomUUID();
            if (!this.persistir()) {
                if (!reintento) this.referencia = "";
                return;
            }
            borradorGuardado = true;
            this.estado.textContent = "Registrando tu pedido…";
            this.actualizar();
            const id = await this.dao.registrarPedido({
                referencia: this.referencia, nombre: this.nombre.value, lineas: this.resumen.estado.lineas
            }, reintento);
            notificar(this, "Pedido registrado correctamente. Número de orden: " + id + ".", "exito");
            this.estado.textContent = "Tu carrito está vacío, listo para tu siguiente pedido.";
            this.limpiarBorrador();
        } catch (error) {
            this.estado.textContent = "";
            const borrador = borradorGuardado ? " Tu carrito está guardado." : " El pedido no se envió; el carrito permanece en esta pestaña.";
            notificar(this, (error.mensaje || error.message || "No se pudo completar el pedido.") + borrador, "error");
        } finally {
            this.enviando = false;
            this.actualizar();
        }
    }
}
customElements.define("orden-model", CarritoOrden);
