const { DigitalBaconUI, getDeviceType, getRenderer } = window.DigitalBacon;

const { BIG_TEXT_STYLE, BODY_STYLE, ORBIT_DISABLING_STYLE, PAGE_STYLE, TEXT_STYLE } = await import(location.origin + '/scripts/constants.js');

const buttonStyle = new DigitalBaconUI.Style({
    backgroundVisible: true,
    borderRadius: 0.02,
    height: 0.04,
    justifyContent: 'center',
    margin: 0.03,
    materialColor: 0x00cac7,
    width: 0.3,
});
const hoveredButtonStyle = new DigitalBaconUI.Style({ materialColor: 0x00a19f});
const piggieImagePath = '/assets/images/digital_bacon_pig_compressed.png';
const descriptionText = 'Improve engagement & sales with immersive 3D web content. No coding required, click the link below to start building';
const vcText = "Are you a partner at an accelerator or VC firm and want to help take Digital Bacon to the next level? Schedule an interview with the founder using the link below";
const digitalBaconUrl = 'https://digitalbacon.io';
const calendlyUrl = 'https://calendly.com/kalegauravd/investor-consultation';

export default class SponsorsMenu extends DigitalBaconUI.Body {
    constructor(params = {}) {
        super(BODY_STYLE, { padding: 0.025, width: 0.66 });
        let topRow = new DigitalBaconUI.Span();
        let image = new DigitalBaconUI.Image(piggieImagePath, { width: '15%' });
        let digitalBaconText = new DigitalBaconUI.Text(
            'Built with - Digital Bacon', BIG_TEXT_STYLE,
            { fontSize: 0.04, marginRight: 0.02 });
        let description = new DigitalBaconUI.Text(descriptionText, TEXT_STYLE,
            { marginTop: 0.03, maxWidth: '91%' });
        let digitalBaconLink = new DigitalBaconUI.Div(buttonStyle);
        digitalBaconLink.add(
            new DigitalBaconUI.Text(digitalBaconUrl, TEXT_STYLE));
        digitalBaconLink.onClick = () => {
            if(getDeviceType() == 'XR') {
                getRenderer().xr.getSession().end();
                location.href = digitalBaconUrl;
            } else {
                DigitalBaconUI.DelayedClickHandler.trigger(() => {
                    let newTab = window.open(digitalBaconUrl, '_blank');
                    if(newTab) newTab.focus();
                });
            }
        };
        let vcs = new DigitalBaconUI.Text(vcText, TEXT_STYLE,
            { marginTop: 0.05, maxWidth: '91%' });
        let contactLink = new DigitalBaconUI.Div(buttonStyle);
        contactLink.add(
            new DigitalBaconUI.Text('Schedule Interview', TEXT_STYLE));
        contactLink.onClick = () => {
            if(getDeviceType() == 'XR') {
                getRenderer().xr.getSession().end();
                location.href = calendlyUrl;
            } else {
                DigitalBaconUI.DelayedClickHandler.trigger(() => {
                    let newTab = window.open(calendlyUrl, '_blank');
                    if(newTab) newTab.focus();
                });
            }
        };
        digitalBaconLink.pointerInteractable.addHoveredCallback((hovered) => {
            digitalBaconLink.materialColor = (hovered) ? 0x00a19f : 0x00cac7;
        });
        contactLink.pointerInteractable.addHoveredCallback((hovered) => {
            contactLink.materialColor = (hovered) ? 0x00a19f : 0x00cac7;
        });
        topRow.add(digitalBaconText);
        topRow.add(image);
        this.add(topRow);
        this.add(description);
        this.add(digitalBaconLink);
        this.add(vcs);
        this.add(contactLink);
        if(getDeviceType() == 'XR') this.onClick = () => {};
    }
}
