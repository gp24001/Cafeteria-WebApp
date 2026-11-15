import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import "../../../src/app.js";
import { sesionEmpleado } from "../../../src/js/control/sesion_empleado.js";

mocha.setup("tdd");

suite("Cafefe: Integración del frontend con REST simulado", function () {
    this.timeout(5000);
    const id = "00000000-0000-4000-8000-000000000001";
    const ana = { idEmpleado: id, nombre: "Ana", activo: true };
    const virtual = { idEmpleado: "virtual", nombre: "Camarero", apellido: "Virtual", activo: true };
    const roles = [
        { idRol: "caja", nombre: "Cajera", activo: true },
        { idRol: "mesero", nombre: "Camarero", activo: true },
        { idRol: "barista", nombre: "Barista", activo: true }
    ];
    const asignaciones = rol => [{ idEmpleadoRol: rol, idRol: { idRol: rol }, activo: true }];
    const claveCarrito = "cafefe.carrito.v1";
    const claveSesion = sesionEmpleado.clave;
    const fetchReal = window.fetch.bind(window);
    let app, pedidos, unidades, llamadas, sinRespuesta, inesperadas, restaurar;
    let rolEmpleado, esperaEmpleado;

    async function esperar(comprobar) {
        const limite = performance.now() + 3000;
        while (!comprobar() && performance.now() < limite) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(comprobar(), "La interfaz no alcanzó el estado esperado").to.be.ok;
    }

    function respuesta(datos, status = 200) {
        const headers = { "Content-Type": "application/json" };
        if (Array.isArray(datos)) headers["Total-registros"] = String(datos.length);
        return new Response(JSON.stringify(datos), { status, headers });
    }

    setup(() => {
        pedidos = [];
        unidades = [];
        llamadas = [];
        inesperadas = [];
        sinRespuesta = true;
        rolEmpleado = "caja";
        esperaEmpleado = Promise.resolve();
        const urlAnterior = location.href;
        const tituloAnterior = document.title;
        const claves = [claveSesion, claveCarrito].map(clave => [clave, sessionStorage.getItem(clave)]);
        for (const [clave] of claves) sessionStorage.removeItem(clave);
        restaurar = () => {
            sinon.restore();
            history.replaceState(null, "", urlAnterior);
            document.title = tituloAnterior;
            for (const [clave, valor] of claves) {
                if (valor === null) sessionStorage.removeItem(clave);
                else sessionStorage.setItem(clave, valor);
            }
        };

        sinon.stub(window, "fetch").callsFake(async (recurso, opciones) => {
            const peticion = new Request(recurso, opciones);
            const url = new URL(peticion.url);
            const prefijo = "/cafefe-1.0-SNAPSHOT/resources/v1/";
            if (url.origin === location.origin && url.pathname.startsWith(new URL("../../../src/", import.meta.url).pathname)) {
                return fetchReal(peticion);
            }
            const ruta = url.pathname.slice(prefijo.length);
            const metodo = peticion.method;
            llamadas.push([metodo, ruta]);
            if (url.origin === "http://localhost:9080" && url.pathname.startsWith(prefijo)) {
                if (metodo === "GET") {
                    if (ruta === `empleado/${id}`) await esperaEmpleado;
                    const lecturas = {
                        [`empleado/${id}`]: ana,
                        [`empleado/${id}/rol`]: asignaciones(rolEmpleado),
                        "empleado/virtual/rol": asignaciones("mesero"),
                        empleado: [ana, virtual], rol: roles, orden: pedidos,
                        "orden/o1/producto": unidades, factura: [], tipoProducto: [], producto: []
                    };
                    if (Object.hasOwn(lecturas, ruta)) return respuesta(lecturas[ruta]);
                }
                if (metodo === "POST" && ruta === "orden") {
                    const orden = { ...(await peticion.json()), idOrden: "o1" };
                    pedidos.push(orden);
                    return respuesta(orden, 201);
                }
                if (metodo === "POST" && ruta === "orden/o1/producto") {
                    const unidad = { ...(await peticion.json()), idOrdenProducto: "u" + (unidades.length + 1) };
                    unidades.push(unidad);
                    if (sinRespuesta) {
                        sinRespuesta = false;
                        throw new TypeError("Se perdió la respuesta del servidor");
                    }
                    return respuesta(unidad, 201);
                }
            }
            inesperadas.push(`${metodo} ${url.href}`);
            return respuesta({ mensaje: "Ruta no simulada" }, 404);
        });
    });

    teardown(() => {
        app?.remove();
        app = null;
        sesionEmpleado.cerrar();
        restaurar();
        expect(inesperadas, inesperadas.join(", ")).to.deep.equal([]);
    });

    function abrir(hash) {
        history.replaceState(null, "", hash);
        app = document.body.appendChild(document.createElement("cafefe-app"));
        return app.shadowRoot;
    }

    const empleados = [
        ["caja", "pagos", "facturacion-model"],
        ["mesero", "productos", "producto-model"],
        ["barista", "preparacion", "preparacion-model"]
    ];

    for (const [rol, permitida, componente] of empleados) {
        test(rol + " ve su área y tiene bloqueadas las otras rutas incluso desde la URL", async function () {
            rolEmpleado = rol;
            const root = abrir("#inicio");
            await sesionEmpleado.iniciar("Ana", id);
            const menu = root.querySelector("menu-lateral").shadowRoot;
            const bienvenida = root.querySelector("inicio-model").shadowRoot;
            expect(Array.from(menu.querySelectorAll("nav a"), enlace => enlace.hash))
                .to.deep.equal(["#inicio", "#" + permitida]);
            expect(Array.from(bienvenida.querySelectorAll(".acciones a"), enlace => enlace.hash))
                .to.deep.equal(["#" + permitida]);

            menu.querySelector('a[href="#' + permitida + '"]').click();
            await esperar(() => root.querySelector(componente));
            await esperar(() => llamadas.some(([, ruta]) => ruta === (rol === "mesero" ? "producto" : "factura")));
            const consultas = llamadas.length;

            for (const ruta of ["productos", "productos/categoria-1", "preparacion", "pagos"]) {
                if (ruta.split("/")[0] === permitida) continue;
                history.replaceState(null, "", "#" + ruta);
                app.render();
                expect(root.querySelector("main").textContent).to.include("Tu rol no tiene acceso");
                expect(root.querySelector("producto-model, preparacion-model, facturacion-model")).to.equal(null);
                const carrito = root.querySelector("barra-superior").shadowRoot.querySelector("orden-model");
                expect(carrito.hidden).to.be.true;
            }
            expect(llamadas.length).to.equal(consultas);

            if (rol !== "mesero") {
                location.hash = "inicio";
                await esperar(() => root.querySelector("inicio-model"));
                location.hash = "productos";
                await esperar(() => root.querySelector("main").textContent.includes("Tu rol no tiene acceso"));
                expect(root.querySelector("producto-model")).to.equal(null);
            }
        });

        test("recargar Productos con sesión de " + rol + " espera la verificación antes de mostrar el catálogo", async function () {
            rolEmpleado = rol;
            let responderEmpleado;
            esperaEmpleado = new Promise(resolve => { responderEmpleado = resolve; });
            sessionStorage.setItem(claveSesion, JSON.stringify({ idEmpleado: id }));
            const root = abrir("#productos");
            try {
                expect(root.querySelector('[role="status"]').textContent).to.equal("Verificando sesión…");
                expect(root.querySelector("producto-model")).to.equal(null);
                expect(root.querySelector("barra-superior").shadowRoot.querySelector("orden-model").hidden).to.be.true;
                expect(llamadas.some(([, ruta]) => ruta === "producto" || ruta === "tipoProducto")).to.be.false;
            } finally {
                responderEmpleado();
                await sesionEmpleado.restauracion;
            }
            await esperar(() => root.querySelector(componente));
            const carrito = root.querySelector("barra-superior").shadowRoot.querySelector("orden-model");
            expect(carrito.hidden).to.equal(rol !== "mesero");
            if (rol !== "mesero") {
                expect(llamadas.some(([, ruta]) => ruta === "producto" || ruta === "tipoProducto")).to.be.false;
            }
        });
    }

    test("bloquea la entrada anónima a Cocina y Caja y limita los permisos tras iniciar sesión", async function () {
        const root = abrir("#preparacion");
        expect(root.querySelector("ingreso-model")).to.exist;
        expect(root.querySelector("preparacion-model")).to.equal(null);

        location.hash = "pagos";
        await esperar(() => document.title.startsWith("Pagos"));
        const ingreso = root.querySelector("ingreso-model");
        expect(ingreso).to.exist;
        expect(root.querySelector("facturacion-model")).to.equal(null);
        expect(llamadas).to.deep.equal([]);

        ingreso.shadowRoot.querySelector("#nombre").value = "Ana";
        ingreso.shadowRoot.querySelector("#identificador").value = id;
        ingreso.shadowRoot.querySelector("button").click();
        await esperar(() => root.querySelector("inicio-model"));
        expect(JSON.parse(sessionStorage.getItem(claveSesion))).to.deep.equal({ idEmpleado: id });

        location.hash = "preparacion";
        await esperar(() => root.querySelector("main").textContent.includes("Tu rol no tiene acceso"));
        expect(root.querySelector("preparacion-model")).to.equal(null);
        expect(llamadas.some(([, ruta]) => ruta === "orden")).to.be.false;

        location.hash = "pagos";
        await esperar(() => llamadas.some(([, ruta]) => ruta === "factura"));
        expect(root.querySelector("facturacion-model")).to.exist;
        root.querySelector("barra-superior").shadowRoot.querySelector(".salir").click();
        await esperar(() => root.querySelector("ingreso-model"));
        expect(root.querySelector("facturacion-model")).to.equal(null);
        expect(sessionStorage.getItem(claveSesion)).to.equal(null);
    });

    test("reconcilia un pedido cuyo servidor recibió una unidad antes de perder la conexión", async function () {
        let root = abrir("#productos");
        const carrito = () => root.querySelector("barra-superior").shadowRoot.querySelector("orden-model");
        app.shadowRoot.querySelector("main").dispatchEvent(new CustomEvent("agregar-producto", {
            bubbles: true, composed: true,
            detail: { idProducto: "p1", nombre: "Café", precioSugerido: 5, activo: true, cantidad: 2 }
        }));
        let controles = carrito().shadowRoot;
        controles.querySelector("#abrir").click();
        controles.querySelector("input[name=cliente]").value = "Julia";
        controles.querySelector("#pedir").click();
        expect(pedidos).to.have.lengthOf(0);
        controles.querySelector("#confirmar").click();
        await esperar(() => controles.querySelector("#pedir").textContent === "Reintentar pedido");
        const { referencia } = JSON.parse(sessionStorage.getItem(claveCarrito));
        expect(pedidos).to.have.lengthOf(1);
        expect(pedidos[0].observacion).to.equal("Cliente: Julia · Pedido web " + referencia);
        expect(unidades).to.have.lengthOf(1);

        app.remove();
        root = abrir("#productos");
        controles = carrito().shadowRoot;
        expect(controles.querySelector("#abrir").textContent).to.include("(2)");
        expect(controles.querySelector("input[name=cliente]").readOnly).to.be.true;
        controles.querySelector("#abrir").click();
        controles.querySelector("#pedir").click();
        await esperar(() => sessionStorage.getItem(claveCarrito) === null);

        expect(pedidos).to.have.lengthOf(1);
        expect(unidades.map(u => u.observaciones)).to.deep.equal([
            `Pedido web ${referencia}/p1/1`, `Pedido web ${referencia}/p1/2`
        ]);
        expect(controles.querySelector("#abrir").textContent).to.include("(0)");
    });
});

mocha.run();
