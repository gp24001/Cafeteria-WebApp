import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import ProductoTipoProducto from "../../../src/js/entity/producto_tipo_producto.js";
import Producto from "../../../src/js/entity/producto.js";
import TipoProducto from "../../../src/js/entity/tipo_producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("ProductoTipoProducto: unidad", function () {
    const datos = registros.ProductoTipoProducto;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva pertenencia inactiva a una categoría al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(ProductoTipoProducto).findById(datos.idProductoTipoProducto);
        expect(registro).to.be.instanceOf(ProductoTipoProducto);
        for (const [ruta, Tipo] of [["idProducto", Producto], ["idTipoProducto", TipoProducto]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idProductoTipoProducto: datos.idProductoTipoProducto };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(ProductoTipoProducto).findById(datos.idProductoTipoProducto);
        expect(registro).to.be.instanceOf(ProductoTipoProducto);
        expect(Object.keys(registro)).to.deep.equal(["idProductoTipoProducto"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
