import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import BusquedaCatalogo from "../../../src/js/control/busqueda_catalogo.js";

mocha.setup("tdd");
suite("BusquedaCatalogo: Unidad", function () {
    let busqueda, worker;
    const productos = [
        { idProducto: "latte", nombre: "Café Latte", comentarios: "Con leche deslactosada", precioSugerido: 2 },
        { idProducto: "te", nombre: "Té frío", comentarios: "Con limón", precioSugerido: 1 },
        { idProducto: "pan", nombre: "Pan integral", comentarios: "Con semillas", precioSugerido: 1.5 }
    ];
    /** Instala un hilo simulado para controlar fallos y el orden de las respuestas. */
    function simularWorker() {
        worker = { postMessage: sinon.spy(), terminate: sinon.spy() };
        sinon.stub(window, "Worker").callsFake(function () { return worker; });
    }
    setup(() => { busqueda = new BusquedaCatalogo(); });
    teardown(() => { busqueda.detener(); sinon.restore(); });

    test("conserva la búsqueda cuando el navegador no soporta Worker", async function () {
        sinon.stub(window, "Worker").value(undefined);
        busqueda.establecerProductos(productos);
        expect(await busqueda.buscar("cafe leche")).to.deep.equal([0]);
        expect(await busqueda.buscar("semillas")).to.deep.equal([2]);
        expect(busqueda.worker).to.equal(null);
    });

    test("si falla la construcción utiliza el respaldo y evita repetir el mismo fallo", async function () {
        const construir = sinon.stub(window, "Worker").throws(new Error("Worker no permitido"));
        busqueda.establecerProductos(productos);
        expect(await busqueda.buscar("TE frio")).to.deep.equal([1]);
        busqueda.establecerProductos([{ nombre: "Chocolate" }]);
        expect(await busqueda.buscar("chocolate")).to.deep.equal([0]);
        sinon.assert.calledOnce(construir);
    });

    test("relaciona respuestas fuera de orden con su consulta y envía solamente textos al Worker", async function () {
        simularWorker();
        busqueda.establecerProductos(productos);
        const mensajeIndice = worker.postMessage.firstCall.args[0];
        expect(mensajeIndice.productos).to.deep.equal(productos.map(({ nombre, comentarios }) => ({ nombre, comentarios })));
        const primera = busqueda.buscar("cafe"), segunda = busqueda.buscar("pan");
        const mensajeUno = worker.postMessage.secondCall.args[0], mensajeDos = worker.postMessage.thirdCall.args[0];
        worker.onmessage({ data: { id: mensajeDos.id, version: mensajeDos.version, indices: [2] } });
        worker.onmessage({ data: { id: mensajeUno.id, version: mensajeUno.version, indices: [0] } });
        expect(await primera).to.deep.equal([0]);
        expect(await segunda).to.deep.equal([2]);
        expect(busqueda.pendientes.size).to.equal(0);
    });

    test("reemplazar el índice cancela consultas anteriores e ignora sus respuestas tardías", async function () {
        simularWorker();
        busqueda.establecerProductos(productos);
        const anterior = busqueda.buscar("cafe");
        const mensajeAnterior = worker.postMessage.lastCall.args[0];
        busqueda.establecerProductos([{ nombre: "Torta" }, { nombre: "Chocolate" }]);
        expect(await anterior).to.deep.equal([]);
        const actual = busqueda.buscar("chocolate");
        const mensajeActual = worker.postMessage.lastCall.args[0];
        worker.onmessage({ data: { id: mensajeAnterior.id, version: mensajeAnterior.version, indices: [0] } });
        expect(busqueda.pendientes.size).to.equal(1);
        worker.onmessage({ data: { id: mensajeActual.id, version: mensajeActual.version, indices: [1] } });
        expect(await actual).to.deep.equal([1]);
    });

    test("un error del hilo completa consultas pendientes por el respaldo sin bloquear la pantalla", async function () {
        simularWorker();
        busqueda.establecerProductos(productos);
        const resultado = busqueda.buscar("semillas"), preventDefault = sinon.spy();
        worker.onerror({ preventDefault });
        expect(await resultado).to.deep.equal([2]);
        expect(await busqueda.buscar("limon")).to.deep.equal([1]);
        sinon.assert.calledOnce(worker.terminate);
        sinon.assert.calledOnce(preventDefault);
        expect(busqueda.pendientes.size).to.equal(0);
    });

    test("si no puede enviar el índice al hilo conserva las búsquedas mediante el respaldo", async function () {
        simularWorker();
        worker.postMessage = sinon.stub().throws(new DOMException("No se pudo copiar el mensaje", "DataCloneError"));
        busqueda.establecerProductos(productos);
        expect(await busqueda.buscar("cafe leche")).to.deep.equal([0]);
        sinon.assert.calledOnce(worker.terminate);
        expect(busqueda.worker).to.equal(null);
    });

    test("un error al recibir mensajes resuelve consultas pendientes sin dejarlas bloqueadas", async function () {
        simularWorker();
        busqueda.establecerProductos(productos);
        const resultado = busqueda.buscar("frio limon");
        worker.onmessageerror();
        expect(await resultado).to.deep.equal([1]);
        expect(busqueda.pendientes.size).to.equal(0);
        sinon.assert.calledOnce(worker.terminate);
    });

    test("un hilo que no responde vence y resuelve la consulta con el mismo filtro", async function () {
        simularWorker();
        const reloj = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        busqueda.establecerProductos(productos);
        const resultado = busqueda.buscar("PAN semillas");
        await reloj.tickAsync(2000);
        expect(await resultado).to.deep.equal([2]);
        sinon.assert.calledOnce(worker.terminate);
    });

    test("al retirar la pantalla termina el hilo y resuelve todas las consultas vigentes", async function () {
        simularWorker();
        busqueda.establecerProductos(productos);
        const primero = busqueda.buscar("cafe"), segundo = busqueda.buscar("te frio");
        busqueda.detener();
        expect(await primero).to.deep.equal([0]);
        expect(await segundo).to.deep.equal([1]);
        sinon.assert.calledOnce(worker.terminate);
        expect(busqueda.worker).to.equal(null);
        expect(busqueda.pendientes.size).to.equal(0);
    });

});
mocha.run();
