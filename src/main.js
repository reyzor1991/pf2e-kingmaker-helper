const moduleName = "pf2e-kingmaker-helper";

const normalize = (val, max, min) => {
    return (val - min) / (max - min);
};

const hexToAlpha = (alphaHexString) => {
    return parseFloat(normalize(parseInt(alphaHexString, 16), 255, 0).toFixed(2));
}

function hexes(filter) {
    return Object.entries(foundry.utils.deepClone(game.settings.get("pf2e-kingmaker", "state").hexes))
        .filter((data)=>filter(data[1]))
        .map(a=>Number(a[0]))
        .map(n=>kingmaker.region.hexes.get(n))
        .filter(h=>!!h);
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

function createPolygon(hexes) {
    return hexes.map(h=> {
        let v = canvas.grid.getVertices(h);
        for (let i of v) {
            i.x += h.center.x
            i.y += (h.center.y-158)
        }
        return new PIXI.Polygon(v)
    })
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
})

Hooks.on("getSceneControlButtons", buttons => {
    if (!kingmaker.region?.active) return;
    const tokens = buttons.find(b => b.name === "token");

    let btn = {
        name: "show-colored-hex",
        title: `${moduleName}.show-colored-hex`,
        icon: "fa-solid fa-droplet",
        visible: true,
        toggle: true,
        active: !!game.coloredAndIconsLayer?.visible,
        onClick: async () => {
            game.coloredAndIconsLayer.visible = !game.coloredAndIconsLayer.visible;
            game.coloredAndIconsLayer.draw();
        }
    }

    tokens.tools.push(btn);
});

class ColoredAndIconsLayer extends PIXI.Container {
    constructor() {
        super();
        this.visible = false;
    }

    draw() {
        this.children.forEach(c => c.destroy());
        if (!this.visible) {return}
        let g = this.addChild(new PIXI.Graphics());
        this.#drawColored(g)
    }

    #drawColored(g) {
        this.#drawColorByType(g, h=>h.exploration === 1 && !h.claimed, getColor("reconnoiteredHexColor"));
        this.#drawColorByType(g, h=>h.exploration === 2 && !h.claimed, getColor("mappedHexColor"));
        this.#drawColorByType(g, h=>h.claimed, getColor("claimedHexColor"));
        this.#drawResourceIcon(g)
    }

    #drawColorByType(g, filter, color) {
        fillColor(g, createPolygon(hexes(filter)), color.color, color.alpha)
    }

    #drawResourceIcon(graphics) {
        let all = hexes(h => !!h.commodity && h.showResources);
        all = [...all, ...hexes(h=>h.features && h.features.length > 0), ...hexes(h=>h.camp)]

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
                image.scale.set(SCALE, SCALE)
                let x = hex.center.x - correction;
                let y = hex.center.y - correction;
                x += (MAP_MOVEMENT[position].x * scaledSize)
                y += (MAP_MOVEMENT[position].y * scaledSize)
                image.position.set(x, y)
                graphics.addChild(image);
                position += 1;
            }
            if (hex.data.camp && hex.data.showResources) {
                let image = new PIXI.Sprite(
                    PIXI.Texture.from(kingmaker.CONST.CAMPS[hex.data.camp].img)
                );
                image.scale.set(SCALE, SCALE)
                let x = hex.center.x - correction;
                let y = hex.center.y - correction;
                x += (MAP_MOVEMENT[position].x * scaledSize)
                y += (MAP_MOVEMENT[position].y * scaledSize)
                image.position.set(x, y)
                graphics.addChild(image);
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
                image.scale.set(SCALE, SCALE)
                let x = hex.center.x - correction;
                let y = hex.center.y - correction;
                x += (MAP_MOVEMENT[position].x * scaledSize)
                y += (MAP_MOVEMENT[position].y * scaledSize)

                image.position.set(x, y)
                graphics.addChild(image);
                position += 1;
            }
            position = 0;
        }
    }
}

Hooks.on("canvasReady", () => {
    game.coloredAndIconsLayer = new ColoredAndIconsLayer();
    canvas.interface.grid.addChild(game.coloredAndIconsLayer);
    game.coloredAndIconsLayer.draw()
});

Hooks.on("updateSetting", (setting) => {
    if (setting.key === 'pf2e-kingmaker.state') {
        game.coloredAndIconsLayer?.draw()
    }
});
