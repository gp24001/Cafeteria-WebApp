import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import DescuentoProducto from "../../../src/js/entity/descuento_producto.js";
import Descuento from "../../../src/js/entity/descuento.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("DescuentoProducto: unidad", function () {
    const datos = registros.DescuentoProducto;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva producto, valor y fechas de la promoción al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(DescuentoProducto).findById(datos.idDescuentoProducto);
        expect(registro).to.be.instanceOf(DescuentoProducto);
        for (const [ruta, Tipo] of [["idDescuento", Descuento], ["idDescuento.idTipoDescuento", TipoDescuento], ["idProducto", Producto]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idDescuentoProducto: datos.idDescuentoProducto };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(DescuentoProducto).findById(datos.idDescuentoProducto);
        expect(registro).to.be.instanceOf(DescuentoProducto);
        expect(Object.keys(registro)).to.deep.equal(["idDescuentoProducto"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
