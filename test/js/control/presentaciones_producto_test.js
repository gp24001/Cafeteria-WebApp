import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import CaracteristicaDao from "../../../src/js/control/caracteristica_dao.js";
import TipoCaracteristicaDao from "../../../src/js/control/tipo_caracteristica_dao.js";
import ProductoCaracteristicaDao from "../../../src/js/control/producto_caracteristica_dao.js";
import { agruparPresentaciones, opcionesDeProducto, gruposVisibles, seleccionarProducto } from "../../../src/js/control/presentaciones_producto.js";

mocha.setup("tdd");
suite("Presentaciones de producto: Unidad", function () {
    let caracteristicas, tipos, relaciones;
    setup(() => {
        caracteristicas = sinon.stub(CaracteristicaDao.prototype, "listarTodos").resolves([]);
        tipos = sinon.stub(TipoCaracteristicaDao.prototype, "listarTodos").resolves([]);
        relaciones = sinon.stub(ProductoCaracteristicaDao.prototype, "listarTodos").resolves([]);
    });
    teardown(() => sinon.restore());

    /** Catálogo simulado con dos tamaños y opciones de preparación propias de cada SKU. */
    async function catalogoLeches(opciones16 = []) {
        tipos.resolves([{ idTipoCaracteristica: "leche", nombre: "Tipo de leche", expresionRegular: ".*", activo: true }]);
        caracteristicas.resolves([
            { idCaracteristica: "oz", nombre: "Onzas", activo: true },
            { idCaracteristica: "entera", nombre: "Leche entera", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } },
            { idCaracteristica: "deslactosada", nombre: "Leche deslactosada", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } }
        ]);
        relaciones.callsFake(function () {
            const tamano = this.URL.split("/").at(-2).slice(-2);
            return Promise.resolve([{ idCaracteristica: { idCaracteristica: "oz" }, valor: tamano },
                ...(tamano === "12" ? ["entera", "deslactosada"] : opciones16).map(id => ({ idCaracteristica: { idCaracteristica: id }, valor: "1" }))]);
        });
        return (await agruparPresentaciones([
            { idProducto: "latte12", nombre: "Latte", activo: true, precioSugerido: 2 },
            { idProducto: "latte16", nombre: "Latte", activo: true, precioSugerido: 3 }
        ]))[0];
    }

    test("agrupa tamaños distintos del mismo producto conservando ID y precio", async function () {
        caracteristicas.resolves([{ idCaracteristica: "oz", nombre: "Onzas", activo: true }]);
        relaciones.callsFake(function () {
            return Promise.resolve([{ idCaracteristica: { idCaracteristica: "oz" }, valor: this.URL.includes("/12/") ? "12" : "16" }]);
        });
        const productos = [12, 16].map(tamano => ({ idProducto: String(tamano), nombre: "Macchiato", activo: true, precioSugerido: tamano === 12 ? 1.75 : 2.25 }));
        const grupos = await agruparPresentaciones(productos);
        expect(grupos.length).to.equal(1);
        expect(grupos[0].variantes.map(v => [v.idProducto, v.presentacion, v.precioSugerido]))
            .to.deep.equal([["12", "12 Onzas", 1.75], ["16", "16 Onzas", 2.25]]);
    });

    test("usa las onzas en Presentación y conserva las leches únicamente como opciones del producto", async function () {
        tipos.resolves([{ idTipoCaracteristica: "leche", nombre: "Tipo de leche", expresionRegular: ".*", activo: true }]);
        caracteristicas.resolves([
            { idCaracteristica: "oz", nombre: "Onzas", activo: true },
            { idCaracteristica: "entera", nombre: "Leche Entera", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } },
            { idCaracteristica: "deslactosada", nombre: "Leche deslactosada", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } }
        ]);
        relaciones.callsFake(function () {
            const doce = this.URL.includes("/doce/");
            return Promise.resolve([{ idCaracteristica: { idCaracteristica: "oz" }, valor: doce ? "12 oz" : "16" },
                { idCaracteristica: { idCaracteristica: "entera" }, valor: "1" },
                ...(doce ? [{ idCaracteristica: { idCaracteristica: "deslactosada" }, valor: "1" }] : [])]);
        });
        const [producto] = await agruparPresentaciones(["doce", "dieciseis"].map((idProducto, i) => ({ idProducto, nombre: "Latte", activo: true, precioSugerido: 1.25 + i * 0.5 })));
        const opciones = opcionesDeProducto(producto);
        expect(opciones.grupos.find(g => g.id === "presentacion").opciones.map(o => o.etiqueta)).to.deep.equal(["12 oz", "16 oz"]);
        const visibles = gruposVisibles(opciones, new Map([["presentacion", "doce"]]));
        expect(visibles.find(g => g.nombre === "Tipo de leche").opciones).to.have.lengthOf(2);
        expect(visibles.filter(g => g.condicional).some(g => g.nombre === "Onzas")).to.be.false;
    });

    test("no convierte las leches en tamaños cuando faltan las onzas ni deduce tamaños por el precio", async function () {
        tipos.resolves([{ idTipoCaracteristica: "leche", nombre: "Tipo de leche", expresionRegular: ".*", activo: true }]);
        caracteristicas.resolves([{ idCaracteristica: "entera", nombre: "Leche Entera", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } },
            { idCaracteristica: "deslactosada", nombre: "Leche deslactosada", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } }]);
        relaciones.callsFake(function () {
            return Promise.resolve([{ idCaracteristica: { idCaracteristica: "entera" }, valor: "1" },
                ...(this.URL.includes("/grande/") ? [{ idCaracteristica: { idCaracteristica: "deslactosada" }, valor: "1" }] : [])]);
        });
        const [producto] = await agruparPresentaciones(["pequeno", "grande"].map((idProducto, i) => ({ idProducto, nombre: "Latte", activo: true, precioSugerido: 1.25 + i * 0.5 })));
        const opciones = opcionesDeProducto(producto);
        expect(opciones.grupos.find(g => g.id === "presentacion").opciones.map(o => o.etiqueta)).to.deep.equal(["Tamaño no especificado", "Tamaño no especificado"]);
        expect(opciones.variantes.map(v => v.precioSugerido)).to.deep.equal([1.25, 1.75]);
    });

    test("mantiene separados los productos con el mismo nombre que no tienen características", async function () {
        const productos = ["uno", "dos"].map(idProducto => ({ idProducto, nombre: "Café", activo: true }));
        expect(await agruparPresentaciones(productos)).to.deep.equal(productos);
    });

    test("consulta y conserva las características de un producto único como información fija", async function () {
        caracteristicas.resolves([{ idCaracteristica: "oz", nombre: "Onzas", activo: true }]);
        relaciones.resolves([{ idCaracteristica: { idCaracteristica: "oz" }, valor: "12" }]);
        const producto = { idProducto: "cafe12", nombre: "Café", activo: true, precioSugerido: 2 };
        const originales = JSON.stringify(producto);
        const [catalogado] = await agruparPresentaciones([producto]);
        const opciones = opcionesDeProducto(catalogado);
        expect(catalogado.presentacion).to.equal("12 Onzas");
        expect(opciones.fijas.map(c => [c.idCaracteristica, c.valor])).to.deep.equal([["oz", "12"]]);
        expect(opciones.grupos).to.deep.equal([]);
        expect(opciones.variantes.map(v => v.idProducto)).to.deep.equal(["cafe12"]);
        expect(JSON.stringify(producto)).to.equal(originales);
        sinon.assert.calledOnce(relaciones);
    });

    test("elige la presentación y muestra solo las opciones disponibles para ese producto", async function () {
        caracteristicas.resolves([
            { idCaracteristica: "oz", nombre: "Onzas", activo: true },
            { idCaracteristica: "leche", nombre: "Leche", activo: true }
        ]);
        const productos = [
            { idProducto: "12-entera", nombre: "Latte", activo: true, precioSugerido: 2 },
            { idProducto: "12-avena", nombre: "Latte", activo: true, precioSugerido: 2.5 },
            { idProducto: "16-entera", nombre: "Latte", activo: true, precioSugerido: 3 },
            { idProducto: "16-avena", nombre: "Latte", activo: true, precioSugerido: 3.5 }
        ];
        relaciones.callsFake(function () {
            const [onzas, leche] = this.URL.split("/").at(-2).split("-");
            return Promise.resolve([
                { idCaracteristica: { idCaracteristica: "oz" }, valor: onzas },
                { idCaracteristica: { idCaracteristica: "leche" }, valor: leche }
            ]);
        });
        const [producto] = await agruparPresentaciones(productos);
        const opciones = opcionesDeProducto(producto);
        expect(opciones.grupos).to.have.lengthOf(2);
        const selecciones = new Map();
        const [primario] = gruposVisibles(opciones, selecciones);
        expect(primario.id).to.equal("presentacion");
        expect(primario.opciones.map(o => o.id)).to.deep.equal(["12-entera", "12-avena", "16-entera", "16-avena"]);
        expect(seleccionarProducto(opciones, selecciones)).to.equal(null);
        selecciones.set(primario.id, "12-avena");
        const visibles = gruposVisibles(opciones, selecciones);
        const leche = visibles.find(g => g.condicional);
        expect(leche.opciones).to.have.lengthOf(1);
        expect(leche.opciones[0].etiqueta).to.include("avena");
        expect(leche.opciones[0].variantes).to.have.members(["12-avena", "16-avena"]);
        expect(seleccionarProducto(opciones, selecciones)).to.equal(null);
        selecciones.set(leche.id, leche.opciones[0].id);
        const seleccionado = seleccionarProducto(opciones, selecciones);
        expect(seleccionado.idProducto).to.equal("12-avena");
        expect(seleccionado.precioSugerido).to.equal(2.5);
    });

    test("permite elegir distintas leches del mismo producto sin cambiar su precio", async function () {
        const opciones = opcionesDeProducto(await catalogoLeches());
        const selecciones = new Map();
        expect(gruposVisibles(opciones, selecciones).map(g => g.id)).to.deep.equal(["presentacion"]);
        selecciones.set("presentacion", "latte12");
        const leche = gruposVisibles(opciones, selecciones).find(g => g.condicional);
        expect(leche.nombre).to.equal("Tipo de leche");
        expect(leche.opciones.map(o => o.etiqueta)).to.have.members(["Leche entera", "Leche deslactosada"]);
        expect(leche.opciones.every(o => o.variantes.includes("latte12") && !o.variantes.includes("latte16"))).to.be.true;
        selecciones.set(leche.id, leche.opciones.find(o => o.etiqueta === "Leche entera").id);
        const entera = seleccionarProducto(opciones, selecciones);
        selecciones.set(leche.id, leche.opciones.find(o => o.etiqueta === "Leche deslactosada").id);
        const deslactosada = seleccionarProducto(opciones, selecciones);
        expect([entera.idProducto, deslactosada.idProducto]).to.deep.equal(["latte12", "latte12"]);
        expect([entera.precioSugerido, deslactosada.precioSugerido]).to.deep.equal([2, 2]);
        expect(entera.claveSeleccion).not.to.equal(deslactosada.claveSeleccion);
        expect(entera.presentacion).to.include("12 Onzas").and.include("Leche entera").and.not.include("Leche deslactosada");
        expect(deslactosada.presentacion).to.include("12 Onzas").and.include("Leche deslactosada").and.not.include("Leche entera");
    });

    test("mantiene separados los productos que no pueden distinguirse por sus características", async function () {
        caracteristicas.resolves([{ idCaracteristica: "oz", nombre: "Onzas", activo: true }]);
        relaciones.resolves([{ idCaracteristica: { idCaracteristica: "oz" }, valor: "12" }]);
        const productos = [{ idProducto: "uno", nombre: "Café", activo: true, precioSugerido: 2 },
            { idProducto: "dos", nombre: "Café", activo: true, precioSugerido: 3 }];
        const catalogo = await agruparPresentaciones(productos);
        expect(catalogo.map(p => p.idProducto)).to.deep.equal(["uno", "dos"]);
        expect(catalogo.every(p => !p.variantes?.length)).to.be.true;
        expect(catalogo.map(p => p.precioSugerido)).to.deep.equal([2, 3]);
    });

    test("la presentación sin opciones propias no hereda las leches del otro tamaño", async function () {
        const opciones = opcionesDeProducto(await catalogoLeches());
        const selecciones = new Map([["presentacion", "latte16"]]);
        expect(gruposVisibles(opciones, selecciones).map(g => g.id)).to.deep.equal(["presentacion"]);
        const seleccionado = seleccionarProducto(opciones, selecciones);
        expect(seleccionado.idProducto).to.equal("latte16");
        expect(seleccionado.precioSugerido).to.equal(3);
        expect(seleccionado.presentacion).to.equal("16 Onzas");
        expect(seleccionado.claveSeleccion).to.equal(undefined);
    });

    test("requiere marcar la opción aunque el tamaño solo tenga una disponible", async function () {
        const opciones = opcionesDeProducto(await catalogoLeches(["entera"]));
        const selecciones = new Map([["presentacion", "latte16"]]);
        const leche = gruposVisibles(opciones, selecciones).find(g => g.condicional);
        expect(leche.opciones.map(o => o.etiqueta)).to.deep.equal(["Leche entera"]);
        expect(seleccionarProducto(opciones, selecciones)).to.equal(null);
        selecciones.set(leche.id, leche.opciones[0].id);
        expect(seleccionarProducto(opciones, selecciones).idProducto).to.equal("latte16");
        expect(seleccionarProducto(opciones, selecciones).precioSugerido).to.equal(3);
    });

    test("agrupa por los tipos registrados y exige elegir cada grupo aunque sus valores sean uno", async function () {
        tipos.resolves([
            { idTipoCaracteristica: "lacteos", nombre: "Lácteos", expresionRegular: "[0-9]+", activo: true },
            { idTipoCaracteristica: "endulzante", nombre: "Endulzante", expresionRegular: "[0-9]+", activo: true },
            { idTipoCaracteristica: "cantidad", nombre: "Cantidad", expresionRegular: "[0-9]+", activo: true }
        ]);
        caracteristicas.resolves([
            { idCaracteristica: "entera", nombre: "Leche entera", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "lacteos" } },
            { idCaracteristica: "deslactosada", nombre: "Leche deslactosada", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "lacteos" } },
            { idCaracteristica: "sin-azucar", nombre: "Sin azúcar", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "endulzante" } },
            { idCaracteristica: "cantidad", nombre: "Unidades", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "cantidad" } }
        ]);
        relaciones.resolves([
            { idCaracteristica: { idCaracteristica: "entera" }, valor: "1" },
            { idCaracteristica: { idCaracteristica: "deslactosada" }, valor: "1" },
            { idCaracteristica: { idCaracteristica: "sin-azucar" }, valor: "1" },
            { idCaracteristica: { idCaracteristica: "cantidad" }, valor: "2" }
        ]);
        const [producto] = await agruparPresentaciones([{ idProducto: "cafe", nombre: "Café", activo: true, precioSugerido: 2 }]);
        const opciones = opcionesDeProducto(producto);
        expect(opciones.grupos.map(g => g.nombre)).to.have.members(["Lácteos", "Endulzante"]);
        expect(opciones.fijas.map(c => c.idCaracteristica)).to.deep.equal(["cantidad"]);
        const leche = opciones.grupos.find(g => g.nombre === "Lácteos");
        expect(leche.opciones).to.have.lengthOf(2);
        const azucar = opciones.grupos.find(g => g.nombre === "Endulzante");
        expect(azucar.opciones).to.have.lengthOf(1);
        expect(leche.opciones.some(o => o.etiqueta.includes("azúcar"))).to.be.false;
        const selecciones = new Map();
        expect(seleccionarProducto(opciones, selecciones)).to.equal(null);
        selecciones.set(leche.id, leche.opciones.find(o => o.etiqueta.includes("deslactosada")).id);
        expect(seleccionarProducto(opciones, selecciones)).to.equal(null);
        selecciones.set(azucar.id, azucar.opciones[0].id);
        const seleccionado = seleccionarProducto(opciones, selecciones);
        expect(seleccionado.idProducto).to.equal("cafe");
        expect(seleccionado.precioSugerido).to.equal(2);
        expect(seleccionado.caracteristicas.map(c => c.idCaracteristica)).to.have.members(["cantidad", "deslactosada", "sin-azucar"]);
    });

    test("oculta marcadores obligatorios en opciones sin perder valores, medidas ni validaciones de selección", async function () {
        tipos.resolves([
            { idTipoCaracteristica: "leche", nombre: "Tipo de leche", expresionRegular: "[0-9]+" },
            { idTipoCaracteristica: "pan", nombre: "Tipo de pan", expresionRegular: ".+" },
            { idTipoCaracteristica: "volumen", nombre: "Volumen", expresionRegular: "[0-9]+" }
        ]);
        caracteristicas.resolves([
            { idCaracteristica: "oz", nombre: "Onzas", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "volumen" } },
            { idCaracteristica: "leche", nombre: "Leche deslactosada", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "leche" } },
            { idCaracteristica: "blanco", nombre: "Pan blanco", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "pan" } },
            { idCaracteristica: "masa", nombre: "Pan de masa madre", activo: true, idTipoCaracteristica: { idTipoCaracteristica: "pan" } }
        ]);
        const relacionesOriginales = [
            { idCaracteristica: { idCaracteristica: "oz" }, valor: "1" },
            { idCaracteristica: { idCaracteristica: "leche" }, valor: "1" },
            { idCaracteristica: { idCaracteristica: "blanco" }, valor: "." },
            { idCaracteristica: { idCaracteristica: "masa" }, valor: "-" }
        ];
        const originales = JSON.stringify(relacionesOriginales);
        relaciones.resolves(relacionesOriginales);
        const [producto] = await agruparPresentaciones([{ idProducto: "panini", nombre: "Panini", activo: true, precioSugerido: 4 }]);
        const configuracion = opcionesDeProducto(producto);
        expect(configuracion.fijas.map(c => c.etiqueta)).to.deep.equal(["1 Onzas"]);
        const leche = configuracion.grupos.find(g => g.nombre === "Tipo de leche");
        const pan = configuracion.grupos.find(g => g.nombre === "Tipo de pan");
        expect(leche.opciones.map(o => o.etiqueta)).to.deep.equal(["Leche deslactosada"]);
        expect(pan.opciones.map(o => o.etiqueta)).to.have.members(["Pan blanco", "Pan de masa madre"]);
        const selecciones = new Map([[leche.id, leche.opciones[0].id]]);
        expect(seleccionarProducto(configuracion, selecciones)).to.equal(null);
        selecciones.set(pan.id, pan.opciones.find(o => o.etiqueta === "Pan blanco").id);
        const seleccionado = seleccionarProducto(configuracion, selecciones);
        expect(seleccionado).to.include({ idProducto: "panini", precioSugerido: 4 });
        expect(seleccionado.caracteristicas.map(c => [c.idCaracteristica, c.valor]))
            .to.have.deep.members([["oz", "1"], ["leche", "1"], ["blanco", "."]]);
        expect(JSON.stringify(relacionesOriginales)).to.equal(originales);
    });

    test("conserva los identificadores, precios y orden de los productos recibidos", async function () {
        caracteristicas.resolves([{ idCaracteristica: "oz", nombre: "Onzas", activo: true }]);
        relaciones.callsFake(function () {
            const id = this.URL.split("/").at(-2);
            return Promise.resolve(id.startsWith("cafe") ? [{ idCaracteristica: { idCaracteristica: "oz" }, valor: id.slice(-2) }] : []);
        });
        const productos = [
            { idProducto: "pan", nombre: "Pan", activo: true, precioSugerido: 1 },
            { idProducto: "cafe12", nombre: "Café", activo: true, precioSugerido: 2 },
            { idProducto: "cafe16", nombre: "Café", activo: true, precioSugerido: 3 },
            { idProducto: "te", nombre: "Té", activo: true, precioSugerido: 1.5 }
        ];
        const original = JSON.stringify(productos);
        const catalogo = await agruparPresentaciones(productos);
        expect(catalogo.map(p => p.nombre)).to.deep.equal(["Pan", "Café", "Té"]);
        expect(opcionesDeProducto(catalogo[1]).variantes.map(v => [v.idProducto, v.precioSugerido])).to.deep.equal([["cafe12", 2], ["cafe16", 3]]);
        expect(JSON.stringify(productos)).to.equal(original);
    });

});
mocha.run();
