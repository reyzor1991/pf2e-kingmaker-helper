const moduleName = "pf2e-kingmaker-helper";

class CampsiteActivities extends foundry.abstract.DataModel {

    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            data: new fields.ArrayField(new fields.SchemaField({
                key: new fields.NumberField({initial: 0}),
                result: new fields.StringField({initial: ""})
            }))
        };
    }

    static load() {
        const data = game.settings.get(moduleName, "data");
        return this.fromSource(data);
    }

    async update() {
        await game.settings.set(moduleName, "data", this.toObject());
    }
}

const OUTCOME_TO_KEY = {
    "failure": "f_campfire",
    "success": "s_campfire",
    "criticalFailure": "cf_campfire",
    "criticalSuccess": "cs_campfire",
}

const ADDITIONAL_ACTIVITIES = Object.freeze({
    'cs_campfire': {
        id: "cs_campsite",
        img: `modules/${moduleName}/assets/cs_campfire.webp`,
        label: "pf2e-kingmaker-helper.FEATURES.cs_campsite",
        hint: "You find the perfect spot for a camp. Flat checks to determine encounters at the campsite for the next 24 hours have a DC 2 higher than normal, and the first hour spent performing Camping activities does not incur the usual flat check for random encounters."
    },
    's_campfire': {
        id: "s_campsite",
        img: `modules/${moduleName}/assets/s_campfire.webp`,
        label: "pf2e-kingmaker-helper.FEATURES.s_campsite",
        "hint": "You find a serviceable spot for a camp and for Camping activities."
    },
    'cf_campfire': {
        id: "cf_campsite",
        img: `modules/${moduleName}/assets/cf_campfire.webp`,
        label: "pf2e-kingmaker-helper.FEATURES.cf_campsite",
        hint: "Your campsite will work, but it's not the best. Campsite activities that require checks take a -2 penalty."
    },
    'f_campfire': {
        id: "f_campsite",
        img: `modules/${moduleName}/assets/f_campfire.webp`,
        label: "pf2e-kingmaker-helper.FEATURES.f_campsite",
        hint: "The campsite is a mess. You can use it to rest and to perform daily preparations, but it isn't good enough to allow for Campsite activities at all. Worse, your attempt to secure a campsite has possibly attracted unwanted attention-attempt a flat check against the zone's Encounter DC. If successful, a random encounter automatically occurs."
    }
});

const normalize = (val, max, min) => {
    return (val - min) / (max - min);
};

const hexToAlpha = (alphaHexString) => {
    return parseFloat(normalize(parseInt(alphaHexString, 16), 255, 0).toFixed(2));
}

function hexes(filter) {
    return Object.entries(foundry.utils.deepClone(game.settings.get("pf2e-kingmaker", "state").hexes))
        .filter((data) => filter(data[1]))
        .map(a => Number(a[0]))
        .map(n => kingmaker.region.hexes.get(n))
        .filter(h => !!h);
}

Hooks.once('ready', () => {
    try {
        window.Ardittristan.ColorSetting.tester
    } catch {
        ui.notifications.notify('Please make sure you have the "lib - ColorSettings" module installed and enabled.', "error");
    }
});

function fillColor(g, polygons, color, alpha) {
    g.beginFill(color, alpha).lineStyle({color: color, width: game.settings.get(moduleName, "widthPolygon")})
    for (const polygon of polygons) {
        g.drawShape(polygon);
    }
    g.endFill();
}

function createPolygon(hex) {
    const v = canvas.grid.getVertices(hex);
    for (let i of v) {
        i.x += hex.center.x
        i.y += (hex.center.y - 158)
    }
    return new PIXI.Polygon(v)
}

function createPolygons(hexes) {
    return hexes.map(h => createPolygon(h))
}

function getColor(name) {
    let val = game.settings.get(moduleName, name)

    return {
        color: Color.from(val.substring(0, val.length - 2)),
        alpha: hexToAlpha(val.substring(val.length - 2))
    }
}

const ORIGIN_ICON_SIZE = 256;
const SCALE = 0.25;

const MAP_MOVEMENT = {
    0: {x: 0, y: 0},
    1: {x: 1, y: 0},
    2: {x: 1, y: 1},
    3: {x: 0, y: 1},
    4: {x: -1, y: 1},
    5: {x: -1, y: 0},
    6: {x: -1, y: -1},
    7: {x: 0, y: -1},
    8: {x: 1, y: -1},
}

