// El navegador puede ofrecer la instalación en Ingreso, antes de que se abra Inicio.
const disponibilidad = new EventTarget();
let eventoPendiente = null;

function guardarEvento(evento) {
    eventoPendiente = evento;
    disponibilidad.dispatchEvent(new Event("cambio"));
}

window.addEventListener("beforeinstallprompt", evento => {
    evento.preventDefault();
    guardarEvento(evento);
});
window.addEventListener("appinstalled", () => guardarEvento(null));

/** Ofrece la instalación en Inicio mientras haya una invitación del navegador. */
class InstalarApp extends HTMLElement {
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        const boton = document.createElement("button");
        boton.type = "button";
        boton.part.add("boton");
        boton.textContent = "Instalar aplicación";
        boton.addEventListener("click", () => this.instalar());
        this.root.appendChild(boton);
        this.actualizar = () => {
            this.hidden = !eventoPendiente || window.matchMedia("(display-mode: standalone)").matches;
        };
    }

    connectedCallback() {
        disponibilidad.addEventListener("cambio", this.actualizar);
        this.actualizar();
    }

    disconnectedCallback() {
        disponibilidad.removeEventListener("cambio", this.actualizar);
    }

    async instalar() {
        const evento = eventoPendiente;
        if (!evento) return;
        // Cada invitación admite un clic. El navegador decide cuándo ofrecer otra.
        guardarEvento(null);
        try {
            await evento.prompt();
        } catch (error) {
            console.warn("El navegador no pudo mostrar el diálogo de instalación.", error);
        }
    }
}

customElements.define("instalar-app", InstalarApp);
