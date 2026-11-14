import { vistas } from "./js/control/vistas.js";
import "./js/boundary/producto_model.js";
import "./js/boundary/orden_model.js";
import "./js/boundary/pago_model.js";
import { sesionEmpleado } from "./js/control/sesion_empleado.js";
import "./js/boundary/components/barra_superior/barra_superior.js";
import "./js/boundary/components/bienvenida/bienvenida.js";
import "./js/boundary/components/ingreso/ingreso.js";
import "./js/boundary/components/menu_lateral/menu_lateral.js";
import NotificacionesSistema from "./js/boundary/components/notificaciones_sistema/notificaciones_sistema.js";
import "./js/boundary/components/pie_pagina/pie_pagina.js";


/** Componente principal que presenta la vista indicada en la URL. */
export class CafefeApp extends HTMLElement {
    /** Inicializa el estado y las dependencias de esta clase. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        const estilo = document.createElement("link");
        estilo.rel = "stylesheet";
        estilo.href = new URL("./resources/estilos/aplicacion.css", import.meta.url);
        const superior = document.createElement("barra-superior");
        this.superior = superior;
        // El encabezado puede ocupar varias líneas cuando se ajustan las acciones de sesión.
        this.observarBarra = new ResizeObserver(() => {
            const altura = superior.getBoundingClientRect().height;
            this.style.setProperty("--altura-barra-superior", `${altura}px`);
        });
        this.root.addEventListener("agregar-producto", evento => superior.agregar(evento.detail));
        const lateral = document.createElement("menu-lateral");
        this.lateral = lateral;
        this.root.addEventListener("menu-retraido", evento => {
            const abierto = !evento.detail.retraido;
            this.toggleAttribute("menu-abierto", abierto);
            this.superior.actualizarMenu(abierto);
        });
        this.root.addEventListener("alternar-menu", () => lateral.establecerAbierto(!this.hasAttribute("menu-abierto")));
        this.main = document.createElement("main");
        this.notificaciones = new NotificacionesSistema();
        this.root.addEventListener("notificar", evento => this.notificaciones.mostrar(evento.detail));
        this.pie = document.createElement("pie-pagina");
        this.root.append(estilo, superior, lateral, this.main, this.pie, this.notificaciones);
        this.actualizarRuta = () => this.render();
        this.actualizarSesion = () => {
            const solicitada = location.hash.slice(1).split("/")[0];
            const ruta = Object.hasOwn(vistas, solicitada) ? solicitada : "ingreso";
            if (sesionEmpleado.actual && (ruta === "ingreso" || this.main.querySelector("ingreso-model"))) location.hash = "inicio";
            else if (sesionEmpleado.actual && !sesionEmpleado.puedeAcceder(ruta)) location.hash = sesionEmpleado.destino;
            else if (!sesionEmpleado.actual && ["preparacion", "pagos"].includes(ruta)) location.hash = "ingreso";
            this.render();
        };
    }

    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() {
        this.lateral.establecerAbierto(false);
        this.observarBarra.observe(this.superior, { box: "border-box" });
        window.addEventListener("hashchange", this.actualizarRuta);
        sesionEmpleado.addEventListener("cambio", this.actualizarSesion);
        sesionEmpleado.restaurar();
        this.render();
    }

    /** Libera los eventos o invalida consultas pendientes al retirar el componente. */
    disconnectedCallback() {
        this.observarBarra.disconnect();
        window.removeEventListener("hashchange", this.actualizarRuta);
        sesionEmpleado.removeEventListener("cambio", this.actualizarSesion);
    }

    /** Abre el ingreso por defecto y conserva el acceso público al catálogo y las rutas por rol. */
    render() {
        const [solicitada, idCategoria] = location.hash.slice(1).split("/");
        const ruta = Object.hasOwn(vistas, solicitada) ? solicitada : "ingreso";
        const vista = vistas[ruta];
        const titulo = document.createElement("h1");
        titulo.textContent = vista.titulo;
        this.main.replaceChildren();
        this.lateral.actualizarSesion(sesionEmpleado);
        this.superior.actualizarSesion(sesionEmpleado.actual);
        this.superior.actualizarRuta(ruta);
        this.toggleAttribute("area-empleados", ["preparacion", "pagos"].includes(ruta));
        if (ruta === "inicio") {
            this.main.appendChild(document.createElement("inicio-model"));
        } else if (ruta === "productos") {
            const productos = document.createElement("producto-model");
            productos.setAttribute("seleccionable", "");
            productos.idCategoria = idCategoria;
            productos.seccion = ruta;
            this.main.append(titulo, productos);
        } else if (ruta === "ingreso") {
            this.main.append(titulo, document.createElement("ingreso-model"));
        } else if (["preparacion", "pagos"].includes(ruta)) {
            this.main.appendChild(titulo);
            if (sesionEmpleado.restaurando) {
                const estado = document.createElement("p");
                estado.setAttribute("role", "status");
                estado.textContent = "Verificando sesión…";
                this.main.appendChild(estado);
            } else if (!sesionEmpleado.actual) {
                this.main.appendChild(document.createElement("ingreso-model"));
            } else if (!sesionEmpleado.puedeAcceder(ruta)) {
                const mensaje = document.createElement("p");
                mensaje.textContent = "Tu rol no tiene acceso a esta pantalla.";
                const enlace = document.createElement("a");
                enlace.href = "#" + sesionEmpleado.destino;
                enlace.textContent = "Ir a mi área de trabajo";
                this.main.append(mensaje, enlace);
            } else if (ruta === "preparacion") {
                this.main.appendChild(document.createElement("preparacion-model"));
            } else {
                this.main.appendChild(document.createElement("facturacion-model"));
            }
        }
        this.lateral.seleccionar(ruta);
        document.title = vista.titulo + " · CAFEFE";
    }
}
customElements.define("cafefe-app", CafefeApp);