Hooks.on('init', function () {
    new window.Ardittristan.ColorSetting(moduleName, "reconnoiteredHexColor", {
        name: "Hex Color - Reconnoitered",
        label: "Color Picker",
        restricted: false,
        defaultColor: "#00ff0026",
        scope: "client",
        onChange: (value) => {
            game.coloredAndIconsLayer?.draw()
        },
        // insertAfter: "myModule.mySetting"
    })
    new window.Ardittristan.ColorSetting(moduleName, "mappedHexColor", {
        name: "Hex Color - Mapped",
        label: "Color Picker",
        restricted: false,
        defaultColor: "#0000ff26",
        scope: "client",
        onChange: (value) => {
            game.coloredAndIconsLayer?.draw()
        },
        // insertAfter: "myModule.mySetting"
    })
    new window.Ardittristan.ColorSetting(moduleName, "claimedHexColor", {
        name: "Hex Color - Claimed",
        label: "Color Picker",
        restricted: false,
        defaultColor: "#ff000026",
        scope: "client",
        onChange: (value) => {
            game.coloredAndIconsLayer?.draw()
        },
        // insertAfter: "myModule.mySetting"
    })
    game.settings.register(moduleName, "widthPolygon", {
        name: "Thickness of outline around the hex",
        scope: "client",
        config: true,
        default: 0,
        type: Number,
        onChange: value => {
            game.coloredAndIconsLayer?.draw()
        }
    });
    game.settings.register(moduleName, "addHours", {
        name: "Add 4 hours when move between hexes",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register(moduleName, "data", {
        scope: "world",
        config: false,
        requiresReload: false,
        type: CampsiteActivities,
        default: {}
    });

    game.settings.register(moduleName, "show-colored-hex", {
        scope: "client",
        config: false,
        requiresReload: false,
        type: Boolean,
        default: false
    });
})

Hooks.on("getSceneControlButtons", buttons => {
    if (typeof kingmaker === "undefined") {
        return;
    }
    if (!kingmaker?.region?.active) return;
    const tokens = buttons.find(b => b.name === "token");

    let btn = {
        name: "show-colored-hex",
        title: `${moduleName}.show-colored-hex`,
        icon: "fa-solid fa-droplet",
        visible: true,
        toggle: true,
        active: !!game.settings.get(moduleName, "show-colored-hex"),
        onClick: async () => {
            await game.settings.set(moduleName, "show-colored-hex", !game.settings.get(moduleName, "show-colored-hex"))
            game.coloredAndIconsLayer.visible = game.settings.get(moduleName, "show-colored-hex");
            game.coloredAndIconsLayer.draw();
        }
    }

    tokens.tools.push(btn);
});

class ColoredAndIconsLayer extends PIXI.Container {
    constructor() {
        super();
        this.visible = game.settings.get(moduleName, "show-colored-hex");
    }

    draw() {
        this.children.forEach(c => c.destroy());
        if (!this.visible) {
            return
        }
        let g = this.addChild(new PIXI.Graphics());
        this.#drawColored(g)
    }

    #drawColored(g) {
        this.#drawColorByType(g, h => h.exploration === 1 && !h.claimed, getColor("reconnoiteredHexColor"));
        this.#drawColorByType(g, h => h.exploration === 2 && !h.claimed, getColor("mappedHexColor"));
        this.#drawColorByType(g, h => h.claimed, getColor("claimedHexColor"));
        this.#drawResourceIcon(g)
    }

    #drawColorByType(g, filter, color) {
        fillColor(g, createPolygons(hexes(filter)), color.color, color.alpha)
    }

    #drawResourceIcon(graphics) {
        let all = hexes(h => !!h.commodity && h.showResources);
        all = [...all, ...hexes(h => h.features && h.features.length > 0), ...hexes(h => h.camp)]


        let additionalData = CampsiteActivities.load().data;

        let scaledSize = ORIGIN_ICON_SIZE * SCALE;
        let correction = scaledSize / 2

        let position = 0;
        for (const hex of all) {
            if (hex.data.page && game.user.isGM) {
                position += 1;
            }
            if (hex.data.commodity && hex.data.showResources) {
                let image = new PIXI.Sprite(
                    PIXI.Texture.from(kingmaker.CONST.COMMODITIES[hex.data.commodity].img)
                );
                setImage(image, graphics, hex, correction, position, scaledSize)
                position += 1;
            }
            if (hex.data.camp && hex.data.showResources) {
                let image = new PIXI.Sprite(
                    PIXI.Texture.from(kingmaker.CONST.CAMPS[hex.data.camp].img)
                );
                setImage(image, graphics, hex, correction, position, scaledSize)
                position += 1;
            }

            let createCampsite = additionalData.find(ad => ad.key === hex.key);
            if (createCampsite) {
                let image = new PIXI.Sprite(
                    PIXI.Texture.from(ADDITIONAL_ACTIVITIES[createCampsite.result].img)
                );
                setImage(image, graphics, hex, correction, position, scaledSize)
                position += 1;
            }

            let features = hex.data.features.filter(f => f.discovered);

            for (let feature of features) {
                if (position > 8) {
                    break
                }
                let image = PIXI.Sprite.from(
                    kingmaker.CONST.FEATURES[feature.type].img
                );
                setImage(image, graphics, hex, correction, position, scaledSize)
                position += 1;
            }
            position = 0;
        }
    }
}

