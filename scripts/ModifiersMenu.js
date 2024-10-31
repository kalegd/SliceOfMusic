const { DigitalBaconUI, THREE } = window.DigitalBacon;
const { Body, Div, HSLColor, Span, Style, Text } = DigitalBaconUI;

const { BIG_TEXT_STYLE, BODY_STYLE, ORBIT_DISABLING_STYLE, PAGE_STYLE, TEXT_STYLE } = await import(location.origin + '/scripts/constants.js');
//Need a question mark at the end of the utils url because of Safari being dumb.
//Can remove this comment and the question mark once the following is resolved:
//https://github.com/WebKit/WebKit/pull/24122
const { createBackButton } = await import(location.origin + '/scripts/utils.js?');

const buttonStyle = new Style({
    backgroundVisible: true,
    borderRadius: 0.01,
    borderWidth: 0.002,
    height: 0.1,
    justifyContent: 'center',
    materialColor: 0,
    width: 0.325,
});
const hoveredMaterial = new THREE.MeshBasicMaterial({ color: 0x696969 });
const selectedMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const hoveredButtonStyle = new Style({ borderMaterial: hoveredMaterial });
const selectedButtonStyle = new Style({ borderMaterial: selectedMaterial });
const HSL = {};

class ModifiersMenu extends Body {
    constructor(params = {}) {
        super(BODY_STYLE, { width: 0.66 });
        this.neverFail = false;
        this.leftColor = new THREE.Color(0xff00ff);
        this.rightColor = new THREE.Color(0x00ffff);
        this._createOptionsPage();
        this._createColorsPage();
        this._createNJSPage();
    }

    _createOptionsPage() {
        this._optionsPage = new Div(PAGE_STYLE, {padding:0.028});
        let title = new Text('Modifiers', BIG_TEXT_STYLE);
        let neverFailButton = this._createOption('Never Fail', () => {
            this.neverFail = !this.neverFail;
            if(this.neverFail) {
                neverFailButton.addStyle(selectedButtonStyle);
                neverFailButton.textComponent.color = 0x00ff00;
            } else {
                neverFailButton.removeStyle(selectedButtonStyle);
                neverFailButton.textComponent.color = 0xffffff;
            }
        });
        let colorsButton = this._createOption('Colors', () => {
            this.remove(this._optionsPage);
            this.add(this._colorsPage);
        });
        let njsButton = this._createOption('Note Jump Speed', () => {
            this.remove(this._optionsPage);
            this.add(this._njsPage);
        });
        this._optionsPage.add(title);
        this._optionsPage.add(colorsButton);
        this._optionsPage.add(neverFailButton);
        this._optionsPage.add(njsButton);
        this.add(this._optionsPage);
    }

    _createOption(label, onClick) {
        let button = new Div(buttonStyle, ORBIT_DISABLING_STYLE,
            { marginTop: 0.025 });
        let text = new Text(label,
            { fontSize: 0.035, color: 0xffffff });
        button.textComponent = text;
        button.add(text);
        button.pointerInteractable.addHoveredCallback((hovered) => {
            if(hovered) {
                button.addStyle(hoveredButtonStyle);
            } else {
                button.removeStyle(hoveredButtonStyle);
            }
        });
        button.onClick = onClick;
        return button;
    }

    _createColorsPage() {
        this._colorsPage = new Div(PAGE_STYLE, { padding: 0.01 });
        let topRow = new Span({ width: '100%' });
        let title = new Text('Colors', BIG_TEXT_STYLE, { marginLeft: 0.14 });
        let backButton = createBackButton();
        backButton.onClick = () => {
            this.remove(this._colorsPage);
            this.add(this._optionsPage);
        };
        topRow.add(backButton);
        topRow.add(title);
        let leftRow = this._createColorRow('left', this.leftColor);
        let rightRow = this._createColorRow('right', this.rightColor);
        this._colorsPage.add(topRow);
        this._colorsPage.add(leftRow);
        this._colorsPage.add(rightRow);
    }

    _createColorRow(side, color) {
        let capitalizedSide = side.charAt(0).toUpperCase() + side.slice(1);
        let row = new Span({ justifyContent: 'spaceAround', width: '100%'});
        let title = new Text(capitalizedSide + ' Side', TEXT_STYLE);
        let hslColor = this._createHSLColor(side, this.leftColor);
        row.add(title);
        row.add(hslColor.hueSaturationWheel);
        row.add(hslColor.lightnessBar);
        return row;
    }

    _createHSLColor(side, color) {
        let hslColor = new HSLColor(0.1, ORBIT_DISABLING_STYLE);
        hslColor.setFromHSL(color.getHSL(HSL, THREE.SRGBColorSpace));
        hslColor.onChange = (color) => {
            if(this.onColorChange) this.onColorChange(side, color);
        };
        return hslColor;
    }

    _createNJSPage() {
        this._njsPage = new Div(PAGE_STYLE, { padding: 0.01 });
        let topRow = new Span({ width: '100%' });
        let title = new Text('Note Jump Speed', BIG_TEXT_STYLE, { marginLeft: 0.02 });
        let backButton = createBackButton();
        backButton.onClick = () => {
            this.remove(this._njsPage);
            this.add(this._optionsPage);
        };
        topRow.add(backButton);
        topRow.add(title);
        this._njsPage.add(topRow);
    }
}

let modifiersMenu = new ModifiersMenu();
export default modifiersMenu;
