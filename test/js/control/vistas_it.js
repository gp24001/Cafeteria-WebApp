import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import { sesionEmpleado } from "../../../src/js/control/sesion_empleado.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import TipoProductoDao from "../../../src/js/control/tipo_producto_dao.js";
import { CafefeApp } from "../../../src/app.js";
import { almacenDePrueba, simularApiPantallas } from "../boundary/api_pantallas.js";

mocha.setup("tdd");
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
suite("Vistas: Integración", function () {
    let vista, actual, ruta, restaurando, almacen, version;
    const id = "11111111-1111-4111-8111-111111111111";
    const barista = { empleado: { idEmpleado: id, nombre: "Ana", apellido: "Pérez" }, roles: [{ nombre: "Barista" }] };
    setup(() => {
        actual = sesionEmpleado.actual;
        ruta = location.href;
        restaurando = sesionEmpleado.restaurando;
        almacen = sesionEmpleado.almacen;
        version = sesionEmpleado.version;
    });
    teardown(() => {
        vista?.remove();
        vista = null;
        sesionEmpleado.actual = actual;
        sesionEmpleado.restaurando = restaurando;
        sesionEmpleado.almacen = almacen;
        sesionEmpleado.version = version;
        history.replaceState(null, "", ruta);
        sinon.restore();
    });

    test("al abrir sin ruta muestra el ingreso y continuar como cliente abre su bienvenida", async function () {
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        const cerrar = sinon.stub(sesionEmpleado, "cerrar").callsFake(() => {
            sesionEmpleado.actual = null;
            sesionEmpleado.dispatchEvent(new Event("cambio"));
        });
        sesionEmpleado.actual = null;
        history.replaceState(null, "", location.href.split("#")[0]);
        vista = new CafefeApp(); document.body.appendChild(vista);
        expect(vista.main.querySelector("ingreso-model")).not.to.equal(null);
        expect(vista.main.querySelector("inicio-model")).to.equal(null);
        const carrito = vista.superior.root.querySelector("orden-model");
        vista.main.querySelector("ingreso-model").root.querySelector(".volver-cliente").click();
        await esperar();
        const inicio = vista.main.querySelector("inicio-model");
        expect(location.hash).to.equal("#inicio");
        expect(inicio.root.querySelector(".nombre").hidden).to.be.true;
        expect(inicio.root.querySelector('a[href="#productos"]')).not.to.equal(null);
        expect(vista.superior.root.querySelector("orden-model")).to.equal(carrito);
        sinon.assert.calledOnce(cerrar);
    });

    test("restaurar una sesión válida conserva la ruta protegida sin confundirla con un login nuevo", async function () {
        let finalizar;
        sinon.stub(sesionEmpleado, "restaurar").callsFake(() => {
            sesionEmpleado.restaurando = true;
            return new Promise(resolve => {
                finalizar = () => {
                    sesionEmpleado.actual = barista;
                    sesionEmpleado.restaurando = false;
                    sesionEmpleado.dispatchEvent(new Event("cambio"));
                    resolve(barista);
                };
            });
        });
        sinon.stub(RecepcionOrdenDao.prototype, "pendientes").resolves([]);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#preparacion");
        vista = new CafefeApp(); document.body.appendChild(vista);
        expect(vista.main.textContent).to.include("Verificando sesión");
        expect(vista.main.querySelector("ingreso-model")).to.equal(null);
        finalizar(); await esperar();
        expect(location.hash).to.equal("#preparacion");
        expect(vista.main.querySelector("preparacion-model")).not.to.equal(null);
        expect(vista.main.querySelector("inicio-model")).to.equal(null);
    });

    test("protege las rutas directas y muestra enlaces solo a los roles autorizados", async function () {
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        const pendientes = sinon.stub(RecepcionOrdenDao.prototype, "pendientes").resolves([]);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#preparacion");
        vista = new CafefeApp();
        document.body.appendChild(vista);
        expect(vista.main.querySelector("ingreso-model")).not.to.equal(null);
        sinon.assert.notCalled(pendientes);
        sesionEmpleado.actual = { empleado: barista.empleado, roles: [{ nombre: "Cajero" }] };
        vista.render();
        expect(vista.main.textContent).to.include("no tiene acceso");
        expect(vista.lateral.navegacion.querySelector('a[href="#preparacion"]')).to.equal(null);
        expect(vista.lateral.navegacion.querySelector('a[href="#pagos"]')).not.to.equal(null);
        sesionEmpleado.actual = barista;
        vista.render();
        await esperar();
        expect(vista.main.querySelector("preparacion-model")).not.to.equal(null);
        expect(vista.lateral.navegacion.querySelector('a[href="#preparacion"]')).not.to.equal(null);
        expect(vista.lateral.navegacion.querySelector('a[href="#pagos"]')).to.equal(null);
    });

    test("actualizar sesión conserva el mismo carrito y sus cantidades", function () {
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#inicio");
        vista = new CafefeApp();
        document.body.appendChild(vista);
        const carrito = vista.superior.root.querySelector("orden-model");
        const previo = sessionStorage.getItem(carrito.clave);
        try {
            carrito.agregar({ idProducto: "prueba-hu1", nombre: "Pan", activo: true, precioSugerido: 1, cantidad: 2 });
            const cantidad = carrito.resumen.estado.lineas.find(l => l.idProducto === "prueba-hu1").cantidad;
            sesionEmpleado.actual = barista;
            vista.actualizarSesion();
            expect(vista.superior.root.querySelector("orden-model")).to.equal(carrito);
            expect(carrito.resumen.estado.lineas.find(l => l.idProducto === "prueba-hu1").cantidad).to.equal(cantidad);
            sesionEmpleado.actual = null;
            vista.actualizarSesion();
            expect(vista.superior.root.querySelector("orden-model")).to.equal(carrito);
        } finally {
            if (previo === null) sessionStorage.removeItem(carrito.clave);
            else sessionStorage.setItem(carrito.clave, previo);
        }
    });

    test("la navegación inicia oculta y se despliega desde la barra superior", function () {
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#inicio");
        vista = new CafefeApp();
        document.body.appendChild(vista);
        const boton = vista.superior.root.querySelector(".abrir-menu");
        expect(vista.hasAttribute("menu-abierto")).to.be.false;
        expect(boton.getAttribute("aria-expanded")).to.equal("false");
        boton.click();
        expect(vista.hasAttribute("menu-abierto")).to.be.true;
        expect(vista.lateral.hasAttribute("retraido")).to.be.false;
        boton.click();
        expect(vista.hasAttribute("menu-abierto")).to.be.false;
        expect(boton.getAttribute("aria-expanded")).to.equal("false");
    });

    test("los errores del formulario llegan a una notificación accesible sin insertar HTML ni repetir el aviso", async function () {
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#ingreso");
        vista = new CafefeApp(); document.body.appendChild(vista);
        const ingreso = vista.main.querySelector("ingreso-model");
        const mensaje = '<img src="externo" onerror="alert(1)"> Datos incorrectos';
        sinon.stub(sesionEmpleado, "iniciar").rejects(new Error(mensaje));
        ingreso.root.querySelector("#nombre").value = "Ana";
        ingreso.root.querySelector("#identificador").value = id;
        await ingreso.ingresar();
        ingreso.root.querySelector("#identificador").value = id;
        await ingreso.ingresar();
        const avisos = vista.notificaciones.lista.querySelectorAll(".error");
        expect(avisos).to.have.lengthOf(1);
        expect(avisos[0].getAttribute("role")).to.equal("alert");
        expect(avisos[0].textContent).to.include(mensaje);
        expect(avisos[0].querySelector("img")).to.equal(null);
        avisos[0].querySelector(".cerrar").click();
        expect(vista.notificaciones.lista.querySelectorAll(".error")).to.have.lengthOf(0);
    });

    test("una validación del carrito se muestra sobre el diálogo y se puede cerrar sin cerrar el pedido", function () {
        sinon.stub(ProductoDao.prototype, "listarTodos").resolves([]);
        sinon.stub(TipoProductoDao.prototype, "findRange").resolves({ datos: [] });
        sinon.stub(sesionEmpleado, "restaurar").resolves(null);
        sesionEmpleado.actual = null;
        history.replaceState(null, "", "#productos");
        vista = new CafefeApp(); document.body.appendChild(vista);
        const carrito = vista.superior.root.querySelector("orden-model");
        const guardado = sessionStorage.getItem(carrito.clave);
        try {
            carrito.agregar({ idProducto: "pan", nombre: "Pan", activo: true, precioSugerido: 1 });
            carrito.root.querySelector("#abrir").click();
            carrito.nombre.value = ""; carrito.pedir();
            const aviso = vista.notificaciones.lista.querySelector(".aviso");
            expect(aviso.textContent).to.include("nombre del cliente");
            expect(vista.notificaciones.parentNode).to.equal(carrito.dialogo);
            aviso.querySelector(".cerrar").click();
            expect(carrito.dialogo.open).to.be.true;
            expect(vista.notificaciones.lista.querySelector(".aviso")).to.equal(null);
            carrito.dialogo.close();
        } finally {
            if (guardado === null) sessionStorage.removeItem(carrito.clave);
            else sessionStorage.setItem(carrito.clave, guardado);
        }
    });

    test("el ingreso consulta al empleado y su rol antes de abrir la bienvenida autorizada", async function () {
        const api = simularApiPantallas();
        sesionEmpleado.almacen = almacenDePrueba();
        sesionEmpleado.actual = null;
        sesionEmpleado.restaurando = false;
        history.replaceState(null, "", "#ingreso");
        vista = new CafefeApp();
        document.body.appendChild(vista);
        const ingreso = vista.main.querySelector("ingreso-model");
        ingreso.root.querySelector("#nombre").value = "Ana";
        ingreso.root.querySelector("#identificador").value = api.empleado.idEmpleado;
        await ingreso.ingresar();
        const inicio = vista.main.querySelector("inicio-model");
        expect(location.hash).to.equal("#inicio");
        expect(inicio.root.querySelector(".nombre").textContent).to.equal("Ana Gómez");
        expect(inicio.root.querySelector(".roles").textContent).to.equal("Barista");
        expect(inicio.root.querySelector('a[href="#preparacion"]')).not.to.equal(null);
        expect(inicio.root.querySelector('a[href="#pagos"]')).to.equal(null);
        expect(ingreso.root.querySelector("#identificador").value).to.equal("");
        expect(vista.notificaciones.lista.querySelector(".exito").textContent).to.include("Sesión iniciada.");
        expect(JSON.parse(sesionEmpleado.almacen.getItem(sesionEmpleado.clave)))
            .to.deep.equal({ idEmpleado: api.empleado.idEmpleado });
        const consultasDeIngreso = api.llamadas.filter(({ ruta }) => ruta.startsWith("empleado/") || ruta === "rol");
        expect(consultasDeIngreso.map(llamada => llamada.ruta)).to.have.members([
            "empleado/" + api.empleado.idEmpleado, "empleado/" + api.empleado.idEmpleado + "/rol", "rol"
        ]);
        expect(consultasDeIngreso.every(llamada => llamada.metodo === "GET")).to.be.true;
    });

    for (const entrada of ["ingreso", "preparacion", "pagos"]) {
        test(`el login desde ${entrada} lleva a la bienvenida con el nombre, rol y accesos permitidos`, async function () {
            sinon.stub(sesionEmpleado, "restaurar").resolves(null);
            sesionEmpleado.actual = null;
            sesionEmpleado.restaurando = false;
            history.replaceState(null, "", "#" + entrada);
            vista = new CafefeApp(); document.body.appendChild(vista);
            expect(vista.main.querySelector("ingreso-model")).not.to.equal(null);
            sesionEmpleado.actual = barista;
            sesionEmpleado.dispatchEvent(new Event("cambio"));
            await esperar();
            const inicio = vista.main.querySelector("inicio-model");
            expect(location.hash).to.equal("#inicio");
            expect(inicio.root.querySelector(".nombre").textContent).to.equal("Ana Pérez");
            expect(inicio.root.querySelector(".roles").textContent).to.equal("Barista");
            expect(inicio.root.querySelector('a[href="#preparacion"]')).not.to.equal(null);
            expect(inicio.root.querySelector('a[href="#pagos"]')).to.equal(null);
        });
    }


});
mocha.run();

