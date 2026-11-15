import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import "../../../src/instalar.js";

mocha.setup("tdd");

suite("Instalación PWA: Unidad", function () {
    let componente;
    const ofrecerInstalacion = () => {
        const evento = new Event("beforeinstallprompt", { cancelable: true });
        evento.prompt = sinon.stub().resolves();
        window.dispatchEvent(evento);
        return evento;
    };

    teardown(() => {
        componente?.remove();
        window.dispatchEvent(new Event("appinstalled"));
    });

    test("retiene una oferta recibida antes de abrir Inicio y la consume con un solo clic", function () {
        const oferta = ofrecerInstalacion();
        expect(oferta.defaultPrevented).to.be.true;
        sinon.assert.notCalled(oferta.prompt);

        componente = document.body.appendChild(document.createElement("instalar-app"));
        expect(componente.hidden).to.be.false;
        const boton = componente.shadowRoot.querySelector("button");
        boton.click();
        boton.click();
        sinon.assert.calledOnce(oferta.prompt);
        expect(componente.hidden).to.be.true;
    });

    test("appinstalled retira una oferta pendiente e impide abrir de nuevo el diálogo", function () {
        componente = document.body.appendChild(document.createElement("instalar-app"));
        expect(componente.hidden).to.be.true;
        const oferta = ofrecerInstalacion();
        expect(componente.hidden).to.be.false;

        window.dispatchEvent(new Event("appinstalled"));
        componente.shadowRoot.querySelector("button").click();
        expect(componente.hidden).to.be.true;
        sinon.assert.notCalled(oferta.prompt);
    });
});

mocha.run();
