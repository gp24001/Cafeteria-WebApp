import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import "../../../src/js/boundary/components/ingreso/ingreso.js";
import "../../../src/js/boundary/components/carrito_orden/carrito_orden.js";

mocha.setup("tdd");

suite("Ingreso y carrito: Unidad", function () {
    const clave = "cafefe.carrito.v1";
    let vista, alarmas, borradorOriginal;

    setup(() => {
        alarmas = [];
        borradorOriginal = sessionStorage.getItem(clave);
        sessionStorage.removeItem(clave);
    });

    teardown(() => {
        vista?.remove();
        sinon.restore();
        if (borradorOriginal === null) sessionStorage.removeItem(clave);
        else sessionStorage.setItem(clave, borradorOriginal);
    });

    function montar(etiqueta) {
        vista = document.createElement(etiqueta);
        vista.addEventListener("notificar", evento => alarmas.push(evento.detail));
        document.body.appendChild(vista);
        return vista.shadowRoot;
    }

    test("un ingreso en curso bloquea duplicados y un error permite reintentar con la contraseña limpia", async function () {
        const root = montar("ingreso-model");
        let rechazar;
        const iniciar = sinon.stub().returns(new Promise((_, reject) => { rechazar = reject; }));
        vista.sesion = { iniciar };
        const boton = root.querySelector("button");
        const nombre = root.querySelector("#nombre");
        const claveEmpleado = root.querySelector("#identificador");

        await vista.ingresar();
        sinon.assert.notCalled(iniciar);
        nombre.value = "Ana";
        claveEmpleado.value = "00000000-0000-4000-8000-000000000001";
        const solicitud = vista.ingresar();
        expect(boton.disabled).to.be.true;
        await vista.ingresar();
        sinon.assert.calledOnceWithExactly(iniciar, nombre.value, claveEmpleado.value);
        rechazar(new Error("Servidor no disponible"));
        await solicitud;

        expect(claveEmpleado.value).to.equal("");
        expect(nombre.value).to.equal("Ana");
        expect(boton.disabled).to.be.false;
        expect(alarmas.at(-1)).to.deep.equal({ tipo: "error", mensaje: "Servidor no disponible" });
    });

    test("si no puede persistir el borrador, conserva el carrito y bloquea el envío", async function () {
        const root = montar("orden-model");
        vista.agregar({ idProducto: "p1", nombre: "Café", precioSugerido: 3, activo: true, cantidad: 2 });
        const nombre = root.querySelector("input[name=cliente]");
        nombre.value = "Ana";
        root.querySelector("#pedir").click();
        expect(root.querySelector("#revision").hidden).to.be.false;

        const registrarPedido = sinon.stub(vista.dao, "registrarPedido");
        sinon.stub(Storage.prototype, "setItem").withArgs(clave).throws(new Error("Cuota agotada"));
        await vista.confirmar();

        sinon.assert.notCalled(registrarPedido);
        expect(root.querySelector("#abrir").textContent).to.include("(2)");
        expect(nombre.value).to.equal("Ana");
        expect(nombre.readOnly).to.be.false;
        expect(alarmas.at(-1).mensaje).to.include("No se pudo guardar el carrito");
    });

    test("un borrador dañado avisa y deja el carrito utilizable", function () {
        sessionStorage.setItem(clave, JSON.stringify({ lineas: [{ cantidad: -1 }] }));
        const root = montar("orden-model");
        expect(root.querySelector("#abrir").textContent).to.include("(0)");
        expect(alarmas.at(-1).mensaje).to.include("No se pudo recuperar");
        vista.agregar({ idProducto: "p1", nombre: "Café", precioSugerido: 3, activo: true });
        expect(root.querySelector("#abrir").textContent).to.include("(1)");
        expect(JSON.parse(sessionStorage.getItem(clave)).lineas[0].idProducto).to.equal("p1");
    });
});

mocha.run();
