import "../tarjeta_simple/tarjeta_simple.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./tarjeta_tipo_producto.html", import.meta.url));

/** Selecciona exclusivamente una ilustración local según el nombre de la categoría. */
export function ilustracionCategoria(categoria) {
    const nombre = (categoria?.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    /**Pone una imagen local para cada tipo producto por ejemplo: [/comida/, "comida"] */
    const ilustraciones = [
        [/bebidas calientes/, "bebidacaliente"],
        [/bebidas frias/, "bebidafria"],
        [/postre/, "postre"], 
        [/comida/, "comida"]];
    return ilustraciones.find(([patron]) => patron.test(nombre))?.[1] || "categoria";
}

/** Presenta una categoría del catálogo dentro de una tarjeta simple. */
export default class TarjetaTipoProducto extends HTMLElement {
    /** Compone la tarjeta reutilizable con nombre, ilustración local y acción de selección. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.tarjeta = this.root.querySelector("tarjeta-simple");
        this.titulo = this.root.querySelector("h3");
        this.imagen = this.root.querySelector("img");
        this.seleccionar = this.root.querySelector("button");
        this.seleccionar.addEventListener("click", () => {
            if (this.hasAttribute("seleccionable") && this.tipoProducto?.activo) {
                this.dispatchEvent(new CustomEvent("seleccionar-categoria", {
                    detail: this.tipoProducto, bubbles: true, composed: true
                }));
            }
        });
        this.tarjeta.addEventListener("click", evento => {
            if (!evento.composedPath().includes(this.seleccionar) && !this.seleccionar.hidden) {
                this.seleccionar.click();
            }
        });
    }

    /**
     * Recibe la categoría consultada y actualiza su tarjeta si ya está conectada.
     * @param {object} registro Categoría con nombre y estado activo.
     */
    set tipoProducto(registro) {
        this._tipoProducto = registro;
        if (this.isConnected) this.mostrar();
    }

    /** Devuelve la categoría representada por la tarjeta. */
    get tipoProducto() {
        return this._tipoProducto;
    }

    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() {
        this.mostrar();
    }

    /** Actualiza los nodos asignados a los slots cuando cambia la categoría. */
    mostrar() {
        const categoria = this.tipoProducto;
        this.seleccionar.hidden = !this.hasAttribute("seleccionable");
        this.seleccionar.disabled = !categoria?.activo;
        this.seleccionar.setAttribute("aria-label", "Ver productos de " + (categoria?.nombre || "la categoría"));
        this.titulo.textContent = categoria?.nombre ?? "";
        this.hidden = !categoria?.activo;
        const archivo = ilustracionCategoria(categoria);
        const respaldo = new URL(`../../../../resources/imagenes/${archivo}.png`, import.meta.url).href;
        this.imagen.alt = categoria?.nombre || "Categoría";
        if (this.imagen.src !== respaldo) this.imagen.src = respaldo;
    }
}
customElements.define("tarjeta-tipo-producto", TarjetaTipoProducto);
