import { vistas } from "../../../control/vistas.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./menu_lateral.html", import.meta.url));

/** Barra lateral y menú adaptable a pantallas pequeñas. */
export default class MenuLateral extends HTMLElement {
    /** Construye la navegación pública y el control que abre o contrae la barra lateral. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.retraer = this.root.querySelector(".retraer");
        this.retraer.onclick = () => this.establecerAbierto(this.hasAttribute("retraido"));
        this.navegacion = this.root.querySelector("nav");
        for (const ruta of ["inicio", "productos"]) {
            this.navegacion.appendChild(this.crearEnlace(ruta));
        }
    }

    /** Abre o cierra la navegación y notifica el estado al componente principal. */
    establecerAbierto(abierto) {
        const retraido = !abierto;
        this.toggleAttribute("retraido", retraido);
        this.retraer.setAttribute("aria-expanded", String(!retraido));
        const etiqueta = retraido ? "Expandir barra lateral" : "Contraer barra lateral";
        this.retraer.setAttribute("aria-label", etiqueta);
        this.retraer.title = etiqueta;
        this.dispatchEvent(new CustomEvent("menu-retraido", {
            detail: { retraido }, bubbles: true, composed: true
        }));
    }

    /** Construye el enlace de navegación con el título de su sección. */
    crearEnlace(ruta) {
        const enlace = this.root.querySelector("#enlace-navegacion").content.firstElementChild.cloneNode(true);
        enlace.href = "#" + ruta;
        enlace.title = vistas[ruta].titulo;
        enlace.setAttribute("aria-label", vistas[ruta].titulo);
        enlace.querySelector(".titulo").textContent = vistas[ruta].titulo;
        return enlace;
    }

    /** Muestra Inicio y las áreas que corresponden a la sesión actual. */
    actualizarSesion(sesion) {
        const rutas = ["inicio", ...["productos", "preparacion", "pagos"].filter(ruta => sesion.puedeAcceder(ruta))];
        this.navegacion.replaceChildren();
        for (const ruta of rutas) {
            this.navegacion.appendChild(this.crearEnlace(ruta));
        }
    }

    /** Marca la sección activa y cierra el menú móvil. */
    seleccionar(ruta) {
        for (const enlace of this.navegacion.children) {
            if (enlace.hash === "#" + ruta) enlace.setAttribute("aria-current", "page");
            else enlace.removeAttribute("aria-current");
        }
        if (window.matchMedia("(max-width: 700px)").matches) this.establecerAbierto(false);
    }
}
customElements.define("menu-lateral", MenuLateral);
