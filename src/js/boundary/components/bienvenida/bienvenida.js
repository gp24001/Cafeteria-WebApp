import { sesionEmpleado } from "../../../control/sesion_empleado.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./bienvenida.html", import.meta.url));
const areas = { productos: "Ver productos", preparacion: "Recepción de órdenes", pagos: "Ir a pagos" };

/** Presenta la bienvenida pública o los accesos permitidos de la sesión actual. */
export default class Bienvenida extends HTMLElement {
    /** Compone la bienvenida con su plantilla local y la sesión compartida. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.sesion = sesionEmpleado;
    }

    /** Representa la sesión al incorporarse la pantalla al documento. */
    connectedCallback() { this.mostrar(); }

    /** Actualiza nombre, roles y enlaces usando texto, sin insertar datos como HTML. */
    mostrar() {
        const actual = this.sesion.actual;
        const nombre = this.root.querySelector(".nombre");
        const roles = this.root.querySelector(".roles");
        nombre.hidden = roles.hidden = !actual;
        nombre.textContent = actual ? `${actual.empleado.nombre} ${actual.empleado.apellido || ""}`.trim() : "";
        roles.textContent = actual ? actual.roles.map(rol => rol.nombre).join(" · ") : "";
        this.root.querySelector(".eyebrow").textContent = actual ? "Tu espacio de trabajo" : "Tu pausa de cada día";
        this.root.querySelector(".mensaje").textContent = actual
            ? "Todo listo para comenzar. Elige tu área de trabajo."
            : "¡Bienvenido a nuestra cafetería! Elige tus favoritos, haz tu pedido en línea y pasa a recogerlo. ¡Te esperamos!";
        const acciones = this.root.querySelector(".acciones");
        acciones.replaceChildren();
        for (const ruta of (actual ? this.sesion.rutas() : ["productos"])) {
            if (!areas[ruta]) continue;
            const enlace = document.createElement("a");
            enlace.href = "#" + ruta;
            enlace.textContent = areas[ruta];
            acciones.appendChild(enlace);
        }
    }
}
customElements.define("inicio-model", Bienvenida);
