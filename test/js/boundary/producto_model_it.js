import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import ProductoModel from "../../../src/js/boundary/producto_model.js";
import { CafefeApp } from "../../../src/app.js";
import { sesionEmpleado } from "../../../src/js/control/sesion_empleado.js";
import { simularApiPantallas } from "./api_pantallas.js";

mocha.setup("tdd");

suite("ProductoModel: Integración", function () {
    const claveCarrito = "cafefe.carrito.v1";
    let montaje, url, api, borrador, sesion, restaurando;

    setup(() => {
        url = location.href;
        borrador = sessionStorage.getItem(claveCarrito);
        sessionStorage.removeItem(claveCarrito);
        sesion = sesionEmpleado.actual;
        restaurando = sesionEmpleado.restaurando;
        sesionEmpleado.actual = null;
        sesionEmpleado.restaurando = false;
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        api = simularApiPantallas();
    });

    teardown(() => {
        montaje?.remove();
        montaje = null;
        history.replaceState(history.state, "", url);
        if (borrador === null) sessionStorage.removeItem(claveCarrito);
        else sessionStorage.setItem(claveCarrito, borrador);
        sesionEmpleado.actual = sesion;
        sesionEmpleado.restaurando = restaurando;
        sinon.restore();
    });

    /** Abre Productos por su ruta real y devuelve la pantalla creada por la aplicación. */
    function abrirAplicacion(ruta) {
        history.replaceState(history.state, "", ruta);
        montaje = new CafefeApp();
        document.body.appendChild(montaje);
        return montaje.main.querySelector("producto-model");
    }

    /** Elige una opción dentro del grupo visible de la tarjeta de producto. */
    function elegir(tarjeta, grupo, texto) {
        const campo = Array.from(tarjeta.root.querySelectorAll("fieldset"))
            .find(seccion => seccion.querySelector("legend").textContent.includes(grupo));
        const opcion = Array.from(campo.querySelectorAll("label"))
            .find(label => label.querySelector("span").textContent === texto);
        opcion.querySelector("input").click();
    }

    test("elegir una categoría activa desde el catálogo abre su detalle y permite volver", async function () {
        const pantalla = abrirAplicacion("#productos");
        const lista = pantalla.contenido.querySelector("tipo-producto-model");
        await lista.cargar();
        const tarjetas = lista.root.querySelectorAll("tarjeta-tipo-producto");
        expect(tarjetas).to.have.lengthOf(1);
        expect(tarjetas[0].tipoProducto.nombre).to.equal("Bebidas");
        expect(new URL(tarjetas[0].imagen.src).origin).to.equal(location.origin);
        const alAbrir = new Promise(resolve => window.addEventListener("hashchange", resolve, { once: true }));
        tarjetas[0].root.querySelector("button").click();
        await alAbrir;
        expect(location.hash).to.equal("#productos/bebidas");
        const detalle = montaje.main.querySelector("producto-model").contenido;
        await detalle.cargar();
        expect(detalle.root.querySelector("h2").textContent).to.equal("Bebidas");
        expect(detalle.root.querySelector("tarjeta-producto").producto.nombre).to.equal("Latte");
        const alVolver = new Promise(resolve => window.addEventListener("hashchange", resolve, { once: true }));
        detalle.root.querySelector("button.volver").click();
        await alVolver;
        expect(location.hash).to.equal("#productos");
        expect(montaje.main.querySelector("producto-model").contenido.localName).to.equal("buscador-productos");
    });

    test("el buscador general encuentra productos por nombre sin tildes y no vuelve a consultar la API al escribir", async function () {
        montaje = new ProductoModel();
        document.body.appendChild(montaje);
        const buscador = montaje.contenido;
        await buscador.cargar();
        const consultas = api.llamadas.length;
        buscador.entrada.value = "LATTE";
        await buscador.entrada.oninput();
        expect(buscador.lista.children).to.have.lengthOf(1);
        expect(buscador.lista.firstElementChild.producto.variantes.map(producto => producto.idProducto))
            .to.deep.equal(["latte12", "latte16"]);
        expect(buscador.buscador.worker).to.be.instanceOf(Worker);
        buscador.entrada.value = "TE FRIO";
        await buscador.entrada.oninput();
        expect(buscador.lista.firstElementChild.producto.idProducto).to.equal("te");
        expect(api.llamadas.length).to.equal(consultas);
        buscador.entrada.value = "";
        await buscador.entrada.oninput();
        expect(buscador.explorar.hidden).to.be.false;
        expect(buscador.lista.hidden).to.be.true;
    });

    test("agrega al carrito el tamaño, la leche y la cantidad elegidos y confirma el pedido con esos datos", async function () {
        const pantalla = abrirAplicacion("#productos/bebidas");
        const detalle = pantalla.contenido;
        await detalle.cargar();
        const tarjeta = detalle.root.querySelector("tarjeta-producto");
        const carrito = montaje.superior.root.querySelector("orden-model");
        const registrar = sinon.stub(carrito.dao, "registrarPedido").resolves("orden-de-prueba");
        tarjeta.root.querySelector(".elegir").click();
        expect(tarjeta.boton.disabled).to.be.true;
        elegir(tarjeta, "Presentación", "12 oz");
        expect(tarjeta.boton.disabled).to.be.true;
        elegir(tarjeta, "Tipo de leche", "Leche entera");
        tarjeta.root.querySelector("#mas").click();
        tarjeta.boton.click();
        const lineas = carrito.resumen.estado.lineas;
        expect(lineas).to.have.lengthOf(1);
        expect(lineas[0]).to.include({ idProducto: "latte12", precio: 2, cantidad: 2 });
        expect(lineas[0].presentacion).to.include("12 Onzas").and.include("Leche entera");
        expect(carrito.resumen.total).to.equal(4);
        carrito.nombre.value = "Ana";
        carrito.pedir();
        expect(carrito.revision.hidden).to.be.false;
        sinon.assert.notCalled(registrar);
        await carrito.confirmar();
        sinon.assert.calledOnce(registrar);
        expect(registrar.firstCall.args[0]).to.include({ nombre: "Ana" });
        expect(registrar.firstCall.args[0].lineas).to.deep.equal(lineas);
        expect(carrito.resumen.estado.lineas).to.be.empty;
        expect(api.llamadas.some(llamada => llamada.ruta === "producto/latte12/caracteristica")).to.be.true;
        expect(api.llamadas.every(llamada => llamada.metodo === "GET")).to.be.true;
    });
});

mocha.run();
