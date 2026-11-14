import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";
import OrdenProductoDao from "../../../src/js/control/orden_producto_dao.js";
import FacturaOrdenProductoDao from "../../../src/js/control/factura_orden_producto_dao.js";
import { leerPreparacion, escribirPreparacion, MARCA_PREPARACION, ordenConPreparacion } from "../../../src/js/control/preparacion_estado.js";

mocha.setup("tdd");
suite("RecepcionOrdenDao: Unidad", function () {
    teardown(() => sinon.restore());

    test("separa cocina y caja: emitidas y parciales van a pago; anuladas permiten preparar", async function () {
        const dao = new RecepcionOrdenDao();
        const ids = ["nueva", "emitida", "parcial", "anulada", "pagada", "mixta", "vacia"];
        sinon.stub(dao.ordenes, "listarTodos").resolves(ids.map((idOrden, i) => ({ idOrden, fechaOrden: `2026-11-${String(12 - i).padStart(2, "0")}T12:00:00Z` })));
        sinon.stub(dao.facturas, "listarTodos").resolves([
            { idFactura: "f1", estado: "EMITIDA" }, { idFactura: "f2", estado: "PARCIAL" },
            { idFactura: "f3", estado: "ANULADA" }, { idFactura: "f4", estado: "PAGADA" }
        ]);
        const detalles = sinon.stub(OrdenProductoDao.prototype, "listarTodos").callsFake(function () {
            const id = this.URL.split("/").at(-2);
            return Promise.resolve(id === "vacia" ? [] : (id === "mixta" ? ["mixta1", "mixta2"] : [id]).map(idOrdenProducto => ({ idOrdenProducto })));
        });
        const facturadas = sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").callsFake(function () {
            const factura = this.URL.split("/").at(-2);
            return Promise.resolve(({ f1: ["emitida"], f2: ["parcial"], f4: ["pagada", "mixta1"] }[factura] || [])
                .map(idOrdenProducto => ({ idOrdenProducto: { idOrdenProducto } })));
        });
        expect((await dao.pendientes()).map(o => o.idOrden)).to.deep.equal(["anulada", "nueva"]);
        sinon.assert.callCount(facturadas, 4);
        sinon.assert.callCount(detalles, 7);
        expect((await dao.paraFacturacion()).map(o => o.idOrden)).to.deep.equal(["mixta", "parcial", "emitida"]);
        expect(facturadas.getCalls().some(llamada => llamada.thisValue.URL.includes("/f3/"))).to.be.true;
    });

    test("la unión de varias facturas pagadas cubre todas las unidades de una orden", async function () {
        const dao = new RecepcionOrdenDao();
        sinon.stub(dao.ordenes, "listarTodos").resolves([{ idOrden: "orden" }]);
        sinon.stub(dao.facturas, "listarTodos").resolves([{ idFactura: "f1", estado: "PAGADA" }, { idFactura: "f2", estado: "PAGADA" }]);
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: "u1" }, { idOrdenProducto: "u2" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").callsFake(function () {
            return Promise.resolve([{ idOrdenProducto: { idOrdenProducto: this.URL.includes("/f1/") ? "u1" : "u2" } }]);
        });
        expect(await dao.pendientes()).to.deep.equal([]);
        expect(await dao.paraFacturacion()).to.deep.equal([]);
    });

    test("reutiliza detalles cerrados pero sigue consultando las órdenes abiertas y los estados de factura", async function () {
        const dao = new RecepcionOrdenDao();
        sinon.stub(dao.ordenes, "listarTodos").resolves([{ idOrden: "pagada" }, { idOrden: "pendiente" }]);
        const facturas = sinon.stub(dao.facturas, "listarTodos").resolves([{ idFactura: "f1", estado: "PAGADA" }]);
        const detalles = sinon.stub(OrdenProductoDao.prototype, "listarTodos").callsFake(function () {
            return Promise.resolve([{ idOrdenProducto: this.URL.includes("/pagada/") ? "u1" : "u2" }]);
        });
        const vinculos = sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" } }]);
        await dao.pendientes(); await dao.pendientes();
        sinon.assert.calledTwice(facturas); sinon.assert.calledOnce(vinculos);
        expect(detalles.getCalls().filter(c => c.thisValue.URL.includes("/pagada/")).length).to.equal(1);
        expect(detalles.getCalls().filter(c => c.thisValue.URL.includes("/pendiente/")).length).to.equal(2);
    });

    test("una orden anulada con motivo no reaparece en cocina ni en pagos", async function () {
        const dao = new RecepcionOrdenDao();
        sinon.stub(dao.ordenes, "listarTodos").resolves([{ idOrden: "orden", observacion: "Cliente: Ana\nEstado: Despachada" }]);
        sinon.stub(dao.facturas, "listarTodos").resolves([{ idFactura: "f1", estado: "ANULADA", observaciones: "Anulación: Orden anulada: Duplicado" }]);
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: "u1" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" } }]);
        expect(await dao.pendientes()).to.deep.equal([]);
        expect(await dao.paraFacturacion()).to.deep.equal([]);
    });

    test("reúne cantidades, conserva presentaciones y consulta nombres aunque el producto esté inactivo", async function () {
        const dao = new RecepcionOrdenDao();
        const nombres = sinon.stub(dao.productos, "findById").callsFake(async idProducto => ({ idProducto, nombre: "Macchiato", activo: false }));
        const lineas = await dao.detalle({ unidades: [
            { idProducto: { idProducto: "12" }, precio: 1.75, observaciones: "Pedido web ref/12/1 · 12 Onzas" },
            { idProducto: { idProducto: "12" }, precio: 1.75, observaciones: "Pedido web ref/12/2 · 12 Onzas" },
            { idProducto: { idProducto: "16" }, precio: 2.25, observaciones: "Pedido web ref/16/1 · 16 Onzas" },
            { idProducto: { idProducto: "16" }, precio: 2.25, observaciones: "Sin azúcar" }
        ] });
        sinon.assert.calledTwice(nombres);
        expect(lineas.map(l => [l.cantidad, l.presentacion, l.precio])).to.deep.equal([[2, "12 Onzas", 1.75], [1, "16 Onzas", 2.25], [1, "Sin azúcar", 2.25]]);
        expect(lineas[0].nombre).to.equal("Macchiato");
    });

    test("una orden despachada cuya única factura fue anulada no aparece en pagos, aunque el motivo no tenga una marca web", async function () {
        const dao = new RecepcionOrdenDao();
        sinon.stub(dao.ordenes, "listarTodos").resolves([{ idOrden: "o1", observacion: "Cliente: Ana\nEstado: Despachada" }]);
        const facturas = sinon.stub(dao.facturas, "listarTodos").resolves([{ idFactura: "anterior", estado: "ANULADA", observaciones: "Anulación: Pedido cancelado" }]);
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: "u1" }]);
        sinon.stub(FacturaOrdenProductoDao.prototype, "listarTodos").resolves([{ idOrdenProducto: { idOrdenProducto: "u1" } }]);
        expect(await dao.paraFacturacion()).to.deep.equal([]);
        facturas.resolves([{ idFactura: "anterior", estado: "ANULADA" }, { idFactura: "vigente", estado: "PARCIAL" }]);
        expect((await dao.paraFacturacion()).map(o => o.idOrden)).to.deep.equal(["o1"]);
    });

    test("no clasifica órdenes como pendientes si falla la lectura de pagos", async function () {
        const dao = new RecepcionOrdenDao();
        sinon.stub(dao.ordenes, "listarTodos").resolves([{ idOrden: "orden" }]);
        sinon.stub(dao.facturas, "listarTodos").rejects(new Error("Sin conexión"));
        expect((await dao.pendientes().catch(e => e)).message).to.equal("Sin conexión");
    });

    test("guarda estados legibles con los PUT existentes y conserva los datos originales", async function () {
        const dao = new RecepcionOrdenDao();
        const original = { idOrden: "orden", fechaOrden: "2026-11-12T12:00:00Z", observacion: "Cliente: Ana · Pedido web ref", idEmpleadoRol: { idEmpleadoRol: "camarero-original" } };
        let guardada = structuredClone(original);
        const unidades = ["u1", "u2"].map(idOrdenProducto => ({ idOrdenProducto, idProducto: { idProducto: "cafe" }, precio: 2 }));
        sinon.stub(dao.ordenes, "findById").callsFake(async () => structuredClone(guardada));
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves(unidades);
        sinon.stub(OrdenProductoDao.prototype, "solicitarJson").callsFake(async (url, opciones) => JSON.parse(opciones.body));
        sinon.stub(dao, "sinPagar").callsFake(async () => [{ ...guardada, unidades }]);
        const guardar = sinon.stub(dao.ordenes, "solicitarJson").callsFake(async (url, opciones) => { guardada = JSON.parse(opciones.body); return structuredClone(guardada); });
        let orden = (await dao.pendientes())[0];
        orden = await dao.cambiarPreparacion(orden, "barista", "PREPARAR");
        orden = await dao.cambiarPreparacion(orden, "barista", "ITEM", "u1", true);
        expect(orden.listos).to.deep.equal(["u1"]);
        expect((await dao.cambiarPreparacion(orden, "barista", "DESPACHAR").catch(e => e)).message).to.include("Todos los ítems");
        orden = await dao.cambiarPreparacion(orden, "barista", "ITEM", "u1", false);
        expect(orden.listos).to.deep.equal([]);
        orden = await dao.cambiarPreparacion(orden, "barista", "ITEM", "u1", true);
        orden = await dao.cambiarPreparacion(orden, "barista", "ITEM", "u2", true);
        orden = await dao.cambiarPreparacion(orden, "barista", "DESPACHAR");
        expect(orden.estadoPreparacion).to.equal("DESPACHADA");
        expect(await dao.pendientes()).to.deep.equal([]);
        expect((await dao.paraFacturacion())[0].observacion).to.equal(original.observacion);
        expect(guardada.idEmpleadoRol).to.deep.equal(original.idEmpleadoRol);
        expect(guardada.fechaOrden).to.equal(original.fechaOrden);
        expect(leerPreparacion(guardada.observacion).texto).to.equal(original.observacion);
        for (const llamada of guardar.getCalls()) {
            expect(llamada.args[0]).to.equal(dao.ordenes.URL + "/orden");
            expect(llamada.args[1].method).to.equal("PUT");
            expect(Object.keys(JSON.parse(llamada.args[1].body))).to.have.members(Object.keys(original));
        }
        const llamadas = guardar.callCount;
        await dao.cambiarPreparacion(orden, "barista", "DESPACHAR");
        expect(guardar.callCount).to.equal(llamadas);
    });

    test("detecta cambios anteriores e ítems ajenos antes de guardar", async function () {
        const dao = new RecepcionOrdenDao();
        const actual = { idOrden: "orden", observacion: escribirPreparacion("Cliente", { estado: "EN_PREPARACION", version: 2, listos: [] }) };
        sinon.stub(dao.ordenes, "findById").resolves(actual);
        const unidades = [{ idOrdenProducto: "u1" }];
        const anterior = ordenConPreparacion(actual, unidades);
        unidades[0].observaciones = "Preparación modificada";
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves(unidades);
        const guardar = sinon.stub(dao.ordenes, "solicitarJson");
        expect((await dao.cambiarPreparacion(anterior, "barista", "ITEM", "u1", true).catch(e => e)).message).to.include("otra pantalla");
        expect((await dao.cambiarPreparacion(ordenConPreparacion(actual, unidades), "barista", "ITEM", "ajeno", true).catch(e => e)).message).to.include("no pertenece");
        sinon.assert.notCalled(guardar);
    });

    test("marca las unidades con texto legible sin volver a escribir la cabecera", async function () {
        const dao = new RecepcionOrdenDao();
        const observacion = escribirPreparacion("Cliente: Ana", { estado: "EN_PREPARACION", version: 1, listos: ["u1"] });
        sinon.stub(dao.ordenes, "findById").resolves({ idOrden: "orden", observacion });
        const unidades = ["u1", "u2", "u3"].map(idOrdenProducto => ({ idOrdenProducto, observaciones: idOrdenProducto === "u1" ? "12 oz\nPreparación: Listo" : "12 oz" }));
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves(unidades);
        const guardar = sinon.stub(dao.ordenes, "solicitarJson");
        const guardarItems = sinon.stub(OrdenProductoDao.prototype, "solicitarJson").callsFake(async (url, opciones) => JSON.parse(opciones.body));
        const orden = await dao.cambiarPreparacion({ idOrden: "orden", versionPreparacion: 1 }, "barista", "TODOS_LISTOS");
        expect(orden.listos).to.have.members(["u1", "u2", "u3"]);
        expect(orden.estadoPreparacion).to.equal("EN_PREPARACION");
        expect(orden.observacion).to.equal("Cliente: Ana");
        sinon.assert.notCalled(guardar);
        sinon.assert.calledTwice(guardarItems);
        expect(unidades.every(u => u.observaciones === "12 oz\nPreparación: Listo")).to.be.true;
        dao.ordenes.findById.resolves({ idOrden: "orden", observacion: escribirPreparacion("Cliente: Ana", { estado: "EN_PREPARACION", version: 2, listos: ["u1", "u2", "u3"] }) });
        const pendiente = await dao.cambiarPreparacion({ idOrden: "orden", versionPreparacion: 2 }, "barista", "ITEM", ["u1", "u2"], false);
        expect(pendiente.listos).to.deep.equal(["u3"]);
    });

    test("convierte el JSON anterior al guardar sin perder los ítems que ya estaban listos", async function () {
        const dao = new RecepcionOrdenDao();
        const original = "Cliente: Ana · Pedido web ref";
        const actual = { idOrden: "orden", observacion: original + MARCA_PREPARACION + JSON.stringify({ estado: "EN_PREPARACION", version: 4, listos: ["u1"] }) };
        const unidades = ["u1", "u2"].map(idOrdenProducto => ({ idOrdenProducto, observaciones: "12 oz" }));
        sinon.stub(dao.ordenes, "findById").resolves(actual);
        sinon.stub(OrdenProductoDao.prototype, "listarTodos").resolves(unidades);
        sinon.stub(OrdenProductoDao.prototype, "solicitarJson").callsFake(async (url, opciones) => JSON.parse(opciones.body));
        const guardar = sinon.stub(dao.ordenes, "solicitarJson").callsFake(async (url, opciones) => JSON.parse(opciones.body));
        const resultado = await dao.cambiarPreparacion(ordenConPreparacion(actual, unidades), "barista", "ITEM", "u2", true);
        expect(resultado.listos).to.have.members(["u1", "u2"]);
        expect(JSON.parse(guardar.firstCall.args[1].body).observacion).to.equal(original + "\nEstado: En preparación");
        expect(unidades.every(u => u.observaciones === "12 oz\nPreparación: Listo")).to.be.true;
    });
});
mocha.run();
