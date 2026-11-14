import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import OrdenProducto from "../../../src/js/entity/orden_producto.js";
import Orden from "../../../src/js/entity/orden.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("OrdenProducto: unidad", function () {
    const datos = registros.OrdenProducto;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva precio histórico y especificaciones de preparación al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(OrdenProducto).findById(datos.idOrdenProducto);
        expect(registro).to.be.instanceOf(OrdenProducto);
        for (const [ruta, Tipo] of [["idOrden", Orden], ["idProducto", Producto]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idOrdenProducto: datos.idOrdenProducto };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(OrdenProducto).findById(datos.idOrdenProducto);
        expect(registro).to.be.instanceOf(OrdenProducto);
        expect(Object.keys(registro)).to.deep.equal(["idOrdenProducto"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
