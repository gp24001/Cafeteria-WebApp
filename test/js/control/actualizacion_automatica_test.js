import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import ActualizacionAutomatica from "../../../src/js/control/actualizacion_automatica.js";

mocha.setup("tdd");
suite("ActualizacionAutomatica: Unidad", function () {
    let reloj, actualizacion, oculta, conectada;
    setup(() => {
        reloj = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        oculta = false; conectada = true;
        sinon.stub(document, "hidden").get(() => oculta);
        sinon.stub(navigator, "onLine").get(() => conectada);
    });
    teardown(() => { actualizacion?.detener(); reloj.restore(); sinon.restore(); });

    test("consulta por intervalo y deja de hacerlo al retirar la pantalla", async function () {
        const consultar = sinon.stub().resolves();
        actualizacion = new ActualizacionAutomatica(consultar, 1000);
        actualizacion.iniciar();
        await reloj.tickAsync(2000);
        sinon.assert.calledTwice(consultar);
        actualizacion.detener(); await reloj.tickAsync(2000);
        window.dispatchEvent(new Event("focus"));
        sinon.assert.calledTwice(consultar);
    });

    test("no solapa consultas lentas y reintenta después de un fallo", async function () {
        let resolver;
        const consultar = sinon.stub();
        consultar.onFirstCall().returns(new Promise(resolve => { resolver = resolve; }));
        consultar.onSecondCall().rejects(new Error("Sin conexión"));
        consultar.onThirdCall().resolves();
        actualizacion = new ActualizacionAutomatica(consultar, 1000);
        actualizacion.iniciar(); await reloj.tickAsync(3000);
        sinon.assert.calledOnce(consultar);
        resolver(); await reloj.tickAsync(2500);
        sinon.assert.calledThrice(consultar);
        expect(actualizacion.ocupada).to.be.false;
    });

    test("pausa oculta o sin red y consulta al recuperar visibilidad", async function () {
        oculta = true;
        const consultar = sinon.stub().resolves();
        actualizacion = new ActualizacionAutomatica(consultar, 1000);
        actualizacion.iniciar(); await reloj.tickAsync(1000);
        sinon.assert.notCalled(consultar);
        oculta = false; conectada = false; await reloj.tickAsync(1000);
        sinon.assert.notCalled(consultar);
        conectada = true; document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve(); sinon.assert.calledOnce(consultar);
    });

    test("espacia consultas sin cambios y no consulta al enfocar un campo", async function () {
        const consultar = sinon.stub().resolves(false);
        actualizacion = new ActualizacionAutomatica(consultar, 1000);
        actualizacion.iniciar();
        await reloj.tickAsync(1000); sinon.assert.calledOnce(consultar);
        window.dispatchEvent(new Event("focus"));
        await reloj.tickAsync(1000); sinon.assert.calledOnce(consultar);
        await reloj.tickAsync(500); sinon.assert.calledTwice(consultar);
        expect(actualizacion.espera).to.equal(2250);
    });
});
mocha.run();
