import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Factura from "../../../src/js/entity/factura.js";
import Caja from "../../../src/js/entity/caja.js";
import EmpleadoRol from "../../../src/js/entity/empleado_rol.js";
import Empleado from "../../../src/js/entity/empleado.js";
import Rol from "../../../src/js/entity/rol.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Factura: unidad", function () {
    const datos = registros.Factura;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva cliente, estado parcial y caja al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Factura).findById(datos.idFactura);
        expect(registro).to.be.instanceOf(Factura);
        for (const [ruta, Tipo] of [["idCaja", Caja], ["idEmpleadoRol", EmpleadoRol], ["idEmpleadoRol.idEmpleado", Empleado], ["idEmpleadoRol.idRol", Rol]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idFactura: datos.idFactura };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Factura).findById(datos.idFactura);
        expect(registro).to.be.instanceOf(Factura);
        expect(Object.keys(registro)).to.deep.equal(["idFactura"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
