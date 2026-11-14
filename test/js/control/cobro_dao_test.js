import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import CobroDao from "../../../src/js/control/cobro_dao.js";
import PagoDetalleDao from "../../../src/js/control/pago_detalle_dao.js";
import FacturaOrdenProductoDao from "../../../src/js/control/factura_orden_producto_dao.js";
import { centavos } from "../../../src/js/control/importes.js";

mocha.setup("tdd");
suite("CobroDao: Unidad", function () {
    let dao, pagos, totalPagado, factura;
    setup(() => {
        const memoria = new Map();
        dao = new CobroDao({ getItem: k => memoria.get(k) || null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k) });
        pagos = []; totalPagado = 0;
        factura = { idFactura: "f1", cliente: "Ana", fechaFacturacion: "2026-11-12T20:00:00Z" };
        sinon.stub(dao.facturas, "totales").callsFake(async () => ({ total: 4, pagado: totalPagado / 100, saldo: (400 - totalPagado) / 100 }));
        sinon.stub(dao.pagos, "listarTodos").callsFake(async () => pagos);
        sinon.stub(PagoDetalleDao.prototype, "listarTodos").callsFake(function () {
            return Promise.resolve(pagos.find(p => this.URL.includes("/" + p.idPago + "/"))?.detalles || []);
        });
        sinon.stub(dao.pagos, "crear").callsFake(async solicitud => {
            totalPagado += centavos(solicitud.detalles[0].monto);
            const pago = { idPago: "p" + (pagos.length + 1), estado: "CONFIRMADO", idFactura: { idFactura: "f1" }, ...solicitud };
            pago.idFactura = { idFactura: "f1" }; pagos.push(pago); return pago;
        });
    });
    teardown(() => sinon.restore());

    test("4 dólares: efectivo 2 deja saldo 2 y tarjeta 2 completa el pago", async function () {
        const parcial = await dao.abonar(factura, "2.00", "EFECTIVO");
        expect([parcial.total, parcial.pagado, parcial.saldo]).to.deep.equal([400, 200, 200]);
        const completo = await dao.abonar(factura, "2", "TARJETA", "comprobante-123");
        expect([completo.total, completo.pagado, completo.saldo]).to.deep.equal([400, 400, 0]);
        expect(completo.historial.map(h => h.detalles[0].tipoPago)).to.deep.equal(["EFECTIVO", "TARJETA"]);
        expect(completo.historial[1].detalles[0].referenciaExterna).to.equal("comprobante-123");
    });

    test("admite varios abonos del mismo medio sin sobrepasar el saldo", async function () {
        await dao.abonar(factura, "1.50", "EFECTIVO");
        await dao.abonar(factura, "0.50", "EFECTIVO");
        expect((await dao.abonar(factura, "2.01", "TARJETA").catch(e => e)).message).to.include("superar");
        sinon.assert.calledTwice(dao.pagos.crear);
        expect((await dao.abonar(factura, "2", "EFECTIVO")).saldo).to.equal(0);
        expect((await dao.abonar(factura, "0.01", "EFECTIVO").catch(e => e)).message).to.include("superar");
    });

    test("rechaza importes inválidos, negativos, cero y más de dos decimales", async function () {
        for (const valor of ["", "-1", "0", "NaN", "1e2", "1.001"]) {
            expect(await dao.abonar(factura, valor, "EFECTIVO").catch(e => e)).to.be.instanceOf(Error);
        }
        sinon.assert.notCalled(dao.pagos.crear);
    });

    test("bloquea dos envíos simultáneos", async function () {
        let resolver;
        dao.facturas.totales.returns(new Promise(resolve => { resolver = resolve; }));
        const primero = dao.abonar(factura, "2", "EFECTIVO");
        expect((await dao.abonar(factura, "2", "TARJETA").catch(e => e)).message).to.include("Espera");
        dao.facturas.totales.resolves({ total: 4, pagado: 2, saldo: 2 });
        resolver({ total: 4, pagado: 0, saldo: 4 }); await primero;
        sinon.assert.calledOnce(dao.pagos.crear);
    });

    test("recupera un abono registrado tras perder la respuesta sin cobrarlo otra vez", async function () {
        dao.pagos.crear.callsFake(async solicitud => {
            totalPagado = 200;
            pagos.push({ idPago: "p1", estado: "CONFIRMADO", idFactura: { idFactura: "f1" }, observaciones: solicitud.observaciones, detalles: solicitud.detalles });
            throw new Error("Sin red después de guardar");
        });
        const resultado = await dao.abonar(factura, "2", "EFECTIVO");
        expect(resultado.saldo).to.equal(200); expect(resultado.incierto).to.be.false;
        sinon.assert.calledOnce(dao.pagos.crear);
    });

    test("impide repetir un abono mientras no se confirme si quedó registrado", async function () {
        dao.pagos.crear.rejects(new Error("Sin conexión"));
        expect((await dao.abonar(factura, "2", "EFECTIVO").catch(e => e)).message).to.include("No se confirmó");
        expect((await dao.estado(factura)).incierto).to.be.true;
        expect((await dao.abonar(factura, "2", "EFECTIVO").catch(e => e)).message).to.include("sin confirmar");
        sinon.assert.calledOnce(dao.pagos.crear);
    });

    test("respeta un rechazo de sobrecobro del backend y permite actualizar", async function () {
        dao.pagos.crear.rejects({ error: { status: 422 }, mensaje: "El pago supera el saldo" });
        const error = await dao.abonar(factura, "2", "EFECTIVO").catch(e => e);
        expect(error.mensaje).to.include("supera"); expect((await dao.estado(factura)).incierto).to.be.false;
    });

    test("selecciona únicamente la Caja Virtual activa para emitir nuevas facturas", async function () {
        sinon.stub(dao, "buscarFactura").resolves(null);
        sinon.stub(dao.recepcion, "detalle").resolves([]);
        sinon.stub(dao.cajas, "listarTodos").resolves([
            { idCaja: "fisica", nombre: "Caja 1", activo: true }, { idCaja: "web", nombre: "Caja Virtual", activo: true }
        ]);
        expect((await dao.cargar({ unidades: [] })).cajas.map(c => c.idCaja)).to.deep.equal(["web"]);
        dao.cajas.listarTodos.resolves([{ idCaja: "web", nombre: "Caja Virtual", activo: false }]);
        expect((await dao.cargar({ unidades: [] })).cajas).to.deep.equal([]);
    });

    test("reutiliza factura vigente y sus precios aunque el catálogo haya cambiado", async function () {
        const orden = { idOrden: "o1", unidades: [{ idOrdenProducto: "u1", idProducto: { idProducto: "cafe" }, precio: 99 }] };
        sinon.stub(dao.facturas, "listarTodos").resolves([{ ...factura, estado: "EMITIDA" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" }, precio: 4 }]);
        sinon.stub(dao.recepcion, "detalle").callsFake(async o => [{ nombre: "Café", precio: o.unidades[0].precio, cantidad: 1 }]);
        sinon.stub(dao.facturas, "crear");
        sinon.stub(dao.cajas, "listarTodos").resolves([]);
        const estado = await dao.emitir(orden, "web", "cajero");
        expect(estado.lineas[0].precio).to.equal(4);
        sinon.assert.notCalled(dao.facturas.crear);
    });

    test("bloquea una factura histórica incompleta antes de ofrecer el cobro", async function () {
        const orden = { idOrden: "o1", unidades: [{ idOrdenProducto: "u1" }, { idOrdenProducto: "u2" }] };
        sinon.stub(dao, "buscarFactura").resolves({ factura: { ...factura, estado: "PAGADA" }, unidades: [{ idOrdenProducto: { idOrdenProducto: "u1" }, precio: 2 }] });
        expect((await dao.cargar(orden).catch(e => e)).message).to.include("no contiene toda la orden");
        sinon.assert.notCalled(dao.pagos.crear);
    });

    test("emite con la caja indicada y reconcilia la respuesta perdida sin duplicar factura", async function () {
        const orden = { idOrden: "o1", observacion: "Cliente: Ana · Pedido web ref\nEstado: Despachada", unidades: [] };
        const buscar = sinon.stub(dao, "buscarFactura"); buscar.onFirstCall().resolves(null); buscar.onSecondCall().resolves({ factura });
        sinon.stub(dao.facturas, "crear").rejects(new Error("Respuesta perdida"));
        sinon.stub(dao, "cargar").resolves({ factura, total: 400, pagado: 0, saldo: 400 });
        const resultado = await dao.emitir(orden, "web", "cajero");
        expect(resultado.factura.idFactura).to.equal("f1");
        sinon.assert.calledOnce(dao.facturas.crear);
        expect(dao.facturas.crear.firstCall.args[0]).to.deep.equal({ idOrden: "o1", idCaja: "web", idEmpleadoRol: "cajero", cliente: "Ana", observaciones: "Orden o1" });
    });

    test("anula con motivo mediante el recurso original y conserva la factura", async function () {
        sinon.stub(dao, "cargar").resolves({ factura, pagado: 0, saldo: 400 });
        const anular = sinon.stub(dao.facturas, "anular").resolves({ ...factura, estado: "ANULADA" });
        const resultado = await dao.anular({ idOrden: "o1" }, "cajero", "  Pedido duplicado  ");
        expect(resultado.estado).to.equal("ANULADA");
        expect(anular.firstCall.args).to.deep.equal(["f1", "Orden anulada: Pedido duplicado"]);
        sinon.assert.notCalled(dao.pagos.crear);
    });

    test("rechaza anular sin motivo o con pagos y no llama al endpoint de anulación", async function () {
        sinon.stub(dao, "cargar").resolves({ factura, pagado: 200, saldo: 200 });
        const anular = sinon.stub(dao.facturas, "anular");
        expect((await dao.anular({}, "cajero", " ").catch(e => e)).message).to.include("motivo");
        expect((await dao.anular({}, "cajero", "Cancelado").catch(e => e)).message).to.include("pagos registrados");
        sinon.assert.notCalled(anular);
    });

    test("una orden anulada no puede volver a facturarse ni cobrarse", async function () {
        sinon.stub(dao.facturas, "listarTodos").resolves([{ ...factura, estado: "ANULADA", observaciones: "Anulación: Orden anulada: Duplicado" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" } }]);
        const crear = sinon.stub(dao.facturas, "crear");
        const orden = { unidades: [{ idOrdenProducto: "u1" }] };
        expect((await dao.emitir(orden, "web", "cajero").catch(e => e)).message).to.include("anulada");
        sinon.assert.notCalled(crear); sinon.assert.notCalled(dao.pagos.crear);
    });

    test("bloquea anulaciones simultáneas durante la consulta y recupera una respuesta perdida", async function () {
        let resolver;
        sinon.stub(dao, "cargar").returns(new Promise(resolve => { resolver = resolve; }));
        sinon.stub(dao.facturas, "anular").rejects(new Error("Respuesta perdida"));
        sinon.stub(dao.facturas, "findById").resolves({ ...factura, estado: "ANULADA", observaciones: "Anulación: Orden anulada: Duplicado" });
        const primera = dao.anular({}, "cajero", "Duplicado");
        expect((await dao.anular({}, "cajero", "Duplicado").catch(e => e)).message).to.include("Espera");
        resolver({ factura, pagado: 0, saldo: 400 });
        expect((await primera).estado).to.equal("ANULADA");
        sinon.assert.calledOnce(dao.facturas.anular);
    });

    test("vuelve a consultar pagos antes de anular aunque la pantalla mostraba saldo íntegro", async function () {
        sinon.stub(dao, "cargar").resolves({ factura, pagado: 0, saldo: 400 });
        const anular = sinon.stub(dao.facturas, "anular");
        await dao.abonar(factura, "2", "EFECTIVO");
        expect((await dao.anular({}, "cajero", "Duplicado").catch(e => e)).message).to.include("pagos registrados");
        sinon.assert.notCalled(anular);
    });

    test("no vuelve a emitir una orden con factura anulada sin marca web, y prioriza una factura vigente", async function () {
        const listar = sinon.stub(dao.facturas, "listarTodos").resolves([{ ...factura, estado: "ANULADA", observaciones: "Anulación: Cancelada desde caja" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" } }]);
        const crear = sinon.stub(dao.facturas, "crear");
        const orden = { unidades: [{ idOrdenProducto: "u1" }] };
        expect((await dao.emitir(orden, "web", "cajero").catch(e => e)).message).to.include("anulada");
        sinon.assert.notCalled(crear);
        listar.resolves([{ ...factura, estado: "ANULADA" }, { ...factura, idFactura: "vigente", estado: "PARCIAL" }]);
        expect((await dao.buscarFactura(orden)).factura.idFactura).to.equal("vigente");
    });

    test("la sincronización de caja reutiliza el detalle fijo y consulta saldos sin recargar el catálogo", async function () {
        sinon.stub(dao.facturas, "findById").resolves(factura);
        const cargar = sinon.stub(dao, "cargar"), productos = sinon.stub(dao.recepcion, "detalle"), cajas = sinon.stub(dao.cajas, "listarTodos");
        const lineas = [{ nombre: "Café", cantidad: 2, precio: 2 }];
        await dao.abonar(factura, "1", "EFECTIVO");
        const detalles = PagoDetalleDao.prototype.listarTodos.callCount;
        const datos = await dao.actualizar({}, { factura, lineas, nombreCaja: "Caja Virtual" });
        expect(datos.saldo).to.equal(300); expect(datos.lineas).to.equal(lineas);
        expect(PagoDetalleDao.prototype.listarTodos.callCount).to.equal(detalles);
        sinon.assert.notCalled(cargar); sinon.assert.notCalled(productos); sinon.assert.notCalled(cajas);
    });
});
mocha.run();
