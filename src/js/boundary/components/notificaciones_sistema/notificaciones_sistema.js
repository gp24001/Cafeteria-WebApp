import { cargarPlantilla } from "../plantilla/plantilla.js";
const tipos = {
    error: { titulo: "Error", icono: "!", duracion: 12000, urgente: true },
    aviso: { titulo: "Atención", icono: "!", duracion: 9000, urgente: true },
    exito: { titulo: "Listo", icono: "✓", duracion: 5000, urgente: false },
    info: { titulo: "Información", icono: "i", duracion: 6000, urgente: false }
};

/**
 * Solicita una notificación al contenedor de la aplicación sin acoplar la vista al componente visual.
 * @param {HTMLElement} origen Componente que informa el resultado de una operación.
 * @param {string} mensaje Texto de la notificación, nunca interpretado como HTML.
 * @param {"error"|"exito"|"aviso"|"info"} tipo Tipo de información que se presentará.
 * @returns {CustomEvent} Evento emitido para que el contenedor decida cómo presentarlo.
 */
export function notificar(origen, mensaje, tipo = "info") {
    const raiz = origen.getRootNode();
    const dialogo = origen.shadowRoot?.querySelector("dialog:modal") || origen.closest("dialog:modal")
        || (raiz instanceof ShadowRoot ? raiz.querySelector("dialog:modal") : null);
    const detail = { mensaje, tipo };
    if (dialogo) detail.dialogo = dialogo;
    const evento = new CustomEvent("notificar", { detail, bubbles: true, composed: true });
    origen.dispatchEvent(evento);
    return evento;
}

const plantilla = await cargarPlantilla(new URL("./notificaciones_sistema.html", import.meta.url));

/** Presenta avisos propios, temporales y accesibles sin modificar el foco ni el contenido de las pantallas. */
export default class NotificacionesSistema extends HTMLElement {
    /** Crea el contenedor y el registro de avisos con sus temporizadores. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.lista = this.root.querySelector("section");
        this.avisos = new Map();
        this.siguienteId = 0;
        this.hogar = null;
        this.dialogo = null;
        this.alCerrarDialogo = evento => { if (evento.currentTarget === this.dialogo) this.ubicar(); };
    }

    /** Habilita la capa superior nativa para que los avisos se vean también sobre los diálogos. */
    connectedCallback() {
        if (this.moviendo) return;
        if (!this.hogar) this.hogar = { padre: this.parentNode, siguiente: this.nextSibling };
        this.setAttribute("popover", "manual");
        if (this.avisos.size) this.abrir();
    }

    /** Cancela todos los temporizadores y retira los avisos al desmontar el componente. */
    disconnectedCallback() {
        if (this.moviendo) return;
        for (const aviso of this.avisos.values()) clearTimeout(aviso.temporizador);
        this.avisos.clear();
        this.lista.replaceChildren();
        this.desvincularDialogo();
    }

