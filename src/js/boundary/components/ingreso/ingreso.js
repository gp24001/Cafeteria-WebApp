import { sesionEmpleado } from "../../../control/sesion_empleado.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./ingreso.html", import.meta.url));

/** Ingreso por nombre y UUID de empleado, usando únicamente la API existente. */
export default class Ingreso extends HTMLElement {
    /** Construye el formulario y conecta su envío con la sesión del empleado. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.sesion = sesionEmpleado;
        this.form = this.root.querySelector("form");
        this.estado = this.root.querySelector("[role=status]");
        this.form.onsubmit = evento => { evento.preventDefault(); this.ingresar(); };
        this.root.querySelector(".volver-cliente").onclick = evento => this.continuarComoCliente(evento);
    }

    /** Abre la bienvenida pública y cancela una sesión de empleado o un ingreso aún pendiente. */
    continuarComoCliente(evento) {
        evento.preventDefault();
        this.sesion.cerrar();
        location.hash = "inicio";
    }

    /** Procesa el acceso sin envíos simultáneos, notifica el resultado y siempre limpia la contraseña. */
    async ingresar() {
        if (this.enviando) return;
        if (!this.form.checkValidity()) {
            notificar(this, "Completa el nombre del empleado y la contraseña para iniciar sesión.", "aviso");
            this.form.querySelector(":invalid")?.focus();
            return;
        }
        // El cambio de sesión puede retirar esta vista; su contenedor permanece para recibir el éxito.
        const origenNotificacion = this.parentNode || this;
        this.enviando = true;
        const boton = this.root.querySelector("button");
        boton.disabled = true;
        boton.textContent = "Ingresando…";
        this.estado.textContent = "Verificando tus datos…";
        const nombre = this.root.querySelector("#nombre").value;
        const identificador = this.root.querySelector("#identificador");
        try {
            const sesion = await this.sesion.iniciar(nombre, identificador.value);
            if (sesion === null) return;
            this.estado.textContent = "";
            notificar(origenNotificacion, "Sesión iniciada.", "exito");
        } catch (error) {
            this.estado.textContent = "";
            notificar(this, error.mensaje || error.message || "No se pudo iniciar sesión. Inténtalo nuevamente.", "error");
        } finally {
            identificador.value = "";
            this.enviando = false;
            boton.disabled = false;
            boton.textContent = "Iniciar sesión";
        }
    }
}
customElements.define("ingreso-model", Ingreso);
