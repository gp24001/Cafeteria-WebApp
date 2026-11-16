import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import PagoModel from "../../../src/js/boundary/pago_model.js";
import { simularApi } from "../control/api_simulada.js";

mocha.setup("tdd");
suite("PagoModel: Integración", function () {
    let pantalla, vista, factura, datos, notificaciones;
    setup(() => {
        pantalla = new PagoModel();
        pantalla.sesion = { actual: { empleado: { nombre: "Ana" }, roles: [{ nombre: "Cajero", idEmpleadoRol: "cajero" }] }, puedeAcceder: () => true };
        sinon.stub(pantalla.dao, "paraFacturacion").resolves([]);
        document.body.appendChild(pantalla);
        vista = pantalla.cobro;
        vista.hidden = false;
        notificaciones = [];
        pantalla.addEventListener("notificar", evento => notificaciones.push(evento.detail));
        factura = { idFactura: "f1", cliente: "Ana", fechaFacturacion: "2026-11-12T20:00:00Z" };
        datos = { factura, total: 400, pagado: 0, saldo: 400, historial: [], lineas: [{ nombre: "Café", precio: 2, cantidad: 2 }] };
        sinon.stub(vista.dao, "cargar").resolves(datos);
        sinon.stub(vista.dao, "actualizar").callsFake(() => vista.dao.cargar());
        sinon.stub(vista, "descargar");
    });
    teardown(() => { pantalla.remove(); sinon.restore(); });
    test("una respuesta de otra orden no libera la consulta de saldo que sigue pendiente", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        let resolverAnterior, resolverActual;
        vista.dao.actualizar.resetBehavior();
        vista.dao.actualizar.onFirstCall().returns(new Promise(resolve => { resolverAnterior = resolve; }));
        vista.dao.actualizar.onSecondCall().returns(new Promise(resolve => { resolverActual = resolve; }));
        const anterior = vista.recargar(true);
        const datosActuales = { ...datos, factura: { ...factura, idFactura: "f2" }, total: 600, saldo: 600,
            lineas: [{ nombre: "Café", precio: 3, cantidad: 2 }] };
        vista.dao.cargar.resolves(datosActuales);
        await vista.abrir({ idOrden: "o2" }, "cajero", "Ana");
        const actual = vista.recargar(true);
        resolverAnterior(datos); await anterior;
        expect(vista.consultando).to.be.true;
        expect(vista.datos.factura.idFactura).to.equal("f2");
        await vista.recargar(true);
        sinon.assert.calledTwice(vista.dao.actualizar);
        resolverActual(datosActuales); await actual;
        expect(vista.consultando).to.be.false;
        expect(vista.root.querySelector(".total").textContent).to.equal("$6.00");
    });

    test("muestra saldo después de efectivo y genera PDF al completar con tarjeta", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const abonar = sinon.stub(vista.dao, "abonar");
        abonar.onFirstCall().resolves({ ...datos, pagado: 200, saldo: 200 });
        abonar.onSecondCall().resolves({ ...datos, pagado: 400, saldo: 0 });
        vista.root.querySelector("#monto").value = "2";
        await vista.abonar();
        expect(vista.root.querySelector(".saldo").textContent).to.include("2.00");
        expect(vista.root.querySelector(".ticket").hidden).to.be.true;
        sinon.assert.notCalled(vista.descargar);
        vista.root.querySelector('input[value="TARJETA"]').click();
        expect(vista.root.querySelector(".referencia").hidden).to.be.false;
        vista.root.querySelector("#referencia").value = "terminal-123";
        vista.root.querySelector("#monto").value = "2";
        await vista.abonar();
        expect(abonar.secondCall.args.slice(1)).to.deep.equal(["2", "TARJETA", "terminal-123"]);
        expect(vista.root.querySelector(".saldo").textContent).to.include("0.00");
        expect(vista.form.hidden).to.be.true;
        sinon.assert.calledOnce(vista.descargar);
        vista.root.querySelector(".ticket").click();
        sinon.assert.calledTwice(vista.descargar);
        sinon.assert.calledTwice(abonar);
    });

    test("recupera el último cobro en efectivo y descarga su PDF con el vuelto sin duplicar el pago", async function () {
        vista.dao.cargar.restore();
        vista.dao.actualizar.restore();
        vista.descargar.restore();
        const idFactura = "factura-establecimiento";
        const clave = "cafefe.cobro." + idFactura;
        const previo = sessionStorage.getItem(clave);
        sessionStorage.removeItem(clave);
        const orden = { idOrden: "local-orden", observacion: "", fechaOrden: "2026-11-12T20:00:00Z" };
        const unidad = { idOrdenProducto: "u1", idProducto: { idProducto: "cafe" }, precio: 4 };
        const facturaLocal = { idFactura, cliente: "Cliente de mesa", fechaFacturacion: orden.fechaOrden, estado: "PARCIAL", idCaja: { idCaja: "fisica" } };
        const pagos = [{ idPago: "p1", idFactura: { idFactura }, estado: "CONFIRMADO" }];
        let pagado = 1, falloLectura = false, detalleFinal;
        const { solicitudes } = simularApi({
            "GET orden": [orden],
            "GET orden/local-orden/producto": [unidad],
            "GET producto/cafe": { idProducto: "cafe", nombre: "Café", precioSugerido: 4 },
            "GET factura": [facturaLocal],
            [`GET factura/${idFactura}`]: () => facturaLocal,
            [`GET factura/${idFactura}/ordenProducto`]: [{ idOrdenProducto: { idOrdenProducto: "u1" }, precio: 4 }],
            [`GET factura/${idFactura}/totales`]: () => {
                if (falloLectura) { falloLectura = false; throw new Error("Lectura interrumpida tras el cobro"); }
                return { total: 4, pagado, saldo: 4 - pagado };
            },
            "GET pago": pagos,
            "GET pago/p1/detalle": [{ tipoPago: " Tarjeta ", monto: 1 }],
            "GET pago/p2/detalle": () => detalleFinal,
            "GET caja": [{ idCaja: "fisica", nombre: "Caja del establecimiento" }],
            "POST pago": ({ cuerpo }) => {
                detalleFinal = cuerpo.detalles;
                const pago = { idPago: "p2", idFactura: { idFactura }, estado: "CONFIRMADO", observaciones: cuerpo.observaciones };
                pagos.push(pago);
                pagado = 4;
                facturaLocal.estado = "PAGADA";
                falloLectura = true;
                return pago;
            }
        });
        pantalla.dao.paraFacturacion.restore();
        const descargar = sinon.stub(HTMLAnchorElement.prototype, "click");
        const crearUrl = sinon.stub(URL, "createObjectURL").returns("blob:ticket-prueba");
        try {
            await pantalla.cargar();
            expect(pantalla.lista.firstElementChild.textContent).to.include("Pedido del establecimiento");
            await pantalla.seleccionar(pantalla.ordenes[0]);
            expect(vista.root.querySelector(".historial li").textContent).to.equal("Tarjeta · $1.00");
            vista.root.querySelector("#monto").value = "5";
            await vista.abonar();
            expect(detalleFinal[0].monto).to.equal(3);
            expect(vista.form.hidden).to.be.true;
            expect(sessionStorage.getItem(clave)).to.be.a("string");
            sinon.assert.notCalled(descargar);
            await pantalla.sincronizar();
            sinon.assert.calledOnce(descargar);
            sinon.assert.calledOnce(crearUrl);
            expect(descargar.firstCall.thisValue.download).to.equal(`Cafefe-factura-${idFactura}.pdf`);
            const pdf = crearUrl.firstCall.args[0];
            expect(pdf.type).to.equal("application/pdf");
            const texto = await pdf.text();
            const contenido = [...texto.matchAll(/<([\da-f]+)> Tj/g)]
                .map(m => m[1].match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join("")).join(" ");
            expect(contenido).to.include("Cliente de mesa").and.include("Caja del establecimiento").and.include("Café x1");
            expect(contenido).to.match(/Tarjeta\s+\$1\.00/).and.match(/Efectivo recibido\s+\$5\.00/).and.match(/Cambio\s+\$2\.00/);
            expect(sessionStorage.getItem(clave)).to.equal(null);
            expect(pantalla.lista.children).to.have.lengthOf(0);
            expect(pantalla.seleccionada).to.equal(null);
            await pantalla.sincronizar();
            sinon.assert.calledOnce(descargar);
            expect(solicitudes.filter(s => s.metodo === "POST")).to.have.lengthOf(1);
        } finally {
            if (previo === null) sessionStorage.removeItem(clave);
            else sessionStorage.setItem(clave, previo);
        }
    });

    test("si otra caja abona antes de confirmar, muestra el nuevo vuelto sin registrar el cobro anterior", async function () {
        // La pantalla muestra $4 pendientes cuando el cliente entrega $5.
        factura.idFactura = "it-vuelto-saldo";
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const entrada = vista.root.querySelector("#monto");
        const vuelto = vista.root.querySelector("#vuelto");
        entrada.value = "5";
        entrada.dispatchEvent(new Event("input"));
        expect(vuelto.textContent).to.equal("Vuelto: $1.00");

        // Al confirmar, la API ya tiene $1.25 pagados con tarjeta en otra caja.
        vista.dao.actualizar.restore();
        const enviarPago = sinon.spy();
        simularApi({
            "GET factura/it-vuelto-saldo": factura,
            "GET factura/it-vuelto-saldo/totales": { total: 4, pagado: 1.25, saldo: 2.75 },
            "GET pago": [{ idPago: "otro", estado: "CONFIRMADO", idFactura: { idFactura: factura.idFactura } }],
            "GET pago/otro/detalle": [{ monto: 1.25, tipoPago: "TARJETA" }],
            "POST pago": enviarPago
        });
        await vista.abonar();
        expect(notificaciones.at(-1).mensaje).to.include("El saldo cambió");
        sinon.assert.notCalled(enviarPago);
        sinon.assert.notCalled(vista.descargar);

        await vista.recargar(true);
        expect(vista.root.querySelector(".saldo").textContent).to.equal("$2.75");
        expect(entrada.value).to.equal("5");
        expect(vuelto.textContent).to.equal("Vuelto: $2.25");
        sinon.assert.notCalled(enviarPago);
    });

    test("rechaza el sobrepago con tarjeta antes de enviar y no descarga un ticket", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const abonar = sinon.stub(vista.dao, "abonar");
        vista.root.querySelector('input[value="TARJETA"]').click();
        vista.root.querySelector("#monto").value = "4.01";
        await vista.abonar();
        expect(notificaciones.at(-1)).to.include({ tipo: "aviso" });
        expect(notificaciones.at(-1).mensaje).to.include("no puede superar");
        sinon.assert.notCalled(abonar); sinon.assert.notCalled(vista.descargar);
    });

    test("actualiza el vuelto mientras se escribe y lo oculta al pagar exacto, editar o elegir tarjeta", async function () {
        vista.dao.cargar.resolves({ ...datos, total: 2133, saldo: 2133 });
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const entrada = vista.root.querySelector("#monto"), vuelto = vista.root.querySelector("#vuelto");
        for (const [monto, esperado] of [["25", "$3.67"], ["22", "$0.67"], ["21,33", ""], ["10", ""], ["22.001", ""], ["", ""]]) {
            entrada.value = monto;
            entrada.dispatchEvent(new Event("input"));
            expect(vuelto.hidden).to.equal(!esperado);
            expect(vuelto.textContent).to.equal(esperado ? "Vuelto: " + esperado : "");
        }
        entrada.value = "25";
        vista.root.querySelector('input[value="TARJETA"]').click();
        expect(vuelto.hidden).to.be.true;
        expect(entrada.getAttribute("aria-invalid")).to.equal("true");
        vista.root.querySelector('input[value="EFECTIVO"]').click();
        expect(vuelto.hidden).to.be.false;
        expect(vuelto.textContent).to.equal("Vuelto: $3.67");
        expect(entrada.getAttribute("aria-invalid")).to.equal("false");
    });

    test("muestra campos de pago desde el inicio y factura internamente al primer abono", async function () {
        vista.dao.cargar.resolves({ ...datos, factura: null, cajas: [{ idCaja: "web", nombre: "Caja Virtual" }] });
        const emitir = sinon.stub(vista.dao, "emitir").resolves(datos);
        const abonar = sinon.stub(vista.dao, "abonar").resolves({ ...datos, pagado: 200, saldo: 200 });
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        sinon.assert.notCalled(emitir);
        expect(vista.root.querySelector(".crear")).to.equal(null);
        expect(vista.form.hidden).to.be.false;
        expect(vista.root.querySelector(".caja").textContent).to.equal("Caja: Caja Virtual");
        vista.root.querySelector("#monto").value = "2";
        await vista.abonar();
        expect(emitir.firstCall.args).to.deep.equal([{ idOrden: "o1" }, "web", "cajero"]);
        sinon.assert.calledOnce(abonar);
        expect(vista.root.querySelector(".factura").hidden).to.be.false;
    });

    test("revalida el aporte con tarjeta cuando la actualización automática reduce el saldo", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        vista.root.querySelector('input[value="TARJETA"]').click();
        vista.root.querySelector("#monto").value = "3";
        vista.dao.cargar.resolves({ ...datos, pagado: 200, saldo: 200 });
        await vista.recargar(true);
        expect(vista.advertenciaMonto).to.include("no puede superar");
        expect(notificaciones.at(-1).mensaje).to.include("no puede superar");
        expect(vista.root.querySelector("#monto").value).to.equal("3");
    });

    test("anula con motivo, notifica la bandeja y genera el comprobante sin cobrar", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const anular = sinon.stub(vista.dao, "anular").resolves({ ...factura, estado: "ANULADA", observaciones: "Anulación: Orden anulada: El cliente canceló su pedido" });
        const evento = sinon.spy(); vista.addEventListener("orden-anulada", evento);
        vista.root.querySelector(".anular").click();
        vista.root.querySelector("#motivo").value = "El cliente canceló su pedido";
        await vista.anular();
        expect(anular.firstCall.args).to.deep.equal([{ idOrden: "o1" }, "cajero", "El cliente canceló su pedido"]);
        sinon.assert.calledOnce(evento); sinon.assert.calledOnce(vista.descargar);
        expect(vista.root.querySelector(".ticket").textContent).to.include("anulada");
        expect(vista.root.querySelector("dialog").open).to.be.false;
        expect(notificaciones.some(n => n.tipo === "exito" && n.mensaje.includes("Orden anulada"))).to.be.true;
    });

    test("anular sin motivo usa el aviso flotante y conserva abierto el diálogo", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const anular = sinon.stub(vista.dao, "anular");
        vista.root.querySelector(".anular").click();
        await vista.anular();
        sinon.assert.notCalled(anular);
        expect(notificaciones.at(-1).tipo).to.equal("aviso");
        expect(notificaciones.at(-1).mensaje).to.include("motivo de anulación");
        expect(vista.root.querySelector("dialog").open).to.be.true;
        expect(vista.root.querySelector(".error-anulacion")).to.equal(null);
    });

    test("efectivo de 1, 2 y 0.50 actualiza la misma fila a 3.50 y conserva ese acumulado para el ticket", async function () {
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const historial = []; let pagado = 0;
        sinon.stub(vista.dao, "abonar").callsFake(async (factura, monto, tipoPago) => {
            pagado += Math.round(Number(monto) * 100);
            historial.push({ detalles: [{ tipoPago, monto: Number(monto) }] });
            return { ...datos, pagado, saldo: 400 - pagado, historial: structuredClone(historial) };
        });
        for (const [importe, acumulado] of [["1", "$1.00"], ["2", "$3.00"], ["0.50", "$3.50"]]) {
            vista.root.querySelector("#monto").value = importe;
            expect(vista.root.querySelector(".abonar").textContent).to.include("en efectivo");
            await vista.abonar();
            expect(Array.from(vista.root.querySelectorAll(".historial li"), li => li.textContent)).to.deep.equal(["Efectivo · " + acumulado]);
        }
        vista.root.querySelector('input[value="TARJETA"]').click();
        expect(vista.root.querySelector(".abonar").textContent).to.include("con tarjeta");
        vista.root.querySelector("#monto").value = "0.50";
        await vista.abonar();
        expect(Array.from(vista.root.querySelectorAll(".historial li"), li => li.textContent)).to.deep.equal(["Efectivo · $3.50", "Tarjeta · $0.50"]);
        expect(vista.descargar.firstCall.args[0].historial).to.deep.equal(historial);
        expect(vista.medio).to.equal("EFECTIVO");
    });

    test("no hereda tarjeta de otra orden y captura el método antes de esperar la emisión", async function () {
        vista.root.querySelector('input[value="TARJETA"]').checked = true;
        vista.dao.cargar.resolves({ ...datos, factura: null, cajas: [{ idCaja: "web" }] });
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        expect(vista.medio).to.equal("EFECTIVO");
        const abonar = sinon.stub(vista.dao, "abonar").resolves({ ...datos, pagado: 100, saldo: 300 });
        sinon.stub(vista.dao, "emitir").callsFake(async () => {
            vista.root.querySelector('input[value="TARJETA"]').checked = true;
            return datos;
        });
        vista.root.querySelector("#monto").value = "1";
        await vista.abonar();
        expect(abonar.firstCall.args.slice(1)).to.deep.equal(["1", "EFECTIVO", ""]);
    });

    test("oculta el formulario si el servidor todavía no confirma un abono", async function () {
        vista.dao.cargar.resolves({ ...datos, incierto: true });
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        expect(vista.form.hidden).to.be.true;
        expect(notificaciones.at(-1).mensaje).to.include("sin confirmar");
        expect(vista.root.querySelector(".abonar").disabled).to.be.true;
    });

    test("un abono recibido actualiza el importe de la fila existente sin reemplazarla", async function () {
        vista.dao.cargar.resolves({ ...datos, pagado: 100, saldo: 300, historial: [{ detalles: [{ tipoPago: "EFECTIVO", monto: 1 }] }] });
        await vista.abrir({ idOrden: "o1" }, "cajero", "Ana");
        const fila = vista.root.querySelector(".historial li"), campo = vista.root.querySelector("#monto");
        campo.value = "0.50"; campo.focus();
        vista.dao.cargar.resolves({ ...datos, pagado: 300, saldo: 100,
            historial: [{ detalles: [{ tipoPago: "EFECTIVO", monto: 1 }, { tipoPago: "EFECTIVO", monto: 2 }] }] });
        await vista.recargar(true);
        expect(vista.root.querySelector(".historial li")).to.equal(fila);
        expect(fila.textContent).to.equal("Efectivo · $3.00");
        expect(vista.root.activeElement).to.equal(campo);
        expect(campo.value).to.equal("0.50");
        expect(vista.form.hidden).to.be.false;
    });
});
mocha.run();

