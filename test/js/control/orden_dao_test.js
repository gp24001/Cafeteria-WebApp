import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
import DefaultError from "../../../src/js/entity/default_error.js";
import OrdenDao from "../../../src/js/control/orden_dao.js";

mocha.setup("tdd");
suite("OrdenDao", function () {
    const id = "26abca46-4196-45b6-a225-c8d2028c8a37";
    const dao = new OrdenDao();
    const url = `http://localhost:9080/cafefe-1.0-SNAPSHOT/resources/v1/orden`;
    const registro = { idOrden: id };
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => peticion.restore());

    test("findRange envía el desplazamiento y conserva el total", async function () {
        peticion.resolves(new Response(JSON.stringify([registro]), { headers: { "Total-registros": "5" } }));
        const pagina = await dao.findRange(2, 1);
        expect(peticion.firstCall.args).to.deep.equal([url + "?min=2&max=1", { method: "GET" }]);
        expect(pagina).to.be.instanceOf(DefaultResponse);
        expect(pagina.datos).to.deep.equal([registro]);
        expect(pagina.totalDatos).to.equal("5");
    });

    test("findById consulta el registro por UUID", async function () {
        peticion.resolves(new Response(JSON.stringify(registro)));
        expect(await dao.findById(id)).to.deep.equal(registro);
        expect(peticion.firstCall.args[0]).to.equal(url + "/" + id);
    });

    test("findById conserva el error del recurso", async function () {
        const respuesta = new Response(null, { status: 404, headers: { "App-Error": "Registro ausente" } });
        peticion.resolves(respuesta);
        const fallo = await dao.findById(id).catch(error => error);
        expect(fallo).to.be.instanceOf(DefaultError);
        expect(fallo.error).to.equal(respuesta);
        expect(fallo.mensaje).to.equal("Registro ausente");
    });

    test("crear envía JSON y devuelve el registro creado", async function () {
        const solicitud = { observacion: "Prueba" };
        peticion.resolves(new Response(JSON.stringify(registro), { status: 201 }));
        expect(await dao.crear(solicitud)).to.deep.equal(registro);
        expect(peticion.firstCall.args).to.deep.equal([url, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(solicitud)
        }]);
    });

    test("usa el rol del camarero virtual aunque la asignación solo contenga el UUID del rol", async function () {
        const camarero = { idRol: "sala", nombre: "Camarero", activo: true };
        const cajero = { idRol: "caja", nombre: "Cajero", activo: true };
        const datos = {
            empleado: [{ idEmpleado: "virtual", nombre: "Camarero", apellido: "Virtual", activo: true }],
            "empleado/virtual/rol": [
                { idEmpleadoRol: "baja", activo: false, idRol: { idRol: "sala" } },
                { idEmpleadoRol: "cobros", activo: true, idRol: { idRol: "caja" } },
                { idEmpleadoRol: "pedidos", activo: true, idRol: { idRol: "sala" } }
            ],
            rol: [cajero, camarero]
        };
        peticion.callsFake(async ruta => {
            const recurso = new URL(ruta).pathname.split("/v1/")[1];
            expect(datos).to.have.property(recurso);
            return Response.json(datos[recurso]);
        });
        expect(await dao.camareroVirtual()).to.equal("pedidos");
    });

    test("si se pierde la respuesta de una unidad, el reintento completa las dos sin duplicar la orden", async function () {
        const cabeceras = [], unidades = [];
        const asignacion = sinon.stub(dao, "camareroVirtual").resolves("pedidos");
        const solicitud = { referencia: "carrito-25", nombre: "Ana", lineas: [{ idProducto: "cafe", precio: 2, cantidad: 2 }] };
        peticion.callsFake(async (ruta, opciones) => {
            if (opciones.method === "POST") {
                const cuerpo = JSON.parse(opciones.body);
                if (ruta === url) {
                    cabeceras.push({ ...cuerpo, idOrden: id });
                    return Response.json(cabeceras[0], { status: 201 });
                }
                expect(ruta).to.equal(url + "/" + id + "/producto");
                unidades.push(cuerpo);
                // La API alcanzó a guardar esta unidad antes de perderse la conexión.
                if (unidades.length === 1) throw new TypeError("Sin conexión");
                return Response.json(cuerpo, { status: 201 });
            }
            const coleccion = ruta.split("?")[0];
            expect(coleccion).to.be.oneOf([url, url + "/" + id + "/producto"]);
            return Response.json(coleccion === url ? cabeceras : unidades);
        });
        try {
            const error = await dao.registrarPedido(solicitud).catch(e => e);
            expect(error).to.be.instanceOf(DefaultError);
            expect(unidades).to.have.lengthOf(1);
            // Cocina pudo iniciar la preparación antes del reintento del cliente.
            cabeceras[0].observacion += '\n[CAFEFE_PREPARACION_V1]{"estado":"EN_PREPARACION","version":1,"listos":[]}';
            unidades[0].observaciones += '\nPreparación: Listo';
            expect(await dao.registrarPedido(solicitud, true)).to.equal(id);
            expect(cabeceras).to.have.lengthOf(1);
            expect(cabeceras[0].observacion).to.include("Ana");
            expect(cabeceras[0].idEmpleadoRol).to.deep.equal({ idEmpleadoRol: "pedidos" });
            expect(unidades.map(u => u.idProducto.idProducto)).to.deep.equal(["cafe", "cafe"]);
            expect(unidades.map(u => u.precio)).to.deep.equal([2, 2]);
        } finally {
            asignacion.restore();
        }
    });

    test("prepara el camarero y su asignación desde los DAO sin scripts ni creaciones duplicadas en la pestaña", async function () {
        const creados = [];
        peticion.callsFake(async (ruta, opciones) => {
            const recurso = new URL(ruta).pathname.split("/v1/")[1];
            if (opciones?.method === "POST") {
                const datos = JSON.parse(opciones.body);
                creados.push({ recurso, datos });
                return Response.json(recurso === "empleado" ? { ...datos, idEmpleado: "virtual" } : { ...datos, idEmpleadoRol: "pedidos" }, { status: 201 });
            }
            return Response.json(recurso === "rol" ? [{ idRol: "sala", nombre: "Camarero", activo: true }] : []);
        });
        expect(await Promise.all([dao.camareroVirtual(), new OrdenDao().camareroVirtual()])).to.deep.equal(["pedidos", "pedidos"]);
        expect(creados.map(c => c.recurso)).to.deep.equal(["empleado", "empleado/virtual/rol"]);
        expect(creados[1].datos).to.deep.equal({ idRol: { idRol: "sala" }, activo: true });
    });

    test("registra y reconcilia dos elecciones del mismo SKU conservando sus observaciones y precio", async function () {
        const cabeceras = [], unidades = [];
        const asignacion = sinon.stub(dao, "camareroVirtual").resolves("pedidos");
        const solicitud = { referencia: "mismo-sku", nombre: "Ana", lineas: [
            { idProducto: "cafe12", claveSeleccion: "cafe12/entera", precio: 2, cantidad: 1, presentacion: "12 Onzas · Leche: entera" },
            { idProducto: "cafe12", claveSeleccion: "cafe12/descremada", precio: 2, cantidad: 1, presentacion: "12 Onzas · Leche: descremada" }
        ] };
        peticion.callsFake(async (ruta, opciones) => {
            if (opciones?.method === "POST") {
                const cuerpo = JSON.parse(opciones.body);
                if (ruta === url) { cabeceras.push({ ...cuerpo, idOrden: id }); return Response.json(cabeceras[0], { status: 201 }); }
                expect(ruta).to.equal(url + "/" + id + "/producto");
                unidades.push(cuerpo);
                // El segundo registro se guardó, pero el cliente no recibió su respuesta.
                if (unidades.length === 2) throw new TypeError("Respuesta perdida");
                return Response.json(cuerpo, { status: 201 });
            }
            const coleccion = ruta.split("?")[0];
            expect(coleccion).to.be.oneOf([url, url + "/" + id + "/producto"]);
            return Response.json(coleccion === url ? cabeceras : unidades);
        });
        try {
            expect(await dao.registrarPedido(solicitud).catch(e => e)).to.be.instanceOf(DefaultError);
            expect(unidades).to.have.lengthOf(2);
            expect(unidades.map(u => u.idProducto)).to.deep.equal([{ idProducto: "cafe12" }, { idProducto: "cafe12" }]);
            expect(unidades.map(u => u.precio)).to.deep.equal([2, 2]);
            expect(unidades[0].observaciones).to.include("12 Onzas · Leche: entera");
            expect(unidades[1].observaciones).to.include("12 Onzas · Leche: descremada");
            expect(unidades.every(u => !("claveSeleccion" in u))).to.be.true;
            expect(await dao.registrarPedido(solicitud, true)).to.equal(id);
            expect(cabeceras).to.have.lengthOf(1);
            expect(unidades).to.have.lengthOf(2);
        } finally { asignacion.restore(); }
    });

    test("no crea datos si falta el rol Camarero y no reactiva un empleado deshabilitado", async function () {
        peticion.callsFake(async () => Response.json([]));
        expect((await dao.camareroVirtual().catch(e => e)).message).to.include("rol Camarero activo");
        expect(peticion.getCalls().every(c => c.args[1]?.method !== "POST")).to.be.true;
        peticion.resetHistory();
        peticion.callsFake(async ruta => Response.json(new URL(ruta).pathname.endsWith("/rol")
            ? [{ idRol: "sala", nombre: "Camarero", activo: true }]
            : [{ idEmpleado: "virtual", nombre: "Camarero", apellido: "Virtual", activo: false }]));
        expect((await dao.camareroVirtual().catch(e => e)).message).to.include("inactivo");
        expect(peticion.getCalls().every(c => c.args[1]?.method !== "POST")).to.be.true;
    });
});
mocha.run();