function setImage(image, graphics, hex, correction, position, scaledSize) {
    image.scale.set(SCALE, SCALE)
    let x = hex.center.x - correction;
    let y = hex.center.y - correction;
    x += (MAP_MOVEMENT[position].x * scaledSize)
    y += (MAP_MOVEMENT[position].y * scaledSize)
    image.position.set(x, y)
    graphics.addChild(image);
}

Hooks.on("canvasReady", () => {
    if (typeof kingmaker === "undefined") {
        return;
    }
    if (kingmaker?.region?.active) {
        game.coloredAndIconsLayer = new ColoredAndIconsLayer();
        canvas.interface.grid.addChild(game.coloredAndIconsLayer);
        game.coloredAndIconsLayer.draw()
    }
});

Hooks.on("updateSetting", (setting) => {
    if (setting.key === 'pf2e-kingmaker.state') {
        game.coloredAndIconsLayer?.draw()
    }
});

Hooks.on("renderKingmakerHexEdit", (form, html, params) => {
    if (form.object.key) {
        let cAct = CampsiteActivities.load();

        let data = cAct.data;
        let find = data.find(d => d.key === form.object.key);
        if (!find) {
            return
        }
        let additionalActivity = ADDITIONAL_ACTIVITIES[find.result];
        let newHtml = `
            <fieldset>
                <div class="form-group">
                    <label data-tooltip="${additionalActivity.hint}" aria-label="">${game.i18n.localize(additionalActivity.label)}</label>
                    <button type="button" class="icon fa-solid fa-times remove-aa" style="flex: 0.1;"></button>
                </div>
            </fieldset>
        `
        html.find('footer').before(newHtml);

        html.on("click", '.remove-aa', async (_e, a) => {
            $(_e.target).closest('fieldset').remove();
            cAct.updateSource({
                data: data.filter(d => d.key !== form.object.key)
            })
            await cAct.update()
            game.coloredAndIconsLayer?.draw()
        });
    }
});

Hooks.on("createChatMessage", async (message) => {
    if (game.user !== game.users.activeGM) {
        return
    }
    if (!message?.flags?.pf2e?.context?.options?.includes("action:prepare-campsite")) {
        return;
    }
    if (!["criticalFailure", "criticalSuccess"].includes(message.flags.pf2e.context.outcome)) {
        return;
    }

    let token = game.actors.party.getActiveTokens(true, true)[0]
    if (!token) {
        return;
    }

    let hex = kingmaker.region.hexes
        .map(h => [createPolygon(h), h])
        .filter(hh => hh[0].contains(token.center.x, token.center.y))
        .map(hh => hh[1])[0]
    if (!hex) {
        return;
    }

    let cA = CampsiteActivities.load();
    let data = cA.data;
    let find = data.find(d => d.key === hex.key);
    if (find) {
        find.result = OUTCOME_TO_KEY[message.flags.pf2e.context.outcome]
        cA.updateSource({data})
    } else {
        data.push({
            key: hex.key,
            result: OUTCOME_TO_KEY[message.flags.pf2e.context.outcome]
        })
        cA.updateSource({data})
    }
    await cA.update()
    game.coloredAndIconsLayer?.draw()
});

Hooks.on('preUpdateToken', (tokenDoc, data, options, _userId) => {
    if (!tokenDoc?.actor?.isOfType('party')) {
        return;
    }
    if (!(data.x || data.y)) {
        return;
    }
    if (!game.settings.get(moduleName, "addHours")) {return;}

    if (options.isUndo) {
        game.time.advance(-14400)
    } else {
        game.time.advance(14400)
    }
});

Hooks.on('preUpdateToken', (tokenDoc, data, _options, _userId) => {
    if (!tokenDoc?.actor?.isOfType('party')) {
        return;
    }
    let sheet = game.actors.getName("Camping Sheet");
    let settings = sheet?.flags?.['pf2e-kingmaker-tools']?.['camping-sheet'];
    let sRegions = settings?.regionSettings?.regions || [];
    if (!sheet || !settings || !sRegions.length) {
        return;
    }

    let oldCenter = foundry.utils.deepClone(tokenDoc.center)
    let b = foundry.utils.deepClone(tokenDoc.bounds)
    let newCenter = {
        x: (data.x || tokenDoc.x) + b.width / 2,
        y: (data.y || tokenDoc.y) + b.height / 2,
    }

    let polygons = kingmaker.region.hexes
        .map(h => [createPolygon(h), h]);

    let oldZone = polygons
        .filter(hh => hh[0].contains(oldCenter.x, oldCenter.y))
        .map(hh => hh[1])[0]?.zone

    let newZone = polygons
        .filter(hh => hh[0].contains(newCenter.x, newCenter.y))
        .map(hh => hh[1])[0]?.zone

    if (!newZone || !oldZone) {
        return
    }

    if (newZone.id !== oldZone.id) {
        let zoneName = game.i18n.localize(newZone.label);
        if (sRegions.find(s => s.name === zoneName)) {
            sheet.update({"flags.pf2e-kingmaker-tools.camping-sheet.currentRegion": zoneName})
        }
    }
})

