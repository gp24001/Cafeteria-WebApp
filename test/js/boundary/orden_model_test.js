import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import OrdenModel from "../../../src/js/boundary/orden_model.js";
import { sesionEmpleado } from "../../../src/js/control/sesion_empleado.js";

mocha.setup("tdd");
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
const notificacionesDe = componente => {
    const mensajes = [];
    componente.addEventListener("notificar", evento => mensajes.push(evento.detail));
    return mensajes;
};
suite("OrdenModel: Unidad", function () {
    let vista, actual, ruta, restaurando;
    const id = "11111111-1111-4111-8111-111111111111";
    const barista = { empleado: { idEmpleado: id, nombre: "Ana", apellido: "Pérez" }, roles: [{ nombre: "Barista" }] };
    const orden = { idOrden: "orden-uno", fechaOrden: "2026-11-12T12:00:00Z", observacion: "Cliente: Luis · Pedido web referencia", unidades: [{ idProducto: { idProducto: "cafe" } }] };
    setup(() => { actual = sesionEmpleado.actual; ruta = location.href; restaurando = sesionEmpleado.restaurando; });
    teardown(() => {
        vista?.remove();
        vista = null;
        sesionEmpleado.actual = actual;
        sesionEmpleado.restaurando = restaurando;
        history.replaceState(null, "", ruta);
        sinon.restore();
    });

    test("preparación no consulta datos sin un rol permitido", async function () {
        vista = new OrdenModel();
        const mensajes = notificacionesDe(vista);
        vista.sesion = { actual: null, puedeAcceder: () => false };
        const cargar = sinon.stub(vista.dao, "pendientes");
        await vista.cargar();
        sinon.assert.notCalled(cargar);
        expect(mensajes.at(-1).mensaje).to.include("Inicia sesión");
        expect(mensajes.at(-1).tipo).to.equal("aviso");
    });

    test("seleccionar una orden muestra sus productos, cantidades y presentación en modo de lectura", async function () {
        vista = new OrdenModel();
        vista.sesion = { actual: barista, puedeAcceder: () => true };
        sinon.stub(vista.dao, "pendientes").resolves([orden]);
        sinon.stub(vista.dao, "detalle").resolves([{ idProducto: "cafe", nombre: "Café", precio: 2, cantidad: 2, presentacion: "12 Onzas" }]);
        await vista.cargar();
        vista.lista.children[0].click();
        await esperar();
        expect(vista.root.querySelector(".cliente").textContent).to.equal("Cliente: Luis");
        expect(vista.resumen.estado.lineas[0].cantidad).to.equal(2);
        expect(vista.resumen.hasAttribute("solo-lectura")).to.be.true;
        expect(vista.resumen.hidden).to.be.false;
        expect(vista.resumen.root.querySelector("ul").textContent).to.include("12 Onzas");
        expect(vista.lista.children[0].getAttribute("aria-pressed")).to.equal("true");
    });

    test("al actualizar retira una orden que ya fue pagada y limpia su detalle", async function () {
        vista = new OrdenModel();
        vista.sesion = { actual: barista, puedeAcceder: () => true };
        const pendientes = sinon.stub(vista.dao, "pendientes").resolves([orden]);
        sinon.stub(vista.dao, "detalle").resolves([{ idProducto: "cafe", nombre: "Café", precio: 2, cantidad: 1 }]);
        await vista.cargar();
        await vista.seleccionar(orden);
        pendientes.resolves([]);
        await vista.cargar();
        expect(vista.lista.children.length).to.equal(0);
        expect(vista.resumen.hidden).to.be.true;
        expect(vista.estado.textContent).to.include("No hay órdenes");
    });

    test("sincroniza nuevas órdenes sin botón manual y detiene el sondeo al salir", async function () {
        vista = new OrdenModel();
        vista.sesion = { actual: barista, puedeAcceder: () => true };
        const pendientes = sinon.stub(vista.dao, "pendientes").resolves([orden]);
        sinon.stub(vista.dao, "detalle").resolves([{ nombre: "Café", precio: 2, cantidad: 1 }]);
        document.body.appendChild(vista); await esperar();
        await vista.seleccionar(orden);
        const tarjeta = vista.lista.children[0]; tarjeta.focus();
        pendientes.resolves([orden, { ...orden, idOrden: "orden-nueva" }]);
        await vista.sincronizar();
        expect(vista.lista.children.length).to.equal(2);
        expect(vista.seleccionada.idOrden).to.equal(orden.idOrden);
        expect(vista.lista.children[0]).to.equal(tarjeta);
        expect(vista.root.activeElement).to.equal(tarjeta);
        expect(vista.root.querySelector(".actualizar")).to.equal(null);
        vista.remove(); expect(vista.actualizacion.activa).to.be.false;
    });

    test("una respuesta antigua no sobrescribe la última orden seleccionada", async function () {
        vista = new OrdenModel();
        vista.sesion = { actual: barista, puedeAcceder: () => true };
        let resolver;
        const detalle = sinon.stub(vista.dao, "detalle");
        detalle.onFirstCall().returns(new Promise(resolve => { resolver = resolve; }));
        detalle.onSecondCall().resolves([{ idProducto: "pan", nombre: "Pan", precio: 1, cantidad: 1 }]);
        const anterior = vista.seleccionar(orden);
        await vista.seleccionar({ ...orden, idOrden: "otra-orden" });
        resolver([{ idProducto: "cafe", nombre: "Café", precio: 2, cantidad: 1 }]);
        await anterior;
        expect(vista.resumen.estado.lineas[0].nombre).to.equal("Pan");
        expect(vista.root.querySelector("#titulo-orden").textContent).to.include("otra-ord");
    });

    test("maneja errores de carga y permite reintentar", async function () {
        vista = new OrdenModel();
        const mensajes = notificacionesDe(vista);
        vista.sesion = { actual: barista, puedeAcceder: () => true };
        const pendientes = sinon.stub(vista.dao, "pendientes").rejects(new Error("Sin conexión"));
        await vista.cargar();
        expect(mensajes.at(-1).mensaje).to.include("Sin conexión").and.include("automáticamente");
        expect(mensajes.at(-1).tipo).to.equal("error");
        expect(vista.root.querySelector(".actualizar")).to.equal(null);
        pendientes.resolves([orden]);
        sinon.stub(vista.dao, "detalle").rejects(new Error("Detalle no disponible"));
        await vista.cargar();
        await vista.seleccionar(orden);
        expect(mensajes.at(-1)).to.include({ mensaje: "Detalle no disponible", tipo: "error" });
        expect(vista.root.querySelector(".estado-detalle").textContent).to.equal("");
        expect(vista.resumen.hidden).to.be.true;
    });
});
mocha.run();


