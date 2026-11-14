import { cargarPlantilla } from "../plantilla/plantilla.js";
import { sesionEmpleado } from "../../../control/sesion_empleado.js";
import "../carrito_orden/carrito_orden.js";

const plantilla = await cargarPlantilla(new URL("./barra_superior.html", import.meta.url));

/** Presenta el acceso de empleados y conserva el carrito durante la navegación. */
export default class BarraSuperior extends HTMLElement {
    /** Compone la marca, los accesos de sesión, el control del menú y el carrito persistente. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });

        this.root.appendChild(plantilla.content.cloneNode(true));
        this.root.querySelector(".salir").onclick = () => sesionEmpleado.cerrar();
        this.root.querySelector(".abrir-menu").onclick = () => this.dispatchEvent(new CustomEvent("alternar-menu", { bubbles: true, composed: true }));
    }

    /** Actualiza la etiqueta accesible y el estado del botón de navegación. */
    actualizarMenu(abierto) {
        const boton = this.root.querySelector(".abrir-menu");
        boton.setAttribute("aria-expanded", String(abierto));
        boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
        boton.title = abierto ? "Cerrar menú" : "Abrir menú";
    }

    /** Muestra el carrito solo en Productos sin perder su contenido al navegar. */
    actualizarRuta(ruta) {
        const carrito = this.root.querySelector("orden-model");
        carrito.hidden = ruta !== "productos";
        if (carrito.hidden && carrito.dialogo?.open) carrito.dialogo.close();
    }

    /** Actualiza los accesos visibles a partir de la sesión del empleado. */
    actualizarSesion(sesion) {
        this.root.querySelector('a[href="#ingreso"]').hidden = Boolean(sesion);
        const usuario = this.root.querySelector(".usuario");
        usuario.hidden = !sesion;
        usuario.textContent = sesion ? `${sesion.empleado.nombre} ${sesion.empleado.apellido || ""}`.trim() : "";
        this.root.querySelector(".salir").hidden = !sesion;
    }

    /** Traslada al carrito el producto seleccionado en el catálogo. */
    agregar(producto) {
        this.root.querySelector("orden-model").agregar(producto);
    }
}
customElements.define("barra-superior", BarraSuperior);
