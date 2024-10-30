const { DigitalBaconUI, OrbitDisablingPointerInteractable, THREE } = window.DigitalBacon;

export const API_URL = 'https://api.beatsaver.com';
export const ZIP_CACHE = {};

export const BODY_STYLE = new DigitalBaconUI.Style({
    borderRadius: 0.01,
    borderWidth: 0.001,
    height: 0.75,
    materialColor: new THREE.Color(0x000000),
    opacity: 1,
    width: 1,
});
export const TEXT_STYLE = new DigitalBaconUI.Style({
    color: 0xffffff,
    fontSize: 0.025,
});
export const BIG_TEXT_STYLE = new DigitalBaconUI.Style({
    color: 0xffffff,
    fontSize: 0.05,
});
export const BIG_BUTTON_STYLE = new DigitalBaconUI.Style({
    backgroundVisible: true,
    borderRadius: 0.05,
    height: 0.1,
    justifyContent: 'center',
    materialColor: 0x222222,
    width: 0.4,
});
export const ORBIT_DISABLING_STYLE = new DigitalBaconUI.Style({
    pointerInteractableClassOverride: OrbitDisablingPointerInteractable,
});
export const PAGE_STYLE = new DigitalBaconUI.Style({ height: '100%', width: '99%' });
