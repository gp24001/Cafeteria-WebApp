import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./pie_pagina.html", import.meta.url));

/** Pie reutilizable que identifica la aplicación sin recursos externos. */
export default class PiePagina extends HTMLElement {
    /** Encapsula el pie y sus estilos locales en Shadow DOM. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
    }
}
customElements.define("pie-pagina", PiePagina);
