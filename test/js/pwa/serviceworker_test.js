import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";

mocha.setup("tdd");

suite("Service worker: Unidad", function () {
    const origen = "https://cafefe.test";
    const ambito = origen + "/cafeteria/";
    const prefijo = ambito + "::cafefe.app.cache.";
    let codigo, eventos, cache, caches, red, claim, skipWaiting;

    suiteSetup(async () => {
        const respuesta = await fetch(new URL("../../../src/serviceworker.js", import.meta.url));
        expect(respuesta.ok).to.be.true;
        codigo = await respuesta.text();
    });

    setup(() => {
        eventos = new Map();
        cache = { addAll: sinon.stub().resolves(), match: sinon.stub().resolves(undefined), put: sinon.spy() };
        caches = { open: sinon.stub().resolves(cache), keys: sinon.stub(), delete: sinon.stub().resolves(true) };
        red = sinon.stub().resolves(new Response("red"));
        claim = sinon.stub().resolves();
        skipWaiting = sinon.stub();
        const worker = {
            registration: { scope: ambito }, location: { origin: origen },
            clients: { claim }, skipWaiting,
            addEventListener: (tipo, accion) => eventos.set(tipo, accion)
        };
        // Ejecuta el script clásico real con las API del worker aisladas.
        new Function("self", "caches", "fetch", codigo)(worker, caches, red);
    });

    function ciclo(tipo) {
        const waitUntil = sinon.spy();
        eventos.get(tipo)({ waitUntil });
        sinon.assert.calledOnce(waitUntil);
        return waitUntil.firstCall.args[0];
    }

    function solicitar(ruta, opciones = {}) {
        const respondWith = sinon.spy();
        const request = {
            url: new URL(ruta, ambito).href, method: "GET", mode: "cors",
            headers: new Headers(), ...opciones
        };
        eventos.get("fetch")({ request, respondWith });
        return { respuesta: respondWith.firstCall?.args[0], request };
    }

    test("propaga un fallo de precarga e impide activar a la fuerza una versión incompleta", async function () {
        const fallo = new Error("No se pudo guardar el CSS");
        cache.addAll.rejects(fallo);

        expect(await ciclo("install").catch(error => error)).to.equal(fallo);
        sinon.assert.notCalled(skipWaiting);
        const peticiones = cache.addAll.firstCall.args[0];
        expect(peticiones.map(p => p.url)).to.include(ambito + "index.html");
        expect(peticiones.every(p => p.cache === "reload" && p.url.startsWith(ambito))).to.be.true;
    });

    test("al activar elimina versiones anteriores del mismo ámbito y conserva cachés ajenas", async function () {
        await ciclo("install");
        const actual = caches.open.firstCall.args[0];
        const anterior = prefijo + "anterior";
        caches.keys.resolves([actual, anterior, "otra-aplicacion", origen + "/otra/::cafefe.app.cache.v1"]);
        await ciclo("activate");

        sinon.assert.calledOnceWithExactly(caches.delete, anterior);
        sinon.assert.callOrder(caches.delete, claim);
    });

    test("sirve la raíz y un módulo desde caché aunque falle la red", async function () {
        red.rejects(new TypeError("Sin red"));
        cache.match.withArgs(ambito + "index.html").resolves(new Response("HTML"));
        cache.match.withArgs(ambito + "app.js").resolves(new Response("módulo"));

        expect(await (await solicitar("./", { mode: "navigate" }).respuesta).text()).to.equal("HTML");
        expect(await (await solicitar("app.js").respuesta).text()).to.equal("módulo");
        sinon.assert.notCalled(red);
    });

    test("usa la red para un recurso estático ausente sin almacenarlo", async function () {
        const { respuesta, request } = solicitar("app.js");
        expect(await (await respuesta).text()).to.equal("red");
        sinon.assert.calledOnceWithExactly(red, request);
        sinon.assert.notCalled(cache.put);
        sinon.assert.notCalled(cache.addAll);
    });

    test("no intercepta API, desarrollo, escrituras ni variantes de recursos que no se precargaron", function () {
        const casos = [
            ["resources/v1/orden"], ["browser-sync/socket"], ["socket.io/"],
            ["index.html", { method: "POST" }], ["app.js?otra=version"], ["otro.html", { mode: "navigate" }],
            ["https://otro.test/app.js"], ["app.js", { headers: new Headers({ Authorization: "Bearer prueba" }) }],
            ["app.js", { headers: new Headers({ Range: "bytes=0-2" }) }]
        ];
        for (const [ruta, opciones] of casos) {
            expect(solicitar(ruta, opciones).respuesta, ruta).to.equal(undefined);
        }
        sinon.assert.notCalled(caches.open);
        sinon.assert.notCalled(red);
    });
});

mocha.run();
