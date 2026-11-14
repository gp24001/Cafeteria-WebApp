import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./tarjeta_simple.html", import.meta.url));

/** Tarjeta reutilizable que distribuye el contenido de sus tres slots. */
export default class TarjetaSimple extends HTMLElement {
    /** Crea la raíz Shadow DOM que contendrá la estructura reutilizable. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
    }

    /** Construye la tarjeta una sola vez, incluso si se vuelve a conectar. */
    connectedCallback() {
        if (this.root.hasChildNodes()) return;
        this.root.appendChild(plantilla.content.cloneNode(true));
    }
}
customElements.define("tarjeta-simple", TarjetaSimple);

