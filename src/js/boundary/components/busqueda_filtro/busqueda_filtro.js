import { cargarPlantilla } from "../plantilla/plantilla.js";
const plantilla = await cargarPlantilla(new URL("./busqueda_filtro.html", import.meta.url));

/** Prepara la consulta y el texto para comparar sin mayúsculas, tildes ni espacios exteriores. */
const normalizar = texto => String(texto || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Control de búsqueda reutilizable: la pantalla conserva sus datos y tarjetas. */
export default class BusquedaFiltro extends HTMLElement {
    /** Crea el filtro desplegable y conecta sus controles de entrada y cierre. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.boton = this.root.querySelector("button");
        this.entrada = this.root.querySelector("input");
        this.filtro = this.root.querySelector("#filtro");
        this.boton.onclick = () => this.alternar();
        this.entrada.oninput = () => this.notificar();
        this.entrada.onkeydown = evento => {
            if (evento.key === "Escape") {
                evento.preventDefault();
                evento.stopPropagation();
                this.alternar();
                this.boton.focus();
            }
        };
    }

    /** Declara los atributos que actualizan la presentación del componente. */
    static get observedAttributes() { return ["etiqueta", "placeholder", "disabled"]; }
    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() { this.actualizar(); }
    /** Sincroniza la vista cuando cambia un atributo observado. */
    attributeChangedCallback() { this.actualizar(); }

    /** Sincroniza los controles con el estado actual del componente. */
    actualizar() {
        const etiqueta = this.getAttribute("etiqueta") || "Buscar";
        this.root.querySelector("label").textContent = etiqueta;
        this.boton.setAttribute("aria-label", etiqueta);
        this.entrada.placeholder = this.getAttribute("placeholder") || etiqueta;
        this.boton.disabled = this.disabled;
        this.entrada.disabled = this.disabled;
    }

    /** Devuelve el texto escrito en el filtro. */
    get value() { return this.entrada.value; }
    /** Indica si la búsqueda está deshabilitada. */
    get disabled() { return this.hasAttribute("disabled"); }
    /** Habilita o deshabilita la búsqueda a través de su atributo público. */
    set disabled(valor) { this.toggleAttribute("disabled", Boolean(valor)); }

    /** Despliega el filtro o lo limpia al cerrar, conservando el manejo de foco. */
    alternar() {
        if (this.disabled) return;
        const abrir = this.filtro.hidden;
        this.filtro.hidden = !abrir;
        this.boton.setAttribute("aria-expanded", String(abrir));
        if (abrir) this.entrada.focus();
        else {
            this.entrada.value = "";
            this.notificar();
        }
    }

    /**
     * Comprueba que el texto contenga todas las palabras escritas, ignorando mayúsculas y tildes.
     * @param {string} texto Nombre o descripción sobre el que se busca.
     * @returns {boolean} Verdadero cuando todas las palabras coinciden o la consulta está vacía.
     */
    coincide(texto) {
        const palabras = normalizar(this.value).split(/\s+/).filter(Boolean);
        const contenido = normalizar(texto);
        return palabras.every(palabra => contenido.includes(palabra));
    }

    /** Emite el valor del filtro para que la pantalla actualice sus propios datos. */
    notificar() {
        this.dispatchEvent(new CustomEvent("busqueda-cambiada", {
            detail: { valor: this.value }, bubbles: true, composed: true
        }));
    }
}
customElements.define("busqueda-filtro", BusquedaFiltro);
