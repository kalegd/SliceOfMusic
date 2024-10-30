const { BIG_TEXT_STYLE, ORBIT_DISABLING_STYLE } = await import(location.origin + '/scripts/constants.js');

const { DigitalBaconUI, OrbitDisablingPointerInteractable, THREE } = window.DigitalBacon;

export const createBackButton = () => {
    let backButton = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE, {
        backgroundVisible: true,
        borderRadius: 0.01,
        materialColor: 0x222222,
        margin: 0.02,
        width: 0.06,
    });     
    backButton.add(new DigitalBaconUI.Text('<', BIG_TEXT_STYLE));
    backButton.pointerInteractable.addHoveredCallback((hovered) => {
        backButton.materialColor = (hovered) ? 0x444444 : 0x222222;
    }); 
    return backButton;
};
