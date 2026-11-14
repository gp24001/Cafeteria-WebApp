import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Producto: unidad", function () {
    const datos = registros.Producto;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva precio sugerido, descripción y estado inactivo al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Producto).findById(datos.idProducto);
        expect(registro).to.be.instanceOf(Producto);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idProducto: datos.idProducto };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Producto).findById(datos.idProducto);
        expect(registro).to.be.instanceOf(Producto);
        expect(Object.keys(registro)).to.deep.equal(["idProducto"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
