import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import PagoModel from "../../../src/js/boundary/pago_model.js";
import { sesionEmpleado } from "../../../src/js/control/sesion_empleado.js";

mocha.setup("tdd");
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
const notificacionesDe = componente => {
    const mensajes = [];
    componente.addEventListener("notificar", evento => mensajes.push(evento.detail));
    return mensajes;
};
suite("PagoModel: Unidad", function () {
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

    test("al cambiar de orden descarta el efectivo y el vuelto que quedaron sin confirmar", async function () {
        vista = document.createElement("cobro-factura");
        document.body.appendChild(vista);
        const primera = { factura: { idFactura: "f1" }, total: 325, pagado: 0, saldo: 325, historial: [] };
        const segunda = { factura: { idFactura: "f2" }, total: 150, pagado: 0, saldo: 150, historial: [] };
        const cargar = sinon.stub(vista.dao, "cargar");
        cargar.onFirstCall().resolves(primera);
        cargar.onSecondCall().resolves(segunda);
        const abonar = sinon.stub(vista.dao, "abonar");

        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const efectivo = vista.root.querySelector("#monto");
        const vuelto = vista.root.querySelector("#vuelto");
        efectivo.value = "5";
        efectivo.dispatchEvent(new Event("input"));
        expect(vuelto.textContent).to.include("$1.75");

        await vista.abrir({ idOrden: "o2" }, "cajero", "Ana");
        expect(efectivo.value).to.equal("");
        expect(vuelto.hidden).to.be.true;
        await vista.abonar();
        sinon.assert.notCalled(abonar);

        efectivo.value = "2";
        efectivo.dispatchEvent(new Event("input"));
        expect(vuelto.hidden).to.be.false;
        expect(vuelto.textContent).to.include("$0.50");
    });

    test("en pagos mantiene el total visible y los productos plegados sin reiniciar el despliegue al sincronizar", async function () {
        vista = new PagoModel();
        vista.sesion = { actual: { empleado: barista.empleado, roles: [{ nombre: "Cajero", idEmpleadoRol: "cajero" }] }, puedeAcceder: () => true };
        sinon.stub(vista.dao, "paraFacturacion").resolves([orden]);
        sinon.stub(vista.dao, "detalle").resolves([{ nombre: "Café", cantidad: 2, precio: 2 }]);
        sinon.stub(vista.cobro, "abrir").resolves();
        sinon.stub(vista.cobro, "recargar").resolves(false);
        document.body.appendChild(vista); await esperar();
        await vista.seleccionar(orden);
        const detalle = vista.root.querySelector(".resumen-lectura");
        const total = vista.root.querySelector(".total-pago");
        expect(detalle.open).to.be.false;
        expect(detalle.querySelector("summary").textContent).to.equal("Ver detalle de la orden");
        expect(total.hidden).to.be.false;
        expect(total.querySelector("strong").textContent).to.equal("$4.00");
        expect(detalle.contains(total)).to.be.false;
        expect(vista.resumen.hasAttribute("sin-total")).to.be.true;
        expect(vista.cobro.hidden).to.be.false;
        detalle.querySelector("summary").click();
        expect(detalle.open).to.be.true;
        await vista.sincronizar();
        expect(detalle.open).to.be.true;
        vista.cobro.dispatchEvent(new CustomEvent("factura-consultada", {
            detail: { lineas: [{ nombre: "Café", cantidad: 2, precio: 3 }] }
        }));
        expect(total.querySelector("strong").textContent).to.equal("$6.00");
        expect(detalle.open).to.be.true;
        detalle.querySelector("summary").click();
        expect(detalle.open).to.be.false;
        expect(total.hidden).to.be.false;
        expect(vista.cobro.hidden).to.be.false;
        await vista.seleccionar(orden);
        expect(detalle.open).to.be.false;
        expect(total.querySelector("strong").textContent).to.equal("$4.00");
        vista.limpiarDetalle();
        expect(total.hidden).to.be.true;
    });

    for (const quedanOrdenes of [true, false]) {
        test(`al pagar y generar el PDF limpia el detalle ${quedanOrdenes ? "y permite elegir otra orden" : "y muestra que no hay pendientes"}`, async function () {
            vista = new PagoModel();
            vista.sesion = { actual: { empleado: barista.empleado, roles: [{ nombre: "Cajero", idEmpleadoRol: "cajero" }] }, puedeAcceder: () => true };
            const ordenes = quedanOrdenes ? [orden, { ...orden, idOrden: "segunda-orden" }] : [orden];
            sinon.stub(vista.dao, "paraFacturacion").resolves(ordenes);
            sinon.stub(vista.dao, "detalle").resolves([{ nombre: "Café", cantidad: 1, precio: 2 }]);
            const datos = { factura: { idFactura: "f1" }, total: 200, pagado: 0, saldo: 200, historial: [] };
            sinon.stub(vista.cobro.dao, "cargar").resolves(datos);
            sinon.stub(vista.cobro.dao, "abonar").resolves({ ...datos, pagado: 200, saldo: 0 });
            const descargar = sinon.stub(vista.cobro, "descargar").callsFake(() => {
                expect(vista.cobro.hidden).to.be.false;
                expect(vista.seleccionada.idOrden).to.equal(orden.idOrden);
            });
            document.body.appendChild(vista); await esperar();
            await vista.seleccionar(orden);
            vista.cobro.root.querySelector("#monto").value = "2";
            await vista.cobro.abonar();
            sinon.assert.calledOnce(descargar);
            expect(vista.cobro.hidden).to.be.true;
            expect(vista.seleccionada).to.equal(null);
            expect(vista.resumen.hidden).to.be.true;
            expect(vista.root.querySelector(".cliente").textContent).to.equal("");
            expect(vista.root.querySelector("#titulo-orden").textContent).to.equal(quedanOrdenes ? "Selecciona una orden" : "No hay órdenes pendientes de pago");
            expect(vista.lista.children.length).to.equal(quedanOrdenes ? 1 : 0);
            if (!quedanOrdenes) expect(vista.estado.textContent).to.equal("No hay órdenes pendientes de pago.");
        });
    }


});
mocha.run();