    /**
     * Añade un aviso sin duplicar otro idéntico activo; mantiene como máximo tres.
     * @param {{mensaje: string, tipo?: "error"|"exito"|"aviso"|"info", dialogo?: HTMLDialogElement}} datos Texto, tipo y diálogo que originó el aviso.
     * @returns {number|null} Identificador del aviso, o nulo cuando el mensaje está vacío.
     */
    mostrar({ mensaje, tipo = "info", dialogo }) {
        const texto = String(mensaje ?? "").trim();
        if (!texto) return null;
        this.ubicar(dialogo);
        const clase = Object.hasOwn(tipos, tipo) ? tipo : "info";
        const repetido = [...this.avisos.entries()].find(([, aviso]) => aviso.mensaje === texto && aviso.tipo === clase);
        if (repetido) { this.programarCierre(repetido[0]); return repetido[0]; }
        if (this.avisos.size === 3) this.cerrar(this.avisos.keys().next().value);
        const id = ++this.siguienteId, configuracion = tipos[clase];
        const nodo = this.root.querySelector("#aviso").content.firstElementChild.cloneNode(true);
        nodo.className = "notificacion " + clase;
        nodo.setAttribute("role", configuracion.urgente ? "alert" : "status");
        nodo.setAttribute("aria-live", configuracion.urgente ? "assertive" : "polite");
        nodo.setAttribute("aria-atomic", "true");
        nodo.querySelector(".icono").textContent = configuracion.icono;
        nodo.querySelector("strong").textContent = configuracion.titulo;
        nodo.querySelector("p").textContent = texto;
        const boton = nodo.querySelector("button");
        boton.setAttribute("aria-label", "Cerrar notificación: " + configuracion.titulo);
        boton.onclick = () => this.cerrar(id);
        nodo.onpointerenter = () => this.pausar(id);
        nodo.onpointerleave = () => this.programarCierre(id);
        nodo.addEventListener("focusin", () => this.pausar(id));
        nodo.addEventListener("focusout", evento => { if (!nodo.contains(evento.relatedTarget)) this.programarCierre(id); });
        this.avisos.set(id, { nodo, mensaje: texto, tipo: clase, duracion: configuracion.duracion });
        this.lista.appendChild(nodo);
        this.abrir();
        this.programarCierre(id);
        return id;
    }

    /** Sitúa las notificaciones en la capa superior sin abrir un modal ni enfocar sus controles. */
    abrir() {
        if (this.isConnected && typeof this.showPopover === "function" && !this.matches(":popover-open")) this.showPopover();
    }

    /**
     * Coloca los avisos dentro del diálogo modal para que sus botones no hereden inercia.
     * Cuando el diálogo se cierra, devuelve el mismo componente a su ubicación original.
     * @param {HTMLDialogElement} [dialogo] Diálogo local de la vista que solicita la notificación.
     */
    ubicar(dialogo) {
        const modal = dialogo?.matches("dialog:modal") ? dialogo
            : (this.dialogo?.matches("dialog:modal") ? this.dialogo : null);
        if (modal !== this.dialogo) {
            this.desvincularDialogo();
            this.dialogo = modal;
            modal?.addEventListener("close", this.alCerrarDialogo);
        }
        const destino = modal || this.hogar?.padre;
        if (!destino?.isConnected || this.parentNode === destino) return;
        const siguiente = !modal && this.hogar.siguiente?.parentNode === destino ? this.hogar.siguiente : null;
        const foco = this.root.activeElement;
        this.moviendo = true;
        try {
            if (this.matches(":popover-open")) this.hidePopover();
            destino.insertBefore(this, siguiente);
        } finally { this.moviendo = false; }
        if (this.avisos.size) this.abrir();
        if (foco?.isConnected) foco.focus({ preventScroll: true });
    }

    /** Retira el único listener del diálogo y deja libre su referencia. */
    desvincularDialogo() {
        this.dialogo?.removeEventListener("close", this.alCerrarDialogo);
        this.dialogo = null;
    }

    /** Detiene la caducidad mientras se lee o se usa un aviso. */
    pausar(id) {
        const aviso = this.avisos.get(id);
        if (aviso) clearTimeout(aviso.temporizador);
    }

    /** Reinicia el plazo de un aviso, conservándolo mientras el ratón o el foco estén dentro. */
    programarCierre(id) {
        const aviso = this.avisos.get(id);
        if (!aviso) return;
        clearTimeout(aviso.temporizador);
        if (aviso.nodo.matches(":hover") || aviso.nodo.contains(this.root.activeElement)) return;
        aviso.temporizador = setTimeout(() => this.cerrar(id), aviso.duracion);
    }

    /** Retira únicamente el aviso indicado y libera su temporizador. */
    cerrar(id) {
        const aviso = this.avisos.get(id);
        if (!aviso) return;
        clearTimeout(aviso.temporizador);
        aviso.nodo.remove();
        this.avisos.delete(id);
        if (!this.avisos.size && typeof this.hidePopover === "function" && this.matches(":popover-open")) this.hidePopover();
    }
}
customElements.define("notificaciones-sistema", NotificacionesSistema);
