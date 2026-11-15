import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import "../../../src/instalar.js";
import "../../../src/js/boundary/components/bienvenida/bienvenida.js";

mocha.setup("tdd");

suite("PWA: Integración", function () {
    let inicio;
    teardown(() => {
        inicio?.remove();
        window.dispatchEvent(new Event("appinstalled"));
    });

    test("Inicio ofrece instalar al recibir el evento y llama al diálogo solo al pulsar el botón", function () {
        inicio = document.body.appendChild(document.createElement("inicio-model"));
        const componente = inicio.shadowRoot.querySelector("instalar-app");
        expect(componente.hidden).to.be.true;

        const oferta = new Event("beforeinstallprompt", { cancelable: true });
        oferta.prompt = sinon.stub().resolves();
        window.dispatchEvent(oferta);
        expect(componente.hidden).to.be.false;
        sinon.assert.notCalled(oferta.prompt);
        componente.shadowRoot.querySelector("button").click();
        sinon.assert.calledOnce(oferta.prompt);
    });

    test("el manifest enlazado desde la entrada carga sus iconos y capturas con dimensiones correctas", async function () {
        const entrada = new URL("../../../src/index.html", import.meta.url);
        const html = await (await fetch(entrada)).text();
        const documento = new DOMParser().parseFromString(html, "text/html");
        const enlace = documento.querySelector('link[rel="manifest"]');
        expect(enlace).to.exist;

        const url = new URL(enlace.getAttribute("href"), entrada);
        const manifest = await (await fetch(url)).json();
        expect(manifest.display).to.equal("standalone");
        expect(new URL(manifest.start_url, url).href.startsWith(new URL(manifest.scope, url).href)).to.be.true;
        expect(manifest.icons.map(icono => icono.sizes)).to.include.members(["192x192", "512x512"]);
        expect(manifest.screenshots.map(captura => captura.form_factor)).to.include.members(["wide", "narrow"]);

        await Promise.all([...manifest.icons, ...manifest.screenshots].map(async recurso => {
            const imagen = new Image();
            imagen.src = new URL(recurso.src, url).href;
            await imagen.decode();
            expect(`${imagen.naturalWidth}x${imagen.naturalHeight}`, recurso.src).to.equal(recurso.sizes);
        }));
    });
});

mocha.run();
